import asyncio
import uuid
from pathlib import Path
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
from collections import defaultdict

from models.channel_export import (
    ChannelDownloadState,
    DownloadJobStatus,
)
from models.message import Message, Reaction
from repositories.channel_export_repository import ChannelExportRepository
from services.slack_client import SlackClient
from utils.file_handler import FileHandler
from utils.logger import get_logger

logger = get_logger(__name__)

# 初回ダウンロード: 過去1年分
INITIAL_DOWNLOAD_DAYS = 365

# レート制限: API呼び出し間隔（秒）
RATE_LIMIT_INTERVAL = 1.2


class ChannelExporter:
    """チャンネルデータのダウンロード・エクスポートサービス"""

    def __init__(
        self,
        slack_client: SlackClient,
        export_repo: ChannelExportRepository,
        data_dir: Path,
        export_dir: Optional[str] = None,
    ):
        self.slack_client = slack_client
        self.export_repo = export_repo
        if export_dir:
            self.export_base_dir = Path(export_dir)
        else:
            self.export_base_dir = data_dir / "channel_exports"
        FileHandler.ensure_dir(self.export_base_dir)

    def _get_channel_dir(self, channel_id: str, channel_name: str) -> Path:
        """チャンネルの出力ディレクトリを取得"""
        safe_name = channel_name.replace("/", "_").replace(" ", "_")
        return self.export_base_dir / f"{safe_name}_{channel_id}"

    async def download_all_channels(self) -> DownloadJobStatus:
        """全設定チャンネルをダウンロード"""
        config = self.export_repo.get_config()
        enabled_channels = [ch for ch in config.channels if ch.enabled]

        job = DownloadJobStatus(
            job_id=uuid.uuid4().hex[:8],
            started_at=datetime.now().isoformat(),
            status="running",
            channels=[],
        )
        self.export_repo.save_job(job)

        for i, channel in enumerate(enabled_channels):
            job.current_channel = channel.channel_id
            job.progress_percent = (i / len(enabled_channels)) * 100 if enabled_channels else 0
            self.export_repo.save_job(job)

            state = await self.download_channel(channel.channel_id, channel.channel_name)
            job.channels.append(state)

        job.status = "completed"
        job.completed_at = datetime.now().isoformat()
        job.current_channel = None
        job.progress_percent = 100.0
        self.export_repo.save_job(job)

        logger.info(f"Download job {job.job_id} completed: {len(job.channels)} channels")
        return job

    async def download_channel(
        self,
        channel_id: str,
        channel_name: str,
    ) -> ChannelDownloadState:
        """単一チャンネルをダウンロード"""
        state = self.export_repo.get_state(channel_id) or ChannelDownloadState(
            channel_id=channel_id,
            channel_name=channel_name,
        )
        state.status = "downloading"
        state.error_message = None
        self.export_repo.save_state(state)

        try:
            # 常に全期間のチャンネル履歴を取得（スレッド返信の更新検出のため）
            oldest = str((datetime.now() - timedelta(days=INITIAL_DOWNLOAD_DAYS)).timestamp())
            latest = str(datetime.now().timestamp())

            # メッセージ取得
            all_messages = await self._fetch_all_messages(channel_id, oldest, latest)
            logger.info(f"Fetched {len(all_messages)} messages from {channel_name}")

            if not all_messages:
                state.status = "completed"
                state.last_downloaded_at = datetime.now().isoformat()
                self.export_repo.save_state(state)
                return state

            # スレッド返信を取得
            # 差分更新時: latest_replyが前回DL以降のスレッドのみ再取得
            # 初回: 全スレッド取得
            thread_messages: Dict[str, List[Message]] = {}
            for msg in all_messages:
                if msg.get("reply_count", 0) <= 0:
                    continue
                thread_ts = msg["ts"]

                # 差分更新時は、前回DL以降に返信があったスレッドのみ取得
                if state.last_message_ts:
                    latest_reply = msg.get("latest_reply", "")
                    if latest_reply and float(latest_reply) <= float(state.last_message_ts):
                        continue

                replies = await self._fetch_thread_replies(channel_id, thread_ts)
                if replies:
                    thread_messages[thread_ts] = replies
                await asyncio.sleep(RATE_LIMIT_INTERVAL)

            # ファイル出力
            channel_dir = self._get_channel_dir(channel_id, channel_name)
            await self._save_json(channel_dir, all_messages, thread_messages, channel_id, channel_name)
            await self._save_markdown(channel_dir, all_messages, thread_messages, channel_name)
            self._save_metadata(channel_dir, channel_id, channel_name, all_messages, thread_messages)
            self._save_thread_index(channel_dir, all_messages, thread_messages)

            # 状態更新
            newest_ts = max(msg["ts"] for msg in all_messages)
            state.last_message_ts = newest_ts
            state.last_downloaded_at = datetime.now().isoformat()
            state.total_messages_downloaded = len(all_messages)
            state.total_threads_downloaded = len(thread_messages)
            state.status = "completed"
            self.export_repo.save_state(state)

            logger.info(
                f"Channel {channel_name} download completed: "
                f"{len(all_messages)} messages, {len(thread_messages)} threads"
            )
            return state

        except Exception as e:
            state.status = "error"
            state.error_message = str(e)
            self.export_repo.save_state(state)
            logger.error(f"Failed to download channel {channel_name}: {e}")
            return state

    async def _fetch_all_messages(
        self,
        channel_id: str,
        oldest: str,
        latest: str,
    ) -> List[Dict[str, Any]]:
        """ページネーション付きで全メッセージを取得"""
        all_messages: List[Dict[str, Any]] = []
        current_latest = latest

        while True:
            messages, has_more = await self.slack_client.get_channel_history_with_metadata(
                channel_id=channel_id,
                oldest=oldest,
                latest=current_latest,
                limit=200,
            )

            if not messages:
                break

            all_messages.extend(messages)
            logger.info(f"Fetched batch: {len(messages)} messages (total: {len(all_messages)})")

            if not has_more:
                break

            # 次のページ: 取得した中で最も古いメッセージのtsをlatestにする
            current_latest = messages[-1]["ts"]
            await asyncio.sleep(RATE_LIMIT_INTERVAL)

        # 時系列順にソート（古い順）
        all_messages.sort(key=lambda m: float(m["ts"]))
        return all_messages

    async def _fetch_thread_replies(
        self,
        channel_id: str,
        thread_ts: str,
    ) -> List[Message]:
        """スレッドの返信を取得"""
        try:
            return await self.slack_client.get_thread_messages(channel_id, thread_ts)
        except Exception as e:
            logger.error(f"Failed to fetch thread replies for {thread_ts}: {e}")
            return []

    async def _save_json(
        self,
        channel_dir: Path,
        messages: List[Dict[str, Any]],
        thread_messages: Dict[str, List[Message]],
        channel_id: str,
        channel_name: str,
    ) -> None:
        """JSON形式でメッセージを日別に保存"""
        messages_dir = channel_dir / "messages"
        threads_dir = channel_dir / "threads"

        # 日別にグループ化
        daily_messages: Dict[str, List[Dict[str, Any]]] = defaultdict(list)
        for msg in messages:
            ts = float(msg["ts"])
            date_str = datetime.fromtimestamp(ts).strftime("%Y-%m-%d")
            month_str = datetime.fromtimestamp(ts).strftime("%Y-%m")

            # ユーザー表示名を付与
            user_id = msg.get("user", "")
            user_name = await self.slack_client.get_user_display_name(user_id) if user_id else ""

            msg_data = {
                "ts": msg["ts"],
                "user": user_id,
                "user_name": user_name,
                "text": msg.get("text", ""),
                "thread_ts": msg.get("thread_ts"),
                "reply_count": msg.get("reply_count", 0),
                "reactions": [
                    {"name": r.get("name", ""), "count": r.get("count", 0)}
                    for r in msg.get("reactions", [])
                ],
                "files": msg.get("files", []),
                "created_at": datetime.fromtimestamp(ts).isoformat(),
            }
            daily_messages[f"{month_str}/{date_str}"].append(msg_data)

        # 日別JSONファイルを保存
        for date_key, day_messages in daily_messages.items():
            month_str, date_str = date_key.split("/")
            day_dir = messages_dir / month_str
            FileHandler.ensure_dir(day_dir)
            FileHandler.write_json(day_dir / f"{date_str}.json", {
                "channel_id": channel_id,
                "channel_name": channel_name,
                "date": date_str,
                "messages": day_messages,
            })

        # スレッドJSONファイルを保存
        FileHandler.ensure_dir(threads_dir)
        for thread_ts, replies in thread_messages.items():
            parent = next((r for r in replies if r.ts == thread_ts), None)
            thread_data = {
                "channel_id": channel_id,
                "thread_ts": thread_ts,
                "parent_message": parent.model_dump(mode="json") if parent else None,
                "replies": [r.model_dump(mode="json") for r in replies if r.ts != thread_ts],
                "reply_count": len(replies) - 1,
                "participants": list(set(
                    r.user_name or r.user for r in replies if r.user
                )),
            }
            FileHandler.write_json(threads_dir / f"{thread_ts}.json", thread_data)

    async def _save_markdown(
        self,
        channel_dir: Path,
        messages: List[Dict[str, Any]],
        thread_messages: Dict[str, List[Message]],
        channel_name: str,
    ) -> None:
        """Markdown形式でメッセージを日別に保存"""
        messages_dir = channel_dir / "messages"
        threads_dir = channel_dir / "threads"

        # 日別にグループ化
        daily_messages: Dict[str, List[Dict[str, Any]]] = defaultdict(list)
        for msg in messages:
            ts = float(msg["ts"])
            date_str = datetime.fromtimestamp(ts).strftime("%Y-%m-%d")
            month_str = datetime.fromtimestamp(ts).strftime("%Y-%m")
            daily_messages[f"{month_str}/{date_str}"].append(msg)

        # 日別Markdownファイルを保存
        for date_key, day_messages in daily_messages.items():
            month_str, date_str = date_key.split("/")
            day_dir = messages_dir / month_str
            FileHandler.ensure_dir(day_dir)

            md_lines = [f"# #{channel_name} - {date_str}\n"]

            for msg in day_messages:
                ts = float(msg["ts"])
                time_str = datetime.fromtimestamp(ts).strftime("%H:%M")
                user_id = msg.get("user", "")
                user_name = await self.slack_client.get_user_display_name(user_id) if user_id else "unknown"
                text = msg.get("text", "")
                reply_count = msg.get("reply_count", 0)

                # ヘッダー
                header = f"### {time_str} - {user_name}"
                if reply_count > 0:
                    header += f" (thread: {reply_count} replies)"
                md_lines.append(header)
                md_lines.append("")

                # 本文
                if text:
                    md_lines.append(text)
                    md_lines.append("")

                # リアクション
                reactions = msg.get("reactions", [])
                if reactions:
                    reaction_strs = [f":{r.get('name', '')}:" f" x{r.get('count', 0)}" for r in reactions]
                    md_lines.append("> " + " ".join(reaction_strs))
                    md_lines.append("")

                # スレッド返信（インライン）
                thread_ts = msg.get("ts")
                if thread_ts in thread_messages:
                    replies = thread_messages[thread_ts]
                    for reply in replies:
                        if reply.ts == thread_ts:
                            continue  # 親メッセージはスキップ
                        reply_time = reply.created_at.strftime("%H:%M") if reply.created_at else ""
                        reply_user = reply.user_name or reply.user or "unknown"
                        reply_text = reply.text or ""
                        md_lines.append(f"  > **{reply_time} - {reply_user}**: {reply_text}")
                    md_lines.append("")

                md_lines.append("---")
                md_lines.append("")

            md_path = day_dir / f"{date_str}.md"
            md_path.write_text("\n".join(md_lines), encoding="utf-8")

        # スレッドMarkdownファイルを保存
        FileHandler.ensure_dir(threads_dir)
        for thread_ts, replies in thread_messages.items():
            md_lines = [f"# Thread {thread_ts}\n"]

            for reply in replies:
                time_str = reply.created_at.strftime("%Y-%m-%d %H:%M") if reply.created_at else ""
                user_name = reply.user_name or reply.user or "unknown"
                is_parent = reply.ts == thread_ts

                if is_parent:
                    md_lines.append(f"## {time_str} - {user_name} (parent)")
                else:
                    md_lines.append(f"### {time_str} - {user_name}")
                md_lines.append("")

                if reply.text:
                    md_lines.append(reply.text)
                    md_lines.append("")

                if reply.reactions:
                    reaction_strs = [f":{r.name}: x{r.count}" for r in reply.reactions]
                    md_lines.append("> " + " ".join(reaction_strs))
                    md_lines.append("")

                md_lines.append("---")
                md_lines.append("")

            md_path = threads_dir / f"{thread_ts}.md"
            md_path.write_text("\n".join(md_lines), encoding="utf-8")

    def _save_metadata(
        self,
        channel_dir: Path,
        channel_id: str,
        channel_name: str,
        messages: List[Dict[str, Any]],
        thread_messages: Dict[str, List[Message]],
    ) -> None:
        """チャンネルメタデータを保存"""
        metadata = {
            "channel_id": channel_id,
            "channel_name": channel_name,
            "downloaded_at": datetime.now().isoformat(),
            "total_messages": len(messages),
            "total_threads": len(thread_messages),
            "date_range": {
                "oldest": datetime.fromtimestamp(
                    float(min(m["ts"] for m in messages))
                ).isoformat() if messages else None,
                "newest": datetime.fromtimestamp(
                    float(max(m["ts"] for m in messages))
                ).isoformat() if messages else None,
            },
        }
        FileHandler.write_json(channel_dir / "metadata.json", metadata)

    def _save_thread_index(
        self,
        channel_dir: Path,
        messages: List[Dict[str, Any]],
        thread_messages: Dict[str, List[Message]],
    ) -> None:
        """スレッド索引を保存"""
        index = []
        for msg in messages:
            if msg.get("reply_count", 0) > 0:
                thread_ts = msg["ts"]
                replies = thread_messages.get(thread_ts, [])
                participants = list(set(
                    r.user_name or r.user for r in replies if r.user
                ))
                index.append({
                    "thread_ts": thread_ts,
                    "first_message": (msg.get("text", ""))[:200],
                    "reply_count": msg.get("reply_count", 0),
                    "participants": participants,
                    "created_at": datetime.fromtimestamp(float(thread_ts)).isoformat(),
                })

        FileHandler.write_json(channel_dir / "index.json", index)
