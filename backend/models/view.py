from typing import Optional, List
from pydantic import BaseModel, Field


class ViewFilters(BaseModel):
    """ビューのフィルタ条件"""
    tags: List[str] = Field(default_factory=list)
    is_read: Optional[bool] = None  # True: 既読, False: 未読, None: すべて
    search: str = ""
    date_from: Optional[str] = None  # ISO 8601形式
    date_to: Optional[str] = None  # ISO 8601形式
    has_new_messages: bool = False


class ViewSort(BaseModel):
    """ビューのソート条件"""
    sort_by: str = "updated_at"  # title, message_count, updated_at, created_at
    sort_order: str = "desc"  # asc, desc


class ThreadView(BaseModel):
    """スレッドビュー"""
    id: str
    name: str
    description: Optional[str] = None
    is_default: bool = False
    filters: ViewFilters = Field(default_factory=ViewFilters)
    sort: ViewSort = Field(default_factory=ViewSort)
    created_at: str
    updated_at: str


class CreateViewRequest(BaseModel):
    """ビュー作成リクエスト"""
    name: str
    description: Optional[str] = None
    is_default: bool = False
    filters: ViewFilters = Field(default_factory=ViewFilters)
    sort: ViewSort = Field(default_factory=ViewSort)


class UpdateViewRequest(BaseModel):
    """ビュー更新リクエスト"""
    name: str
    description: Optional[str] = None
    is_default: bool = False
    filters: ViewFilters = Field(default_factory=ViewFilters)
    sort: ViewSort = Field(default_factory=ViewSort)


class SetDefaultRequest(BaseModel):
    """デフォルトビュー設定リクエスト"""
    is_default: bool
