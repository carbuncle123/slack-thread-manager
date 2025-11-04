from fastapi import APIRouter, HTTPException
from models.config import AppConfig, SlackConfig, MonitoredChannel
from typing import List

router = APIRouter(prefix="/api/config", tags=["config"])

# 依存性注入用のグローバル変数
config_repo = None


def set_config_repository(repo):
    """ConfigRepositoryを設定"""
    global config_repo
    config_repo = repo


@router.get("", response_model=AppConfig)
async def get_config():
    """設定を取得"""
    if config_repo is None:
        raise HTTPException(status_code=500, detail="Config repository not initialized")

    config = config_repo.get_or_create_default()
    return config


@router.put("", response_model=AppConfig)
async def update_config(config: AppConfig):
    """設定を更新"""
    if config_repo is None:
        raise HTTPException(status_code=500, detail="Config repository not initialized")

    config_repo.save(config)
    return config


@router.get("/channels", response_model=List[MonitoredChannel])
async def get_monitored_channels():
    """監視チャンネル一覧を取得"""
    if config_repo is None:
        raise HTTPException(status_code=500, detail="Config repository not initialized")

    config = config_repo.get_or_create_default()
    return config.slack.monitored_channels


@router.post("/channels", response_model=AppConfig)
async def add_monitored_channel(channel: MonitoredChannel):
    """監視チャンネルを追加"""
    if config_repo is None:
        raise HTTPException(status_code=500, detail="Config repository not initialized")

    config = config_repo.get_or_create_default()

    # 重複チェック
    for existing in config.slack.monitored_channels:
        if existing.channel_id == channel.channel_id:
            raise HTTPException(status_code=400, detail="Channel already exists")

    config.slack.monitored_channels.append(channel)
    config_repo.save(config)
    return config


@router.put("/channels/{channel_id}", response_model=AppConfig)
async def update_monitored_channel(channel_id: str, channel: MonitoredChannel):
    """監視チャンネルを更新"""
    if config_repo is None:
        raise HTTPException(status_code=500, detail="Config repository not initialized")

    config = config_repo.get_or_create_default()

    # チャンネルを検索して更新
    found = False
    for i, existing in enumerate(config.slack.monitored_channels):
        if existing.channel_id == channel_id:
            config.slack.monitored_channels[i] = channel
            found = True
            break

    if not found:
        raise HTTPException(status_code=404, detail="Channel not found")

    config_repo.save(config)
    return config


@router.delete("/channels/{channel_id}", response_model=AppConfig)
async def delete_monitored_channel(channel_id: str):
    """監視チャンネルを削除"""
    if config_repo is None:
        raise HTTPException(status_code=500, detail="Config repository not initialized")

    config = config_repo.get_or_create_default()

    # チャンネルを検索して削除
    original_length = len(config.slack.monitored_channels)
    config.slack.monitored_channels = [
        ch for ch in config.slack.monitored_channels
        if ch.channel_id != channel_id
    ]

    if len(config.slack.monitored_channels) == original_length:
        raise HTTPException(status_code=404, detail="Channel not found")

    config_repo.save(config)
    return config
