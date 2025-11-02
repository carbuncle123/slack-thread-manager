"""
検索・質問API
自然言語質問と検索履歴管理のエンドポイント
"""
import uuid
import json
from datetime import datetime
from pathlib import Path
from typing import List, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from services.claude_agent import ClaudeAgentClient
from utils.logger import get_logger

logger = get_logger(__name__)
router = APIRouter()

# 検索履歴ファイルパス
SEARCH_HISTORY_FILE = Path("data/search_history.json")

# Claude Agentクライアント（必要に応じてAPI keyを設定）
claude_agent = None  # main.pyで初期化される


class QueryRequest(BaseModel):
    query: str


class RelatedThread(BaseModel):
    thread_id: str
    title: str
    url: Optional[str] = None


class QueryResponse(BaseModel):
    query_id: str
    query: str
    answer: str
    related_threads: List[RelatedThread]
    confidence: float
    created_at: str


class SearchHistoryItem(BaseModel):
    query_id: str
    query: str
    answer: str
    related_threads: List[RelatedThread]
    confidence: float
    created_at: str
    bookmarked: bool = False


class BookmarkRequest(BaseModel):
    bookmarked: bool


def load_search_history() -> List[SearchHistoryItem]:
    """検索履歴を読み込み"""
    try:
        if SEARCH_HISTORY_FILE.exists():
            with open(SEARCH_HISTORY_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                return [SearchHistoryItem(**item) for item in data.get("history", [])]
    except (json.JSONDecodeError, IOError) as e:
        logger.error(f"Failed to load search history: {e}")
    
    return []


def save_search_history(history: List[SearchHistoryItem]) -> None:
    """検索履歴を保存"""
    try:
        SEARCH_HISTORY_FILE.parent.mkdir(parents=True, exist_ok=True)
        
        data = {
            "history": [item.model_dump() for item in history]
        }
        
        with open(SEARCH_HISTORY_FILE, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
    except IOError as e:
        logger.error(f"Failed to save search history: {e}")


@router.post("/search/query", response_model=QueryResponse)
async def search_query(request: QueryRequest):
    """自然言語で質問"""
    try:
        logger.info(f"Received search query: {request.query}")

        # Claude Agentで処理 (非同期)
        result = await claude_agent.query(request.query)
        
        # クエリIDを生成
        query_id = f"query_{uuid.uuid4().hex[:8]}"
        created_at = datetime.utcnow().isoformat() + "Z"
        
        # 関連スレッドの形式を変換
        related_threads = [
            RelatedThread(
                thread_id=thread.get("thread_id", ""),
                title=thread.get("title", ""),
                url=thread.get("url")
            )
            for thread in result.get("related_threads", [])
        ]
        
        # レスポンスを作成
        response = QueryResponse(
            query_id=query_id,
            query=request.query,
            answer=result.get("answer", ""),
            related_threads=related_threads,
            confidence=result.get("confidence", 0.0),
            created_at=created_at
        )
        
        # 検索履歴に保存
        history = load_search_history()
        history_item = SearchHistoryItem(
            query_id=query_id,
            query=request.query,
            answer=result.get("answer", ""),
            related_threads=related_threads,
            confidence=result.get("confidence", 0.0),
            created_at=created_at,
            bookmarked=False
        )
        history.insert(0, history_item)  # 最新を先頭に
        
        # 履歴の上限を設定（100件まで）
        if len(history) > 100:
            history = history[:100]
        
        save_search_history(history)
        
        logger.info(f"Query processed successfully: {query_id}")
        return response
        
    except Exception as e:
        logger.error(f"Failed to process search query: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/search/history", response_model=List[SearchHistoryItem])
async def get_search_history():
    """検索履歴を取得"""
    try:
        history = load_search_history()
        return history
    except Exception as e:
        logger.error(f"Failed to get search history: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/search/history/{query_id}/bookmark")
async def bookmark_query(query_id: str, request: BookmarkRequest):
    """質問をブックマーク/ブックマーク解除"""
    try:
        history = load_search_history()
        
        # 該当するクエリを検索
        for item in history:
            if item.query_id == query_id:
                item.bookmarked = request.bookmarked
                save_search_history(history)
                return {"success": True, "bookmarked": request.bookmarked}
        
        raise HTTPException(status_code=404, detail="Query not found")
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to bookmark query: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/search/history/{query_id}")
async def delete_query(query_id: str):
    """検索履歴の項目を削除"""
    try:
        history = load_search_history()
        
        # 該当するクエリを削除
        history = [item for item in history if item.query_id != query_id]
        save_search_history(history)
        
        return {"success": True}
        
    except Exception as e:
        logger.error(f"Failed to delete query: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/search/history/bookmarks", response_model=List[SearchHistoryItem])
async def get_bookmarked_queries():
    """ブックマークされた質問を取得"""
    try:
        history = load_search_history()
        bookmarked = [item for item in history if item.bookmarked]
        return bookmarked
    except Exception as e:
        logger.error(f"Failed to get bookmarked queries: {e}")
        raise HTTPException(status_code=500, detail=str(e))