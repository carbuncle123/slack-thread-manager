"""タグリポジトリ"""
from pathlib import Path
import json
from typing import List, Optional
from datetime import datetime


class TagRepository:
    """タグの永続化を管理するリポジトリ"""

    def __init__(self, data_dir: Path):
        self.data_dir = data_dir
        self.tags_file = data_dir / "tags.json"
        self._ensure_data_dir()
        self._initialize_tags()

    def _ensure_data_dir(self):
        """データディレクトリが存在することを確認"""
        self.data_dir.mkdir(parents=True, exist_ok=True)

    def _initialize_tags(self):
        """タグファイルが存在しない場合は初期化"""
        if not self.tags_file.exists():
            default_tags = [
                "実運用",
                "テスト",
                "バグ",
                "機能追加",
                "質問",
                "議論",
                "決定事項",
                "TODO",
            ]
            self._save_tags(default_tags)

    def _load_tags(self) -> List[str]:
        """タグ一覧をファイルから読み込み"""
        try:
            with open(self.tags_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
                return data.get('tags', [])
        except (FileNotFoundError, json.JSONDecodeError):
            return []

    def _save_tags(self, tags: List[str]):
        """タグ一覧をファイルに保存"""
        data = {
            'tags': tags,
            'updated_at': datetime.now().isoformat()
        }
        with open(self.tags_file, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

    def get_all_tags(self) -> List[str]:
        """全てのタグを取得"""
        return sorted(self._load_tags())

    def add_tag(self, tag: str) -> bool:
        """新しいタグを追加

        Args:
            tag: 追加するタグ名

        Returns:
            追加が成功した場合True、既に存在する場合False
        """
        tags = self._load_tags()
        if tag in tags:
            return False
        tags.append(tag)
        self._save_tags(tags)
        return True

    def update_tag(self, old_tag: str, new_tag: str) -> bool:
        """タグ名を変更

        Args:
            old_tag: 変更前のタグ名
            new_tag: 変更後のタグ名

        Returns:
            更新が成功した場合True、失敗した場合False
        """
        tags = self._load_tags()
        if old_tag not in tags:
            return False
        if new_tag in tags and new_tag != old_tag:
            return False

        tags[tags.index(old_tag)] = new_tag
        self._save_tags(tags)
        return True

    def delete_tag(self, tag: str) -> bool:
        """タグを削除

        Args:
            tag: 削除するタグ名

        Returns:
            削除が成功した場合True、存在しない場合False
        """
        tags = self._load_tags()
        if tag not in tags:
            return False
        tags.remove(tag)
        self._save_tags(tags)
        return True

    def tag_exists(self, tag: str) -> bool:
        """タグが存在するか確認"""
        return tag in self._load_tags()
