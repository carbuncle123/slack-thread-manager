from fastapi import APIRouter, HTTPException, Query
from typing import List, Optional, Dict
from pydantic import BaseModel
import re

from models.thread import Thread, ThreadCreate, ThreadUpdate
from models.message import Message
from utils.logger import get_logger

logger = get_logger(__name__)
router = APIRouter(prefix="/api/threads", tags=["threads"])

# 依存性注入用のグローバル変数 (main.pyで設定)
thread_manager = None
claude_agent = None  # Claude Agentクライアント


def set_thread_manager(manager):
    """ThreadManagerを設定"""
    global thread_manager
    thread_manager = manager


def set_claude_agent(agent):
    """Claude Agentクライアントを設定"""
    global claude_agent
    claude_agent = agent


class ThreadListResponse(BaseModel):
    """スレッド一覧レスポンス"""
    threads: List[Thread]
    total: int


class SyncResponse(BaseModel):
    """同期レスポンス"""
    thread_id: str
    total_messages: int
    new_messages: int
    synced_at: str


class ThreadQueryRequest(BaseModel):
    """スレッド質問リクエスト"""
    query: str


class ThreadQueryResponse(BaseModel):
    """スレッド質問レスポンス"""
    answer: str
    confidence: float


@router.get("", response_model=ThreadListResponse)
async def get_threads(
    tags: Optional[str] = Query(None, description="カンマ区切りのタグ"),
    is_read: Optional[bool] = Query(None, description="既読/未読フィルタ"),
    is_archived: Optional[bool] = Query(None, description="アーカイブフィルタ"),
    search: Optional[str] = Query(None, description="検索キーワード"),
    date_from: Optional[str] = Query(None, description="開始日 (YYYY-MM-DD)"),
    date_to: Optional[str] = Query(None, description="終了日 (YYYY-MM-DD)"),
    sort_by: str = Query("updated_at", description="ソート項目"),
    sort_order: str = Query("desc", description="ソート順序 (asc/desc)"),
    limit: int = Query(20, ge=1, le=10000, description="取得件数"),
    offset: int = Query(0, ge=0, description="オフセット")
):
    """スレッド一覧を取得"""
    if thread_manager is None:
        raise HTTPException(status_code=500, detail="Thread manager not initialized")

    # タグをリストに変換
    tag_list = tags.split(",") if tags else None

    # フィルタリング
    threads = thread_manager.filter_threads(
        tags=tag_list,
        is_read=is_read,
        is_archived=is_archived,
        search=search,
        date_from=date_from,
        date_to=date_to
    )

    # ソート
    threads = thread_manager.sort_threads(threads, sort_by, sort_order)

    # 総数を保存
    total = len(threads)

    # ページネーション
    threads = threads[offset:offset + limit]

    return ThreadListResponse(
        threads=threads,
        total=total
    )


@router.get("/{thread_id}", response_model=Thread)
async def get_thread(thread_id: str):
    """個別スレッド情報を取得"""
    if thread_manager is None:
        raise HTTPException(status_code=500, detail="Thread manager not initialized")

    thread = thread_manager.get_thread_by_id(thread_id)
    if thread is None:
        raise HTTPException(status_code=404, detail="Thread not found")

    return thread


@router.post("", response_model=Thread)
async def create_thread(thread_create: ThreadCreate):
    """新規スレッドを登録"""
    if thread_manager is None:
        raise HTTPException(status_code=500, detail="Thread manager not initialized")

    try:
        thread = thread_manager.create_thread(thread_create)
        return thread
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/{thread_id}", response_model=Thread)
async def update_thread(thread_id: str, thread_update: ThreadUpdate):
    """スレッド情報を更新"""
    if thread_manager is None:
        raise HTTPException(status_code=500, detail="Thread manager not initialized")

    thread = thread_manager.update_thread(thread_id, thread_update)
    if thread is None:
        raise HTTPException(status_code=404, detail="Thread not found")

    return thread


@router.delete("/{thread_id}")
async def delete_thread(thread_id: str):
    """スレッドを削除"""
    if thread_manager is None:
        raise HTTPException(status_code=500, detail="Thread manager not initialized")

    success = thread_manager.delete_thread(thread_id)
    if not success:
        raise HTTPException(status_code=404, detail="Thread not found")

    return {"message": "Thread deleted successfully"}


@router.post("/{thread_id}/mark-read", response_model=Thread)
async def mark_thread_as_read(thread_id: str):
    """スレッドを既読にする"""
    if thread_manager is None:
        raise HTTPException(status_code=500, detail="Thread manager not initialized")

    thread = thread_manager.mark_thread_as_read(thread_id)
    if thread is None:
        raise HTTPException(status_code=404, detail="Thread not found")

    return thread


@router.get("/{thread_id}/messages", response_model=List[Message])
async def get_thread_messages(thread_id: str):
    """スレッドのメッセージ一覧を取得"""
    if thread_manager is None:
        raise HTTPException(status_code=500, detail="Thread manager not initialized")

    messages = thread_manager.get_thread_messages(thread_id)
    if messages is None:
        raise HTTPException(status_code=404, detail="Messages not found")

    return messages


@router.get("/{thread_id}/user-mappings", response_model=Dict[str, str])
async def get_thread_user_mappings(thread_id: str):
    """スレッド内のユーザーIDと表示名のマッピングを取得"""
    if thread_manager is None:
        raise HTTPException(status_code=500, detail="Thread manager not initialized")

    # メッセージを取得
    messages = thread_manager.get_thread_messages(thread_id)
    if messages is None:
        raise HTTPException(status_code=404, detail="Messages not found")

    # ユーザーIDを収集
    user_ids = set()

    # メッセージの送信者から収集
    for message in messages:
        if message.user:
            user_ids.add(message.user)

    # メッセージテキスト内のメンション（<@U...>）から収集
    mention_pattern = re.compile(r'<@([A-Z0-9]+)>')
    for message in messages:
        mentions = mention_pattern.findall(message.text)
        user_ids.update(mentions)

    # 各ユーザーIDの表示名を取得
    user_mappings = {}
    slack_client = thread_manager.slack_client

    for user_id in user_ids:
        try:
            display_name = await slack_client.get_user_display_name(user_id)
            user_mappings[user_id] = display_name
        except Exception as e:
            logger.warning(f"Failed to get display name for {user_id}: {e}")
            # エラー時はIDをそのまま使用
            user_mappings[user_id] = user_id

    logger.info(f"Retrieved {len(user_mappings)} user mappings for thread {thread_id}")
    return user_mappings


@router.post("/{thread_id}/sync", response_model=SyncResponse)
async def sync_thread(thread_id: str):
    """個別スレッドのメッセージを同期"""
    if thread_manager is None:
        raise HTTPException(status_code=500, detail="Thread manager not initialized")

    try:
        result = await thread_manager.sync_thread_messages(thread_id)
        return SyncResponse(**result)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{thread_id}/query", response_model=ThreadQueryResponse)
async def query_thread(thread_id: str, request: ThreadQueryRequest):
    """
    特定のスレッドに対してLLMで質問に回答
    Claude Agent SDKを使用してスレッド内の情報のみを参照
    """
    if thread_manager is None:
        raise HTTPException(status_code=500, detail="Thread manager not initialized")
    if claude_agent is None:
        raise HTTPException(status_code=500, detail="Claude Agent not initialized")

    # スレッドの存在確認
    thread = thread_manager.get_thread_by_id(thread_id)
    if thread is None:
        raise HTTPException(status_code=404, detail="Thread not found")

    try:
        logger.info(f"Processing query for thread {thread_id}: {request.query}")

        # Claude Agentでスレッド専用クエリを実行
        result = await claude_agent.query_thread(thread_id, request.query)

        return ThreadQueryResponse(
            answer=result["answer"],
            confidence=result["confidence"]
        )

    except Exception as e:
        logger.error(f"Failed to process thread query: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Query processing failed: {str(e)}")


@router.post("/{thread_id}/archive", response_model=Thread)
async def archive_thread(thread_id: str):
    """スレッドをアーカイブ"""
    if thread_manager is None:
        raise HTTPException(status_code=500, detail="Thread manager not initialized")

    thread = thread_manager.get_thread_by_id(thread_id)
    if thread is None:
        raise HTTPException(status_code=404, detail="Thread not found")

    try:
        # アーカイブ状態に更新
        updated_thread = thread_manager.update_thread(
            thread_id,
            ThreadUpdate(is_archived=True)
        )
        logger.info(f"Thread {thread_id} archived")
        return updated_thread
    except Exception as e:
        logger.error(f"Failed to archive thread {thread_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to archive thread: {str(e)}")


@router.post("/{thread_id}/unarchive", response_model=Thread)
async def unarchive_thread(thread_id: str):
    """スレッドのアーカイブを解除"""
    if thread_manager is None:
        raise HTTPException(status_code=500, detail="Thread manager not initialized")

    thread = thread_manager.get_thread_by_id(thread_id)
    if thread is None:
        raise HTTPException(status_code=404, detail="Thread not found")

    try:
        # アーカイブ解除
        updated_thread = thread_manager.update_thread(
            thread_id,
            ThreadUpdate(is_archived=False)
        )
        logger.info(f"Thread {thread_id} unarchived")
        return updated_thread
    except Exception as e:
        logger.error(f"Failed to unarchive thread {thread_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to unarchive thread: {str(e)}")
