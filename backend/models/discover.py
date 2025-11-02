from typing import List
from pydantic import BaseModel


class DiscoveredThread(BaseModel):
    """発見されたスレッド"""
    channel_id: str
    channel_name: str
    thread_ts: str
    first_message_text: str
    first_message_user: str
    first_message_user_name: str | None = None
    created_at: str
    message_count: int
    url: str
    matched_condition: str  # "mention" or "keyword"
    matched_value: str  # メンションユーザーIDまたはキーワード


class DiscoverRequest(BaseModel):
    """新規スレッド発見リクエスト"""
    channel_ids: List[str] = []  # 空の場合は全監視チャンネル
    days: int = 7  # 過去何日間を検索するか


class DiscoverResponse(BaseModel):
    """新規スレッド発見レスポンス"""
    discovered_threads: List[DiscoveredThread]
    total_count: int
    searched_channels: List[str]


class RegisterThreadsRequest(BaseModel):
    """スレッド一括登録リクエスト"""
    threads: List[dict]  # {"channel_id": str, "thread_ts": str, "title": str, "tags": List[str]}


class RegisterThreadsResponse(BaseModel):
    """スレッド一括登録レスポンス"""
    success: bool
    registered_count: int
    failed_count: int
    errors: List[str] = []
