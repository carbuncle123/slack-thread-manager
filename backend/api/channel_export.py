import asyncio
from fastapi import APIRouter, HTTPException
from typing import List, Optional

from models.channel_export import (
    ExportChannel,
    ChannelExportConfig,
    ChannelDownloadState,
    DownloadJobStatus,
)

router = APIRouter(prefix="/api/channel-export", tags=["channel-export"])

# 依存性注入用のグローバル変数
export_repo = None
channel_exporter = None


def set_export_repository(repo):
    """ChannelExportRepositoryを設定"""
    global export_repo
    export_repo = repo


def set_channel_exporter(exporter):
    """ChannelExporterを設定"""
    global channel_exporter
    channel_exporter = exporter


# --- Config ---


@router.get("/config", response_model=ChannelExportConfig)
async def get_export_config():
    """エクスポート設定を取得"""
    if export_repo is None:
        raise HTTPException(status_code=500, detail="Export repository not initialized")
    return export_repo.get_config()


@router.put("/config", response_model=ChannelExportConfig)
async def update_export_config(config: ChannelExportConfig):
    """エクスポート設定を更新"""
    if export_repo is None:
        raise HTTPException(status_code=500, detail="Export repository not initialized")
    export_repo.save_config(config)
    return config


@router.post("/config/channels", response_model=ChannelExportConfig)
async def add_export_channel(channel: ExportChannel):
    """ダウンロード対象チャンネルを追加"""
    if export_repo is None:
        raise HTTPException(status_code=500, detail="Export repository not initialized")

    config = export_repo.get_config()

    # 重複チェック
    for existing in config.channels:
        if existing.channel_id == channel.channel_id:
            raise HTTPException(status_code=400, detail="Channel already exists")

    config.channels.append(channel)
    export_repo.save_config(config)
    return config


@router.delete("/config/channels/{channel_id}", response_model=ChannelExportConfig)
async def delete_export_channel(channel_id: str):
    """ダウンロード対象チャンネルを削除"""
    if export_repo is None:
        raise HTTPException(status_code=500, detail="Export repository not initialized")

    config = export_repo.get_config()
    original_length = len(config.channels)
    config.channels = [ch for ch in config.channels if ch.channel_id != channel_id]

    if len(config.channels) == original_length:
        raise HTTPException(status_code=404, detail="Channel not found")

    export_repo.save_config(config)
    export_repo.delete_state(channel_id)
    return config


# --- Download ---


@router.post("/download", response_model=dict)
async def download_all():
    """全チャンネルの手動ダウンロードを開始（バックグラウンド）"""
    if channel_exporter is None:
        raise HTTPException(status_code=500, detail="Channel exporter not initialized")
    if export_repo is None:
        raise HTTPException(status_code=500, detail="Export repository not initialized")

    # 実行中のジョブがあるか確認
    current_job = export_repo.get_current_job()
    if current_job and current_job.status == "running":
        raise HTTPException(status_code=409, detail="A download job is already running")

    # バックグラウンドで実行
    asyncio.create_task(channel_exporter.download_all_channels())
    return {"message": "Download started"}


@router.post("/download/{channel_id}", response_model=dict)
async def download_channel(channel_id: str):
    """単一チャンネルの手動ダウンロードを開始（バックグラウンド）"""
    if channel_exporter is None:
        raise HTTPException(status_code=500, detail="Channel exporter not initialized")
    if export_repo is None:
        raise HTTPException(status_code=500, detail="Export repository not initialized")

    # チャンネルが設定に存在するか確認
    config = export_repo.get_config()
    channel = next((ch for ch in config.channels if ch.channel_id == channel_id), None)
    if channel is None:
        raise HTTPException(status_code=404, detail="Channel not found in export config")

    # バックグラウンドで実行
    asyncio.create_task(
        channel_exporter.download_channel(channel.channel_id, channel.channel_name)
    )
    return {"message": f"Download started for {channel.channel_name}"}


# --- Status ---


@router.get("/status", response_model=dict)
async def get_status():
    """ダウンロードステータスを取得"""
    if export_repo is None:
        raise HTTPException(status_code=500, detail="Export repository not initialized")

    job = export_repo.get_current_job()
    states = export_repo.get_all_states()

    return {
        "job": job.model_dump() if job else None,
        "channels": [s.model_dump() for s in states],
    }
