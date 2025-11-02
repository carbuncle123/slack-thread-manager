"""要約生成サービス"""
from datetime import datetime
from typing import List, Dict, Any
from collections import defaultdict

from models.summary import ThreadSummary, DailySummaryItem, TopicSummaryItem
from services.chatgpt_client import ChatGPTClient
from repositories.summary_repository import SummaryRepository
from repositories.message_repository import MessageRepository
from repositories.thread_repository import ThreadRepository
from utils.logger import setup_logger

logger = setup_logger(__name__)


class SummaryGenerator:
    """スレッドの要約を生成・管理"""

    def __init__(
        self,
        chatgpt_client: ChatGPTClient,
        summary_repo: SummaryRepository,
        message_repo: MessageRepository,
        thread_repo: ThreadRepository
    ):
        self.chatgpt = chatgpt_client
        self.summary_repo = summary_repo
        self.message_repo = message_repo
        self.thread_repo = thread_repo

    async def generate_summary(self, thread_id: str, force_regenerate: bool = False) -> ThreadSummary:
        """
        スレッドの要約を生成

        Args:
            thread_id: スレッドID
            force_regenerate: 既存の要約を無視して再生成

        Returns:
            生成された要約
        """
        logger.info(f"要約生成開始: thread_id={thread_id}, force={force_regenerate}")

        # スレッド存在確認
        thread = self.thread_repo.get_by_id(thread_id)
        if not thread:
            raise ValueError(f"スレッドが見つかりません: {thread_id}")

        # メッセージ取得
        message_list = self.message_repo.get_by_thread_id(thread_id)
        if not message_list or not message_list.messages:
            raise ValueError(f"このスレッドにはメッセージがありません。Slackから同期してください。")

        messages = message_list.messages
        logger.info(f"メッセージ取得: {len(messages)}件")

        # 既存の要約確認
        if not force_regenerate:
            existing_summary = self.summary_repo.get(thread_id)
            if existing_summary and existing_summary.message_count_at_summary == len(messages):
                logger.info("既存の要約を使用")
                return existing_summary

        # メッセージをdict形式に変換
        messages_dict = [msg.model_dump() for msg in messages]

        # 1. 概要生成
        logger.info("概要生成中...")
        overview_data = await self.chatgpt.generate_overview(messages_dict)

        # 2. トピック別要約生成
        logger.info("トピック別要約生成中...")
        topic_data = await self.chatgpt.generate_topic_summary(messages_dict)

        # 3. 日次要約生成
        logger.info("日次要約生成中...")
        daily_data = await self.chatgpt.generate_daily_summary(messages_dict)

        # 要約データの構築
        topic_summaries = []
        for topic in topic_data.get("topics", []):
            topic_summaries.append(TopicSummaryItem(
                topic_name=topic.get("topic_name", ""),
                status=topic.get("status", "議論中"),
                summary=topic.get("summary", ""),
                conclusion=topic.get("conclusion"),
                related_message_timestamps=[],
                participants=topic.get("participants", [])
            ))

        daily_summaries = []
        for daily in daily_data.get("daily_summaries", []):
            daily_summaries.append(DailySummaryItem(
                date=daily.get("date", ""),
                message_count=daily.get("message_count", 0),
                summary=daily.get("summary", ""),
                key_points=daily.get("key_points", []),
                participants=daily.get("participants", [])
            ))

        # ThreadSummary作成
        summary = ThreadSummary(
            thread_id=thread_id,
            topic=overview_data.get("topic", "議論"),
            overview=overview_data.get("overview", ""),
            daily_summaries=daily_summaries,
            topic_summaries=topic_summaries,
            last_updated=datetime.now(),
            message_count_at_summary=len(messages)
        )

        # 保存
        self.summary_repo.save(summary)

        # スレッドの summary.topic を更新
        thread.summary.topic = summary.topic
        self.thread_repo.save(thread)

        logger.info(f"要約生成完了: thread_id={thread_id}")

        return summary

    async def get_summary(self, thread_id: str) -> ThreadSummary:
        """
        要約を取得（存在しない場合は生成）

        Args:
            thread_id: スレッドID

        Returns:
            要約
        """
        summary = self.summary_repo.get(thread_id)

        if summary is None:
            logger.info(f"要約が存在しないため生成します: {thread_id}")
            summary = await self.generate_summary(thread_id)

        return summary

    def delete_summary(self, thread_id: str) -> bool:
        """
        要約を削除

        Args:
            thread_id: スレッドID

        Returns:
            削除成功したか
        """
        return self.summary_repo.delete(thread_id)
