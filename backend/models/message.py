from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field


class Reaction(BaseModel):
    """リアクション情報"""
    name: str
    count: int


class Message(BaseModel):
    """メッセージモデル"""
    ts: str
    user: str
    user_name: Optional[str] = None
    text: str
    reactions: List[Reaction] = Field(default_factory=list)
    files: List[dict] = Field(default_factory=list)
    created_at: datetime

    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat() if v else None
        }


class MessageList(BaseModel):
    """スレッドのメッセージ一覧"""
    thread_id: str
    channel_id: str
    thread_ts: str
    messages: List[Message] = Field(default_factory=list)
    last_fetched_at: Optional[datetime] = None

    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat() if v else None
        }
