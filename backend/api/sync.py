from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Any

from models.config import SyncConfig

router = APIRouter(prefix="/api/sync", tags=["sync"])

# 依存性注入用のグローバル変数
thread_manager = None
config_repo = None


def set_thread_manager(manager):
    """ThreadManagerを設定"""
    global thread_manager
    thread_manager = manager


def set_config_repository(repo):
    """ConfigRepositoryを設定"""
    global config_repo
    config_repo = repo


class SyncAllResponse(BaseModel):
    """全スレッド同期レスポンス"""
    total_threads: int
    synced: int
    failed: int
    new_messages_total: int
    errors: List[Dict[str, Any]]


@router.post("/all", response_model=SyncAllResponse)
async def sync_all_threads():
    """全スレッドを同期"""
    if thread_manager is None:
        raise HTTPException(status_code=500, detail="Thread manager not initialized")

    try:
        result = await thread_manager.sync_all_threads()
        return SyncAllResponse(**result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/config", response_model=SyncConfig)
async def get_sync_config():
    """同期設定を取得"""
    if config_repo is None:
        raise HTTPException(status_code=500, detail="Config repository not initialized")

    app_config = config_repo.get_or_create_default()
    return app_config.sync


@router.put("/config", response_model=SyncConfig)
async def update_sync_config(sync_config: SyncConfig):
    """同期設定を更新"""
    if config_repo is None:
        raise HTTPException(status_code=500, detail="Config repository not initialized")

    app_config = config_repo.get_or_create_default()
    app_config.sync = sync_config
    config_repo.save(app_config)
    return app_config.sync
