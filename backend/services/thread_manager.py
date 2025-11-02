from pathlib import Path
from typing import List, Optional
from datetime import datetime

from models.thread import Thread, ThreadCreate, ThreadUpdate
from models.message import Message
from repositories.thread_repository import ThreadRepository
from repositories.message_repository import MessageRepository
from services.slack_client import SlackClient
from utils.logger import get_logger

logger = get_logger(__name__)


class ThreadManager:
    """スレッド管理サービス"""

    def __init__(
        self,
        thread_repo: ThreadRepository,
        message_repo: MessageRepository,
        slack_client: SlackClient
    ):
        self.thread_repo = thread_repo
        self.message_repo = message_repo
        self.slack_client = slack_client

    def get_all_threads(self) -> List[Thread]:
        """全スレッドを取得"""
        return self.thread_repo.get_all()

    def get_thread_by_id(self, thread_id: str) -> Optional[Thread]:
        """IDでスレッドを取得"""
        return self.thread_repo.get_by_id(thread_id)

    def create_thread(self, thread_create: ThreadCreate) -> Thread:
        """新しいスレッドを作成"""
        return self.thread_repo.create(thread_create)

    def update_thread(
        self,
        thread_id: str,
        thread_update: ThreadUpdate
    ) -> Optional[Thread]:
        """スレッドを更新"""
        return self.thread_repo.update(thread_id, thread_update)

    def delete_thread(self, thread_id: str) -> bool:
        """スレッドを削除 (メッセージデータも削除)"""
        # メッセージデータを削除
        self.message_repo.delete(thread_id)

        # スレッド情報を削除
        return self.thread_repo.delete(thread_id)

    def mark_thread_as_read(self, thread_id: str) -> Optional[Thread]:
        """スレッドを既読にする"""
        return self.thread_repo.mark_as_read(thread_id)

    async def sync_thread_messages(self, thread_id: str) -> dict:
        """スレッドのメッセージをSlackから同期"""
        logger.info(f"Syncing messages for thread: {thread_id}")

        # スレッド情報を取得
        thread = self.thread_repo.get_by_id(thread_id)
        if thread is None:
            raise ValueError(f"Thread not found: {thread_id}")

        # 既存のメッセージデータを取得
        existing_messages = self.message_repo.get_by_thread_id(thread_id)
        last_ts = thread.last_message_ts if thread.last_message_ts else thread.thread_ts

        try:
            # Slackからメッセージを取得
            messages = await self.slack_client.get_thread_messages(
                thread.channel_id,
                thread.thread_ts
            )

            # 新規メッセージをカウント
            new_messages = [msg for msg in messages if msg.ts > last_ts]
            new_message_count = len(new_messages)

            # メッセージを保存
            self.message_repo.create_or_update(
                thread_id=thread.id,
                channel_id=thread.channel_id,
                thread_ts=thread.thread_ts,
                messages=messages
            )

            # スレッドの統計情報を更新
            latest_ts = messages[-1].ts if messages else thread.thread_ts
            self.thread_repo.update_message_stats(
                thread_id=thread.id,
                message_count=len(messages),
                new_message_count=new_message_count,
                last_message_ts=latest_ts
            )

            logger.info(
                f"Synced {len(messages)} messages "
                f"({new_message_count} new) for thread: {thread_id}"
            )

            return {
                "thread_id": thread_id,
                "total_messages": len(messages),
                "new_messages": new_message_count,
                "synced_at": datetime.now().isoformat()
            }

        except Exception as e:
            logger.error(f"Failed to sync thread {thread_id}: {e}")
            raise

    async def sync_all_threads(self) -> dict:
        """全スレッドを同期"""
        logger.info("Syncing all threads")

        threads = self.thread_repo.get_all()
        results = {
            "total_threads": len(threads),
            "synced": 0,
            "failed": 0,
            "new_messages_total": 0,
            "errors": []
        }

        for thread in threads:
            try:
                sync_result = await self.sync_thread_messages(thread.id)
                results["synced"] += 1
                results["new_messages_total"] += sync_result["new_messages"]
            except Exception as e:
                results["failed"] += 1
                results["errors"].append({
                    "thread_id": thread.id,
                    "error": str(e)
                })
                logger.error(f"Failed to sync thread {thread.id}: {e}")

        logger.info(
            f"Sync completed: {results['synced']} succeeded, "
            f"{results['failed']} failed"
        )
        return results

    def get_thread_messages(self, thread_id: str) -> Optional[List[Message]]:
        """スレッドのメッセージを取得"""
        message_list = self.message_repo.get_by_thread_id(thread_id)
        if message_list is None:
            return None
        return message_list.messages

    def filter_threads(
        self,
        tags: Optional[List[str]] = None,
        is_read: Optional[bool] = None,
        search: Optional[str] = None
    ) -> List[Thread]:
        """スレッドをフィルタリング"""
        threads = self.thread_repo.get_all()

        # タグフィルタ
        if tags:
            threads = [
                t for t in threads
                if any(tag in t.tags for tag in tags)
            ]

        # 既読/未読フィルタ
        if is_read is not None:
            threads = [t for t in threads if t.is_read == is_read]

        # 検索フィルタ (タイトル、要約)
        if search:
            search_lower = search.lower()
            threads = [
                t for t in threads
                if search_lower in t.title.lower() or
                   search_lower in t.summary.topic.lower()
            ]

        return threads

    def sort_threads(
        self,
        threads: List[Thread],
        sort_by: str = "updated_at",
        sort_order: str = "desc"
    ) -> List[Thread]:
        """スレッドをソート"""
        reverse = (sort_order == "desc")

        if sort_by == "title":
            return sorted(threads, key=lambda t: t.title, reverse=reverse)
        elif sort_by == "created_at":
            return sorted(threads, key=lambda t: t.created_at, reverse=reverse)
        elif sort_by == "updated_at":
            return sorted(threads, key=lambda t: t.updated_at, reverse=reverse)
        else:
            return threads
