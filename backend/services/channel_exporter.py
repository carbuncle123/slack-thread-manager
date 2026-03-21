import asyncio
import uuid
from pathlib import Path
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional, Tuple
from collections import defaultdict

from models.channel_export import (
    ChannelDownloadState,
    ClassificationConfig,
    ClassificationMatchRule,
    DownloadJobStatus,
)
from models.message import Message, Reaction
from repositories.channel_export_repository import ChannelExportRepository
from services.slack_client import SlackClient
from services.channel_rollup_builder import ChannelRollupBuilder
from utils.file_handler import FileHandler
from utils.logger import get_logger

logger = get_logger(__name__)

# 初回ダウンロード: 過去1年分
INITIAL_DOWNLOAD_DAYS = 365

# 初回ダウンロードのチャンクサイズ（日数）
CHUNK_DAYS = 30

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
        rollup_builder: Optional[ChannelRollupBuilder] = None,
    ):
        self.slack_client = slack_client
        self.export_repo = export_repo
        if export_dir:
            self.export_base_dir = Path(export_dir)
        else:
            self.export_base_dir = data_dir / "channel_exports"
        FileHandler.ensure_dir(self.export_base_dir)
        self.rollup_builder = rollup_builder or ChannelRollupBuilder(self.export_base_dir)

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

    def _build_chunks(self, state: ChannelDownloadState) -> List[tuple]:
        """ダウンロード対象の時間チャンクを構築する。

        初回: 過去INITIAL_DOWNLOAD_DAYS分を CHUNK_DAYS ごとに分割（新しい方から）。
              中断再開時は initial_fetch_oldest 以前の未取得分のみ。
        差分更新（initial_fetch_done=True）: last_message_ts から現在まで。
        """
        now = datetime.now()
        chunks: List[tuple] = []

        if state.initial_fetch_done:
            # 差分更新: 前回の最新メッセージから現在まで（1チャンク）
            oldest = state.last_message_ts or str(now.timestamp())
            chunks.append((oldest, str(now.timestamp())))
        else:
            # 初回ダウンロード: 月単位チャンクで遡る
            target_oldest = now - timedelta(days=INITIAL_DOWNLOAD_DAYS)

            # 中断再開: すでに取得済みの範囲より古い部分から再開
            if state.initial_fetch_oldest:
                chunk_end = datetime.fromisoformat(state.initial_fetch_oldest)
            else:
                chunk_end = now

            while chunk_end > target_oldest:
                chunk_start = max(chunk_end - timedelta(days=CHUNK_DAYS), target_oldest)
                chunks.append((str(chunk_start.timestamp()), str(chunk_end.timestamp())))
                chunk_end = chunk_start

        return chunks

    async def download_channel(
        self,
        channel_id: str,
        channel_name: str,
    ) -> ChannelDownloadState:
        """単一チャンネルをダウンロード（月単位チャンクで段階的に実行）"""
        state = self.export_repo.get_state(channel_id) or ChannelDownloadState(
            channel_id=channel_id,
            channel_name=channel_name,
        )
        state.status = "downloading"
        state.error_message = None
        self.export_repo.save_state(state)

        channel_dir = self._get_channel_dir(channel_id, channel_name)
        chunks = self._build_chunks(state)
        is_incremental = state.initial_fetch_done

        total_messages_in_session = 0
        total_threads_in_session = 0

        try:
            classification_config = self.export_repo.get_classification_config()

            for chunk_idx, (oldest, latest) in enumerate(chunks):
                logger.info(
                    f"[{channel_name}] chunk {chunk_idx + 1}/{len(chunks)}: "
                    f"{datetime.fromtimestamp(float(oldest)).strftime('%Y-%m-%d')} ~ "
                    f"{datetime.fromtimestamp(float(latest)).strftime('%Y-%m-%d')}"
                )

                # メッセージ取得
                chunk_messages = await self._fetch_all_messages(channel_id, oldest, latest)
                if not chunk_messages:
                    # 初回チャンクの進捗を保存して次へ
                    if not is_incremental:
                        state.initial_fetch_oldest = datetime.fromtimestamp(float(oldest)).isoformat()
                        self.export_repo.save_state(state)
                    continue

                # スレッド返信を取得
                thread_messages: Dict[str, List[Message]] = {}
                for msg in chunk_messages:
                    if msg.get("reply_count", 0) <= 0:
                        continue
                    thread_ts = msg["ts"]

                    # 差分更新時は、前回DL以降に返信があったスレッドのみ取得
                    if is_incremental and state.last_message_ts:
                        latest_reply = msg.get("latest_reply", "")
                        if latest_reply and float(latest_reply) <= float(state.last_message_ts):
                            continue

                    replies = await self._fetch_thread_replies(channel_id, thread_ts)
                    if replies:
                        thread_messages[thread_ts] = replies
                    await asyncio.sleep(RATE_LIMIT_INTERVAL)

                # チャンクのファイル出力（追記/上書き）
                await self._save_json(
                    channel_dir=channel_dir,
                    messages=chunk_messages,
                    thread_messages=thread_messages,
                    channel_id=channel_id,
                    channel_name=channel_name,
                    classification_config=classification_config,
                )
                await self._save_markdown(channel_dir, chunk_messages, thread_messages, channel_name)

                total_messages_in_session += len(chunk_messages)
                total_threads_in_session += len(thread_messages)

                # チャンクごとに進捗を保存（中断再開可能に）
                newest_ts = max(msg["ts"] for msg in chunk_messages)
                if not state.last_message_ts or float(newest_ts) > float(state.last_message_ts):
                    state.last_message_ts = newest_ts

                if not is_incremental:
                    state.initial_fetch_oldest = datetime.fromtimestamp(float(oldest)).isoformat()

                state.total_messages_downloaded += len(chunk_messages)
                state.total_threads_downloaded += len(thread_messages)
                state.last_downloaded_at = datetime.now().isoformat()
                self.export_repo.save_state(state)

                logger.info(
                    f"[{channel_name}] chunk {chunk_idx + 1} done: "
                    f"{len(chunk_messages)} messages, {len(thread_messages)} threads"
                )

            # 初回DL完了
            if not is_incremental:
                state.initial_fetch_done = True

            # メタデータ・索引は全チャンク完了後にローカルファイルから再構築
            if total_messages_in_session > 0:
                all_local_messages = self._load_all_local_messages(channel_dir)
                all_thread_messages = self._load_all_local_threads(channel_dir)

                if all_local_messages:
                    self._save_metadata(channel_dir, channel_id, channel_name, all_local_messages, all_thread_messages)
                    self._save_thread_index(channel_dir, all_local_messages, all_thread_messages)
                    self.rollup_builder.rebuild_rollups()

            state.status = "completed"
            self.export_repo.save_state(state)

            logger.info(
                f"Channel {channel_name} download completed: "
                f"{total_messages_in_session} messages, {total_threads_in_session} threads in this session"
            )
            return state

        except Exception as e:
            state.status = "error"
            state.error_message = str(e)
            self.export_repo.save_state(state)
            logger.error(f"Failed to download channel {channel_name}: {e}")
            return state

    def _load_all_local_messages(self, channel_dir: Path) -> List[Dict[str, Any]]:
        """ローカルに保存済みの日別JSONからメッセージ一覧を構築"""
        messages_dir = channel_dir / "messages"
        all_messages: List[Dict[str, Any]] = []

        if not messages_dir.exists():
            return all_messages

        for json_file in sorted(messages_dir.rglob("*.json")):
            data = FileHandler.read_json(json_file)
            if data and "messages" in data:
                all_messages.extend(data["messages"])

        all_messages.sort(key=lambda m: float(m["ts"]))
        return all_messages

    def _load_all_local_threads(self, channel_dir: Path) -> Dict[str, List[Message]]:
        """ローカルに保存済みのスレッドJSONからスレッド返信を構築"""
        threads_dir = channel_dir / "threads"
        thread_messages: Dict[str, List[Message]] = {}

        if not threads_dir.exists():
            return thread_messages

        for thread_file in threads_dir.glob("*.json"):
            thread_data = FileHandler.read_json(thread_file)
            if not thread_data:
                continue
            ts = thread_data.get("thread_ts", "")
            msgs: List[Message] = []
            parent_data = thread_data.get("parent_message")
            if parent_data:
                msgs.append(Message(**parent_data))
            for r in thread_data.get("replies", []):
                msgs.append(Message(**r))
            if msgs:
                thread_messages[ts] = msgs

        return thread_messages

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
        classification_config: ClassificationConfig,
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
            project_ids, account_ids = self._classify_message(
                msg=msg,
                channel_id=channel_id,
                classification_config=classification_config,
            )

            msg_data = {
                "ts": msg["ts"],
                "channel_id": channel_id,
                "user": user_id,
                "user_name": user_name,
                "text": msg.get("text", ""),
                "thread_ts": msg.get("thread_ts"),
                "reply_count": msg.get("reply_count", 0),
                "project_ids": project_ids,
                "account_ids": account_ids,
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
            day_path = day_dir / f"{date_str}.json"

            existing_data = FileHandler.read_json(day_path) or {}
            existing_messages = existing_data.get("messages", []) if isinstance(existing_data, dict) else []
            merged_messages = self._merge_messages_by_ts(existing_messages, day_messages)

            FileHandler.write_json(day_path, {
                "channel_id": channel_id,
                "channel_name": channel_name,
                "date": date_str,
                "messages": merged_messages,
            })

        # スレッドJSONファイルを保存
        FileHandler.ensure_dir(threads_dir)
        for thread_ts, replies in thread_messages.items():
            parent = next((r for r in replies if r.ts == thread_ts), None)
            thread_project_ids: List[str] = []
            thread_account_ids: List[str] = []
            for reply in replies:
                p_ids, a_ids = self._classify_message(
                    msg={
                        "user": reply.user,
                        "text": reply.text,
                    },
                    channel_id=channel_id,
                    classification_config=classification_config,
                )
                thread_project_ids.extend(p_ids)
                thread_account_ids.extend(a_ids)
            thread_data = {
                "channel_id": channel_id,
                "thread_ts": thread_ts,
                "parent_message": parent.model_dump(mode="json") if parent else None,
                "replies": [r.model_dump(mode="json") for r in replies if r.ts != thread_ts],
                "reply_count": len(replies) - 1,
                "participants": list(set(
                    r.user_name or r.user for r in replies if r.user
                )),
                "project_ids": self._dedupe_ids(thread_project_ids),
                "account_ids": self._dedupe_ids(thread_account_ids),
            }
            FileHandler.write_json(threads_dir / f"{thread_ts}.json", thread_data)

    def _merge_messages_by_ts(
        self,
        existing_messages: List[Dict[str, Any]],
        incoming_messages: List[Dict[str, Any]],
    ) -> List[Dict[str, Any]]:
        """日別メッセージをtsキーでマージし、時系列順で返す"""
        merged: Dict[str, Dict[str, Any]] = {}

        for msg in existing_messages:
            ts = msg.get("ts")
            if ts:
                merged[ts] = msg

        # incomingを後勝ちにして同一tsを更新
        for msg in incoming_messages:
            ts = msg.get("ts")
            if ts:
                merged[ts] = msg

        return sorted(merged.values(), key=lambda m: float(m["ts"]))

    def _classify_message(
        self,
        msg: Dict[str, Any],
        channel_id: str,
        classification_config: ClassificationConfig,
    ) -> Tuple[List[str], List[str]]:
        """メッセージをproject/accountに分類"""
        project_ids = self._resolve_match_ids(
            msg=msg,
            channel_id=channel_id,
            rules=[p.match for p in classification_config.projects],
            rule_ids=[p.id for p in classification_config.projects],
            default_ids=classification_config.defaults.project_ids,
        )
        account_ids = self._resolve_match_ids(
            msg=msg,
            channel_id=channel_id,
            rules=[a.match for a in classification_config.accounts],
            rule_ids=[a.id for a in classification_config.accounts],
            default_ids=classification_config.defaults.account_ids,
        )
        return project_ids, account_ids

    def _resolve_match_ids(
        self,
        msg: Dict[str, Any],
        channel_id: str,
        rules: List[ClassificationMatchRule],
        rule_ids: List[str],
        default_ids: List[str],
    ) -> List[str]:
        matched_ids: List[str] = []
        for idx, rule in enumerate(rules):
            if self._matches_rule(msg=msg, channel_id=channel_id, rule=rule):
                matched_ids.append(rule_ids[idx])

        if matched_ids:
            return self._dedupe_ids(matched_ids)
        return self._dedupe_ids(default_ids)

    def _matches_rule(
        self,
        msg: Dict[str, Any],
        channel_id: str,
        rule: ClassificationMatchRule,
    ) -> bool:
        user_id = (msg.get("user") or "").strip()
        text = msg.get("text") or ""
        text_lower = text.lower()

        has_conditions = bool(rule.channels or rule.users or rule.keywords)
        if not has_conditions:
            return False

        if channel_id and channel_id in rule.channels:
            return True
        if user_id and user_id in rule.users:
            return True

        for keyword in rule.keywords:
            keyword_normalized = keyword.strip().lower()
            if keyword_normalized and keyword_normalized in text_lower:
                return True

        return False

    def _dedupe_ids(self, values: List[str]) -> List[str]:
        deduped: List[str] = []
        seen = set()
        for value in values:
            normalized = (value or "").strip()
            if not normalized or normalized in seen:
                continue
            seen.add(normalized)
            deduped.append(normalized)
        return deduped

    async def _save_markdown(
        self,
        channel_dir: Path,
        messages: List[Dict[str, Any]],
        thread_messages: Dict[str, List[Message]],
        channel_name: str,
    ) -> None:
        """Markdown形式でメッセージを日別に保存（JSONをソースに再構築）"""
        messages_dir = channel_dir / "messages"
        threads_dir = channel_dir / "threads"

        # このチャンクで影響のあった日だけ再構築する
        affected_dates: Dict[str, str] = {}
        for msg in messages:
            ts = float(msg["ts"])
            date_str = datetime.fromtimestamp(ts).strftime("%Y-%m-%d")
            month_str = datetime.fromtimestamp(ts).strftime("%Y-%m")
            affected_dates[date_str] = month_str

        # 日別Markdownファイルを保存
        for date_str, month_str in sorted(affected_dates.items()):
            day_dir = messages_dir / month_str
            FileHandler.ensure_dir(day_dir)
            day_json_path = day_dir / f"{date_str}.json"
            day_data = FileHandler.read_json(day_json_path) or {}
            day_messages = day_data.get("messages", []) if isinstance(day_data, dict) else []
            day_messages = sorted(day_messages, key=lambda m: float(m["ts"]))

            md_lines = [f"# #{channel_name} - {date_str}\n"]

            for msg in day_messages:
                ts = float(msg["ts"])
                time_str = datetime.fromtimestamp(ts).strftime("%H:%M")
                user_name = msg.get("user_name") or msg.get("user") or "unknown"
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
                replies = self._get_thread_messages_for_markdown(
                    thread_ts=thread_ts,
                    thread_messages=thread_messages,
                    threads_dir=threads_dir,
                )
                if replies:
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

    def _get_thread_messages_for_markdown(
        self,
        thread_ts: Optional[str],
        thread_messages: Dict[str, List[Message]],
        threads_dir: Path,
    ) -> List[Message]:
        """Markdown描画用にスレッドメッセージを取得（メモリ優先、なければJSONから復元）"""
        if not thread_ts:
            return []

        if thread_ts in thread_messages:
            return thread_messages[thread_ts]

        thread_path = threads_dir / f"{thread_ts}.json"
        thread_data = FileHandler.read_json(thread_path)
        if not thread_data:
            return []

        replies: List[Message] = []
        parent_data = thread_data.get("parent_message")
        if parent_data:
            replies.append(Message(**parent_data))
        for reply_data in thread_data.get("replies", []):
            replies.append(Message(**reply_data))

        return replies

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
                    "project_ids": msg.get("project_ids", []),
                    "account_ids": msg.get("account_ids", []),
                    "created_at": datetime.fromtimestamp(float(thread_ts)).isoformat(),
                })

        FileHandler.write_json(channel_dir / "index.json", index)
