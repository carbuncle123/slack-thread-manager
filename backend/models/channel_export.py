from typing import Optional, List
from pydantic import BaseModel


class ExportChannel(BaseModel):
    """ダウンロード対象チャンネル"""
    channel_id: str
    channel_name: str
    enabled: bool = True


class ChannelExportConfig(BaseModel):
    """チャンネルエクスポート設定"""
    channels: List[ExportChannel] = []
    schedule_enabled: bool = False
    schedule_interval_hours: int = 24


class ChannelDownloadState(BaseModel):
    """チャンネル毎のダウンロード状態"""
    channel_id: str
    channel_name: str
    last_downloaded_at: Optional[str] = None
    last_message_ts: Optional[str] = None
    total_messages_downloaded: int = 0
    total_threads_downloaded: int = 0
    status: str = "pending"  # pending | downloading | completed | error
    error_message: Optional[str] = None
    # 初回DLの進捗管理: どこまで遡って取得済みか（ISOフォーマット）
    initial_fetch_oldest: Optional[str] = None
    initial_fetch_done: bool = False


class DownloadJobStatus(BaseModel):
    """ダウンロードジョブ全体のステータス"""
    job_id: str
    started_at: str
    completed_at: Optional[str] = None
    status: str = "pending"  # pending | running | completed | error
    channels: List[ChannelDownloadState] = []
    current_channel: Optional[str] = None
    progress_percent: float = 0.0
