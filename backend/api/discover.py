from fastapi import APIRouter, HTTPException, Depends
from typing import List

from models.discover import (
    DiscoverRequest,
    DiscoverResponse,
    RegisterThreadsRequest,
    RegisterThreadsResponse
)
from models.thread import ThreadCreate
from services.thread_discovery import ThreadDiscoveryService
from repositories.thread_repository import ThreadRepository
from utils.logger import get_logger

logger = get_logger(__name__)

router = APIRouter()

# グローバル変数（main.pyで設定される）
discovery_service: ThreadDiscoveryService = None
thread_repo: ThreadRepository = None


@router.post("/threads", response_model=DiscoverResponse)
async def discover_threads(request: DiscoverRequest):
    """新規スレッドを発見"""
    if not discovery_service:
        raise HTTPException(status_code=500, detail="Discovery service not initialized")

    try:
        logger.info(f"Discovering threads: channels={request.channel_ids}, days={request.days}")

        discovered_threads = await discovery_service.discover_threads(
            channel_ids=request.channel_ids if request.channel_ids else None,
            days=request.days
        )

        # 検索したチャンネルIDのリストを作成
        searched_channels = [t.channel_id for t in discovered_threads]
        searched_channels = list(set(searched_channels))  # 重複削除

        return DiscoverResponse(
            discovered_threads=discovered_threads,
            total_count=len(discovered_threads),
            searched_channels=searched_channels
        )

    except Exception as e:
        logger.error(f"Error discovering threads: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/register", response_model=RegisterThreadsResponse)
async def register_threads(request: RegisterThreadsRequest):
    """発見したスレッドを一括登録"""
    if not thread_repo:
        raise HTTPException(status_code=500, detail="Thread repository not initialized")

    try:
        logger.info(f"Registering {len(request.threads)} threads")

        registered_count = 0
        failed_count = 0
        errors = []

        for thread_data in request.threads:
            try:
                # ThreadCreateモデルに変換
                thread_create = ThreadCreate(
                    channel_id=thread_data.get("channel_id"),
                    thread_ts=thread_data.get("thread_ts"),
                    title=thread_data.get("title", ""),
                    tags=thread_data.get("tags", [])
                )

                # 既に登録されているかチェック
                existing = thread_repo.get_by_channel_and_ts(
                    thread_create.channel_id,
                    thread_create.thread_ts
                )

                if existing:
                    logger.warning(f"Thread already exists: {thread_create.channel_id}/{thread_create.thread_ts}")
                    failed_count += 1
                    errors.append(f"Thread already registered: {thread_create.title}")
                    continue

                # スレッド作成（ここでは基本情報のみ保存、メッセージは後で同期）
                from models.thread import Thread
                import uuid
                from datetime import datetime

                thread = Thread(
                    id=str(uuid.uuid4()),
                    channel_id=thread_create.channel_id,
                    thread_ts=thread_create.thread_ts,
                    title=thread_create.title,
                    url=thread_data.get("url", ""),
                    tags=thread_create.tags,
                    created_at=datetime.now(),
                    updated_at=datetime.now(),
                    last_message_ts=None,
                    message_count=0,
                    new_message_count=0,
                    is_read=False,
                    has_daily_summary=False,
                    has_topic_summary=False
                )

                thread_repo.save(thread)
                registered_count += 1

            except Exception as e:
                logger.error(f"Failed to register thread: {e}")
                failed_count += 1
                errors.append(str(e))

        logger.info(f"Registered {registered_count} threads, failed {failed_count}")

        return RegisterThreadsResponse(
            success=failed_count == 0,
            registered_count=registered_count,
            failed_count=failed_count,
            errors=errors
        )

    except Exception as e:
        logger.error(f"Error registering threads: {e}")
        raise HTTPException(status_code=500, detail=str(e))
