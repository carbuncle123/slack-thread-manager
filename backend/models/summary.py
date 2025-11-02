"""要約データモデル"""
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime


class DailySummaryItem(BaseModel):
    """日次要約の1日分のデータ"""
    date: str  # YYYY-MM-DD形式
    message_count: int
    summary: str
    key_points: List[str] = Field(default_factory=list)
    participants: List[str] = Field(default_factory=list)


class TopicSummaryItem(BaseModel):
    """トピック別要約の1トピック分のデータ"""
    topic_name: str
    status: str  # "議論中", "解決済み", "保留中", etc.
    summary: str
    conclusion: Optional[str] = None
    related_message_timestamps: List[str] = Field(default_factory=list)
    participants: List[str] = Field(default_factory=list)


class ThreadSummary(BaseModel):
    """スレッド全体の要約データ"""
    thread_id: str
    topic: str  # スレッド全体のトピック（一言で）
    overview: str  # スレッド全体の概要（2-3行）
    daily_summaries: List[DailySummaryItem] = Field(default_factory=list)
    topic_summaries: List[TopicSummaryItem] = Field(default_factory=list)
    last_updated: datetime
    message_count_at_summary: int  # 要約生成時のメッセージ数

    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }


class SummaryGenerationRequest(BaseModel):
    """要約生成リクエスト"""
    thread_id: str
    force_regenerate: bool = False  # 既存の要約を無視して再生成


class SummaryResponse(BaseModel):
    """要約レスポンス"""
    success: bool
    summary: Optional[ThreadSummary] = None
    message: str
