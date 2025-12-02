from pathlib import Path
from typing import List, Optional
from datetime import datetime
import uuid

from models.thread import Thread, ThreadCreate, ThreadUpdate
from utils.file_handler import FileHandler
from utils.logger import get_logger

logger = get_logger(__name__)


class ThreadRepository:
    """スレッド情報のデータアクセス層"""

    def __init__(self, data_dir: Path):
        self.data_dir = data_dir
        self.threads_dir = data_dir / "threads"
        FileHandler.ensure_dir(self.threads_dir)

    def _get_thread_path(self, thread_id: str) -> Path:
        """スレッドファイルのパスを取得"""
        return self.threads_dir / f"{thread_id}.json"

    def _generate_thread_id(self) -> str:
        """新しいスレッドIDを生成"""
        return f"thread_{uuid.uuid4().hex[:8]}"

    def get_all(self) -> List[Thread]:
        """全スレッドを取得"""
        threads = []
        for file_path in FileHandler.list_files(self.threads_dir):
            try:
                data = FileHandler.read_json(file_path)
                if data:
                    threads.append(Thread(**data))
            except Exception as e:
                logger.error(f"Failed to load thread from {file_path}: {e}")

        return threads

    def get_by_id(self, thread_id: str) -> Optional[Thread]:
        """IDでスレッドを取得"""
        file_path = self._get_thread_path(thread_id)
        data = FileHandler.read_json(file_path)

        if data is None:
            return None

        return Thread(**data)

    def get_by_channel_and_ts(self, channel_id: str, thread_ts: str) -> Optional[Thread]:
        """チャンネルIDとスレッドタイムスタンプでスレッドを取得"""
        for thread in self.get_all():
            if thread.channel_id == channel_id and thread.thread_ts == thread_ts:
                return thread
        return None

    def create(self, thread_create: ThreadCreate) -> Thread:
        """新しいスレッドを作成"""
        # 既に存在するかチェック
        existing = self.get_by_channel_and_ts(
            thread_create.channel_id,
            thread_create.thread_ts
        )
        if existing:
            raise ValueError(
                f"Thread already exists: {thread_create.channel_id}/{thread_create.thread_ts}"
            )

        # スレッドURLを生成
        url = f"https://slack.com/archives/{thread_create.channel_id}/p{thread_create.thread_ts.replace('.', '')}"

        now = datetime.now()
        thread = Thread(
            id=self._generate_thread_id(),
            channel_id=thread_create.channel_id,
            thread_ts=thread_create.thread_ts,
            title=thread_create.title,
            url=url,
            tags=thread_create.tags,
            created_at=now,
            updated_at=now,
        )

        self.save(thread)
        logger.info(f"Created thread: {thread.id} - {thread.title}")
        return thread

    def save(self, thread: Thread) -> None:
        """スレッドを保存"""
        file_path = self._get_thread_path(thread.id)
        thread.updated_at = datetime.now()

        FileHandler.write_json(file_path, thread.model_dump())
        logger.debug(f"Saved thread: {thread.id}")

    def update(self, thread_id: str, thread_update: ThreadUpdate) -> Optional[Thread]:
        """スレッドを更新"""
        thread = self.get_by_id(thread_id)
        if thread is None:
            return None

        # 更新可能なフィールドのみ更新
        if thread_update.title is not None:
            thread.title = thread_update.title
        if thread_update.tags is not None:
            thread.tags = thread_update.tags
        if thread_update.is_read is not None:
            thread.is_read = thread_update.is_read
        if thread_update.is_archived is not None:
            thread.is_archived = thread_update.is_archived
        if thread_update.summary_topic is not None:
            thread.summary.topic = thread_update.summary_topic
            thread.summary.generated_at = datetime.now()

        thread.updated_at = datetime.now()
        self.save(thread)
        logger.info(f"Updated thread: {thread_id}")
        return thread

    def delete(self, thread_id: str) -> bool:
        """スレッドを削除"""
        file_path = self._get_thread_path(thread_id)
        success = FileHandler.delete_file(file_path)

        if success:
            logger.info(f"Deleted thread: {thread_id}")
        return success

    def mark_as_read(self, thread_id: str) -> Optional[Thread]:
        """スレッドを既読にする"""
        thread = self.get_by_id(thread_id)
        if thread is None:
            return None

        thread.is_read = True
        thread.new_message_count = 0
        self.save(thread)
        logger.info(f"Marked thread as read: {thread_id}")
        return thread

    def update_message_stats(
        self,
        thread_id: str,
        message_count: int,
        new_message_count: int,
        last_message_ts: str
    ) -> Optional[Thread]:
        """メッセージ統計を更新"""
        thread = self.get_by_id(thread_id)
        if thread is None:
            return None

        thread.message_count = message_count
        thread.new_message_count = new_message_count
        thread.last_message_ts = last_message_ts

        if new_message_count > 0:
            thread.is_read = False

        self.save(thread)
        return thread
