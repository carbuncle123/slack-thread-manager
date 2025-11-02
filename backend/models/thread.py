from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field


class ThreadSummary(BaseModel):
    """スレッドの要約情報"""
    topic: str = ""
    generated_at: Optional[datetime] = None


class Thread(BaseModel):
    """スレッド情報モデル"""
    id: str
    channel_id: str
    thread_ts: str
    title: str
    url: str
    tags: List[str] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime
    last_message_ts: Optional[str] = None
    message_count: int = 0
    new_message_count: int = 0
    is_read: bool = True
    has_daily_summary: bool = False
    has_topic_summary: bool = False
    summary: ThreadSummary = Field(default_factory=ThreadSummary)

    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat() if v else None
        }


class ThreadCreate(BaseModel):
    """スレッド作成リクエスト"""
    channel_id: str
    thread_ts: str
    title: str
    tags: List[str] = Field(default_factory=list)


class ThreadUpdate(BaseModel):
    """スレッド更新リクエスト"""
    title: Optional[str] = None
    tags: Optional[List[str]] = None
    is_read: Optional[bool] = None
