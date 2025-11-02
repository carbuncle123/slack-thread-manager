from typing import List
from datetime import datetime, timedelta

from models.discover import DiscoveredThread
from models.config import MonitoredChannel
from services.slack_client import SlackClient
from repositories.thread_repository import ThreadRepository
from repositories.config_repository import ConfigRepository
from utils.logger import get_logger

logger = get_logger(__name__)


class ThreadDiscoveryService:
    """新規スレッド発見サービス"""

    def __init__(
        self,
        slack_client: SlackClient,
        thread_repo: ThreadRepository,
        config_repo: ConfigRepository
    ):
        self.slack_client = slack_client
        self.thread_repo = thread_repo
        self.config_repo = config_repo

    async def discover_threads(
        self,
        channel_ids: List[str] = None,
        days: int = 7
    ) -> List[DiscoveredThread]:
        """新規スレッドを発見"""
        logger.info(f"Starting thread discovery for past {days} days")

        # 設定から監視チャンネルを取得
        config = self.config_repo.get_or_create_default()
        monitored_channels = config.slack.monitored_channels

        # チャンネルIDが指定されている場合はフィルタリング
        if channel_ids:
            monitored_channels = [
                ch for ch in monitored_channels
                if ch.channel_id in channel_ids
            ]

        if not monitored_channels:
            logger.warning("No monitored channels configured")
            return []

        # 既存の登録済みスレッドを取得
        existing_threads = self.thread_repo.get_all()
        existing_thread_keys = {
            (t.channel_id, t.thread_ts) for t in existing_threads
        }

        discovered = []

        # 各チャンネルで検索
        for channel in monitored_channels:
            logger.info(f"Searching in channel: {channel.channel_name}")

            # メンションユーザーで検索
            for user_id in channel.mention_users:
                threads = await self._find_by_mention(
                    channel, user_id, days
                )
                for thread_data in threads:
                    key = (thread_data["channel_id"], thread_data["thread_ts"])
                    if key not in existing_thread_keys:
                        discovered.append(self._create_discovered_thread(
                            thread_data,
                            channel.channel_name,
                            "mention",
                            user_id
                        ))
                        existing_thread_keys.add(key)

            # キーワードで検索
            for keyword in channel.keywords:
                threads = await self._find_by_keyword(
                    channel, keyword, days
                )
                for thread_data in threads:
                    key = (thread_data["channel_id"], thread_data["thread_ts"])
                    if key not in existing_thread_keys:
                        discovered.append(self._create_discovered_thread(
                            thread_data,
                            channel.channel_name,
                            "keyword",
                            keyword
                        ))
                        existing_thread_keys.add(key)

        logger.info(f"Discovered {len(discovered)} new threads")
        return discovered

    async def _find_by_mention(
        self,
        channel: MonitoredChannel,
        user_id: str,
        days: int
    ) -> List[dict]:
        """メンションを含むスレッドを検索"""
        try:
            threads = await self.slack_client.find_threads_with_mention(
                channel.channel_id,
                user_id,
                days
            )
            return threads
        except Exception as e:
            logger.error(f"Failed to find threads by mention: {e}")
            return []

    async def _find_by_keyword(
        self,
        channel: MonitoredChannel,
        keyword: str,
        days: int
    ) -> List[dict]:
        """キーワードを含むスレッドを検索"""
        try:
            # search.messagesでキーワード検索
            query = f"in:<#{channel.channel_id}> {keyword}"
            matches = await self.slack_client.search_messages(query, count=100)

            # スレッドの親メッセージのみを抽出
            threads = []
            seen_threads = set()

            for match in matches:
                # スレッドのタイムスタンプを取得
                thread_ts = match.get("thread_ts") or match.get("ts")

                if thread_ts not in seen_threads:
                    seen_threads.add(thread_ts)
                    threads.append({
                        "channel_id": match.get("channel", {}).get("id", channel.channel_id),
                        "thread_ts": thread_ts,
                        "text": match.get("text", ""),
                        "user": match.get("user", ""),
                        "ts": match.get("ts")
                    })

            logger.info(f"Found {len(threads)} threads with keyword '{keyword}'")
            return threads

        except Exception as e:
            logger.error(f"Failed to find threads by keyword: {e}")
            return []

    def _create_discovered_thread(
        self,
        thread_data: dict,
        channel_name: str,
        matched_condition: str,
        matched_value: str
    ) -> DiscoveredThread:
        """DiscoveredThreadオブジェクトを作成"""
        channel_id = thread_data.get("channel_id", "")
        thread_ts = thread_data.get("thread_ts", "")

        # URLを生成
        workspace = self.config_repo.get_or_create_default().slack.workspace
        url = f"https://{workspace}.slack.com/archives/{channel_id}/p{thread_ts.replace('.', '')}"

        # タイムスタンプから日時を取得
        try:
            created_at = datetime.fromtimestamp(float(thread_ts))
        except:
            created_at = datetime.now()

        return DiscoveredThread(
            channel_id=channel_id,
            channel_name=channel_name,
            thread_ts=thread_ts,
            first_message_text=thread_data.get("text", "")[:200],  # 最初の200文字
            first_message_user=thread_data.get("user", ""),
            first_message_user_name=None,  # 後で取得可能
            created_at=created_at.isoformat(),
            message_count=1,  # 実際のカウントは別途取得が必要
            url=url,
            matched_condition=matched_condition,
            matched_value=matched_value
        )
