from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Any

router = APIRouter(prefix="/api/sync", tags=["sync"])

# 依存性注入用のグローバル変数
thread_manager = None


def set_thread_manager(manager):
    """ThreadManagerを設定"""
    global thread_manager
    thread_manager = manager


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
