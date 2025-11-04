"""タグ管理API"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List

router = APIRouter(prefix="/api/tags", tags=["tags"])

# 依存性注入用のグローバル変数
_tag_repository = None


def set_tag_repository(repo):
    """タグリポジトリを設定"""
    global _tag_repository
    _tag_repository = repo


class TagCreate(BaseModel):
    """タグ作成リクエスト"""
    name: str


class TagUpdate(BaseModel):
    """タグ更新リクエスト"""
    old_name: str
    new_name: str


class TagsResponse(BaseModel):
    """タグ一覧レスポンス"""
    tags: List[str]


class TagResponse(BaseModel):
    """タグ操作レスポンス"""
    success: bool
    message: str


@router.get("", response_model=TagsResponse)
async def get_tags():
    """全てのタグを取得"""
    if _tag_repository is None:
        raise HTTPException(status_code=500, detail="Tag repository not initialized")

    tags = _tag_repository.get_all_tags()
    return TagsResponse(tags=tags)


@router.post("", response_model=TagResponse)
async def create_tag(tag_data: TagCreate):
    """新しいタグを作成"""
    if _tag_repository is None:
        raise HTTPException(status_code=500, detail="Tag repository not initialized")

    tag_name = tag_data.name.strip()
    if not tag_name:
        raise HTTPException(status_code=400, detail="Tag name cannot be empty")

    success = _tag_repository.add_tag(tag_name)
    if not success:
        raise HTTPException(status_code=400, detail="Tag already exists")

    return TagResponse(success=True, message=f"Tag '{tag_name}' created successfully")


@router.put("", response_model=TagResponse)
async def update_tag(tag_data: TagUpdate):
    """タグ名を更新"""
    if _tag_repository is None:
        raise HTTPException(status_code=500, detail="Tag repository not initialized")

    old_name = tag_data.old_name.strip()
    new_name = tag_data.new_name.strip()

    if not new_name:
        raise HTTPException(status_code=400, detail="New tag name cannot be empty")

    success = _tag_repository.update_tag(old_name, new_name)
    if not success:
        raise HTTPException(status_code=400, detail="Tag not found or new name already exists")

    return TagResponse(success=True, message=f"Tag updated from '{old_name}' to '{new_name}'")


@router.delete("/{tag_name}", response_model=TagResponse)
async def delete_tag(tag_name: str):
    """タグを削除"""
    if _tag_repository is None:
        raise HTTPException(status_code=500, detail="Tag repository not initialized")

    success = _tag_repository.delete_tag(tag_name)
    if not success:
        raise HTTPException(status_code=404, detail="Tag not found")

    return TagResponse(success=True, message=f"Tag '{tag_name}' deleted successfully")
