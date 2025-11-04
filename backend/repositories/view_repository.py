import json
import uuid
from pathlib import Path
from typing import List, Optional
from datetime import datetime

from models.view import ThreadView, ViewFilters, ViewSort
from utils.logger import get_logger

logger = get_logger(__name__)


class ViewRepository:
    """ビューのリポジトリ"""

    def __init__(self, data_dir: str = "./data"):
        self.data_dir = Path(data_dir)
        self.views_file = self.data_dir / "views.json"
        self._ensure_data_dir()

    def _ensure_data_dir(self):
        """データディレクトリの存在を確認"""
        self.data_dir.mkdir(parents=True, exist_ok=True)
        if not self.views_file.exists():
            self._save_views([])

    def _save_views(self, views: List[ThreadView]):
        """ビュー一覧をファイルに保存"""
        data = {
            "views": [view.model_dump() for view in views]
        }
        with open(self.views_file, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

    def _load_views(self) -> List[ThreadView]:
        """ビュー一覧をファイルから読み込み"""
        if not self.views_file.exists():
            return []

        try:
            with open(self.views_file, "r", encoding="utf-8") as f:
                data = json.load(f)
                return [ThreadView(**view) for view in data.get("views", [])]
        except Exception as e:
            logger.error(f"Failed to load views: {e}")
            return []

    def get_all(self) -> List[ThreadView]:
        """全ビューを取得"""
        return self._load_views()

    def get_by_id(self, view_id: str) -> Optional[ThreadView]:
        """IDでビューを取得"""
        views = self._load_views()
        for view in views:
            if view.id == view_id:
                return view
        return None

    def get_default(self) -> Optional[ThreadView]:
        """デフォルトビューを取得"""
        views = self._load_views()
        for view in views:
            if view.is_default:
                return view
        return None

    def create(
        self,
        name: str,
        description: Optional[str] = None,
        is_default: bool = False,
        filters: Optional[ViewFilters] = None,
        sort: Optional[ViewSort] = None
    ) -> ThreadView:
        """新規ビューを作成"""
        views = self._load_views()

        # デフォルトビューの場合、既存のデフォルトを解除
        if is_default:
            for view in views:
                if view.is_default:
                    view.is_default = False

        # 新規ビューを作成
        now = datetime.utcnow().isoformat() + "Z"
        view_id = f"view_{uuid.uuid4().hex[:8]}"

        new_view = ThreadView(
            id=view_id,
            name=name,
            description=description,
            is_default=is_default,
            filters=filters or ViewFilters(),
            sort=sort or ViewSort(),
            created_at=now,
            updated_at=now
        )

        views.append(new_view)
        self._save_views(views)

        logger.info(f"Created view: {view_id} - {name}")
        return new_view

    def update(
        self,
        view_id: str,
        name: str,
        description: Optional[str] = None,
        is_default: bool = False,
        filters: Optional[ViewFilters] = None,
        sort: Optional[ViewSort] = None
    ) -> Optional[ThreadView]:
        """ビューを更新"""
        views = self._load_views()

        # ビューを検索
        found = False
        for i, view in enumerate(views):
            if view.id == view_id:
                # デフォルトビューの場合、他のデフォルトを解除
                if is_default:
                    for other_view in views:
                        if other_view.id != view_id:
                            other_view.is_default = False

                # 更新
                now = datetime.utcnow().isoformat() + "Z"
                views[i] = ThreadView(
                    id=view_id,
                    name=name,
                    description=description,
                    is_default=is_default,
                    filters=filters or ViewFilters(),
                    sort=sort or ViewSort(),
                    created_at=view.created_at,
                    updated_at=now
                )
                found = True
                break

        if not found:
            return None

        self._save_views(views)
        logger.info(f"Updated view: {view_id}")
        return views[i]

    def delete(self, view_id: str) -> bool:
        """ビューを削除"""
        views = self._load_views()

        original_length = len(views)
        views = [view for view in views if view.id != view_id]

        if len(views) == original_length:
            return False

        self._save_views(views)
        logger.info(f"Deleted view: {view_id}")
        return True

    def set_default(self, view_id: str, is_default: bool) -> Optional[ThreadView]:
        """デフォルトビューを設定/解除"""
        views = self._load_views()

        found = False
        target_view = None

        for i, view in enumerate(views):
            if view.id == view_id:
                # 対象ビューのデフォルト状態を更新
                views[i].is_default = is_default
                views[i].updated_at = datetime.utcnow().isoformat() + "Z"
                target_view = views[i]
                found = True

                # デフォルトに設定する場合、他のデフォルトを解除
                if is_default:
                    for other_view in views:
                        if other_view.id != view_id:
                            other_view.is_default = False
                break

        if not found:
            return None

        self._save_views(views)
        logger.info(f"Set default view: {view_id} = {is_default}")
        return target_view
