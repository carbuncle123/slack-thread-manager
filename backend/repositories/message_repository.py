from pathlib import Path
from typing import Optional
from datetime import datetime

from models.message import MessageList, Message
from utils.file_handler import FileHandler
from utils.logger import get_logger

logger = get_logger(__name__)


class MessageRepository:
    """メッセージデータのデータアクセス層"""

    def __init__(self, data_dir: Path):
        self.data_dir = data_dir
        self.messages_dir = data_dir / "messages"
        FileHandler.ensure_dir(self.messages_dir)

    def _get_messages_path(self, thread_id: str) -> Path:
        """メッセージファイルのパスを取得"""
        return self.messages_dir / f"{thread_id}_messages.json"

    def get_by_thread_id(self, thread_id: str) -> Optional[MessageList]:
        """スレッドIDでメッセージ一覧を取得"""
        file_path = self._get_messages_path(thread_id)
        data = FileHandler.read_json(file_path)

        if data is None:
            return None

        return MessageList(**data)

    def save(self, message_list: MessageList) -> None:
        """メッセージ一覧を保存"""
        file_path = self._get_messages_path(message_list.thread_id)
        message_list.last_fetched_at = datetime.now()

        FileHandler.write_json(file_path, message_list.model_dump())
        logger.debug(f"Saved messages for thread: {message_list.thread_id}")

    def create_or_update(
        self,
        thread_id: str,
        channel_id: str,
        thread_ts: str,
        messages: list[Message]
    ) -> MessageList:
        """メッセージ一覧を作成または更新"""
        message_list = MessageList(
            thread_id=thread_id,
            channel_id=channel_id,
            thread_ts=thread_ts,
            messages=messages
        )

        self.save(message_list)
        logger.info(
            f"Saved {len(messages)} messages for thread: {thread_id}"
        )
        return message_list

    def delete(self, thread_id: str) -> bool:
        """メッセージ一覧を削除"""
        file_path = self._get_messages_path(thread_id)
        success = FileHandler.delete_file(file_path)

        if success:
            logger.info(f"Deleted messages for thread: {thread_id}")
        return success

    def get_new_messages_count(
        self,
        thread_id: str,
        since_ts: str
    ) -> int:
        """指定タイムスタンプ以降の新規メッセージ数を取得"""
        message_list = self.get_by_thread_id(thread_id)
        if message_list is None:
            return 0

        new_count = sum(
            1 for msg in message_list.messages
            if msg.ts > since_ts
        )
        return new_count
