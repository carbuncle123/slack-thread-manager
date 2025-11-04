from fastapi import APIRouter, HTTPException
from typing import List
from models.view import (
    ThreadView,
    CreateViewRequest,
    UpdateViewRequest,
    SetDefaultRequest
)

router = APIRouter(prefix="/api/views", tags=["views"])

# 依存性注入用のグローバル変数
view_repo = None


def set_view_repository(repo):
    """ViewRepositoryを設定"""
    global view_repo
    view_repo = repo


@router.get("", response_model=List[ThreadView])
async def get_views():
    """ビュー一覧を取得"""
    if view_repo is None:
        raise HTTPException(status_code=500, detail="View repository not initialized")

    views = view_repo.get_all()
    return views


@router.get("/{view_id}", response_model=ThreadView)
async def get_view(view_id: str):
    """個別ビューを取得"""
    if view_repo is None:
        raise HTTPException(status_code=500, detail="View repository not initialized")

    view = view_repo.get_by_id(view_id)
    if view is None:
        raise HTTPException(status_code=404, detail="View not found")

    return view


@router.post("", response_model=ThreadView)
async def create_view(request: CreateViewRequest):
    """ビューを作成"""
    if view_repo is None:
        raise HTTPException(status_code=500, detail="View repository not initialized")

    # ビュー名の重複チェック
    existing_views = view_repo.get_all()
    for existing in existing_views:
        if existing.name == request.name:
            raise HTTPException(status_code=400, detail="View name already exists")

    view = view_repo.create(
        name=request.name,
        description=request.description,
        is_default=request.is_default,
        filters=request.filters,
        sort=request.sort
    )

    return view


@router.put("/{view_id}", response_model=ThreadView)
async def update_view(view_id: str, request: UpdateViewRequest):
    """ビューを更新"""
    if view_repo is None:
        raise HTTPException(status_code=500, detail="View repository not initialized")

    # ビュー名の重複チェック（自分以外）
    existing_views = view_repo.get_all()
    for existing in existing_views:
        if existing.id != view_id and existing.name == request.name:
            raise HTTPException(status_code=400, detail="View name already exists")

    view = view_repo.update(
        view_id=view_id,
        name=request.name,
        description=request.description,
        is_default=request.is_default,
        filters=request.filters,
        sort=request.sort
    )

    if view is None:
        raise HTTPException(status_code=404, detail="View not found")

    return view


@router.delete("/{view_id}")
async def delete_view(view_id: str):
    """ビューを削除"""
    if view_repo is None:
        raise HTTPException(status_code=500, detail="View repository not initialized")

    success = view_repo.delete(view_id)
    if not success:
        raise HTTPException(status_code=404, detail="View not found")

    return {"message": "ビューを削除しました"}


@router.put("/{view_id}/default", response_model=ThreadView)
async def set_default_view(view_id: str, request: SetDefaultRequest):
    """デフォルトビューを設定/解除"""
    if view_repo is None:
        raise HTTPException(status_code=500, detail="View repository not initialized")

    view = view_repo.set_default(view_id, request.is_default)
    if view is None:
        raise HTTPException(status_code=404, detail="View not found")

    return view
