import json
from pathlib import Path
from typing import Any, Optional
import shutil
from datetime import datetime


class FileHandler:
    """ファイル操作のユーティリティクラス"""

    @staticmethod
    def ensure_dir(directory: Path) -> None:
        """ディレクトリが存在しない場合は作成する"""
        directory.mkdir(parents=True, exist_ok=True)

    @staticmethod
    def read_json(file_path: Path) -> Optional[dict]:
        """JSONファイルを読み込む"""
        if not file_path.exists():
            return None

        try:
            with open(file_path, "r", encoding="utf-8") as f:
                return json.load(f)
        except json.JSONDecodeError as e:
            raise ValueError(f"Invalid JSON in {file_path}: {e}")
        except Exception as e:
            raise IOError(f"Failed to read {file_path}: {e}")

    @staticmethod
    def write_json(file_path: Path, data: Any) -> None:
        """JSONファイルに書き込む"""
        FileHandler.ensure_dir(file_path.parent)

        try:
            with open(file_path, "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, indent=2, default=str)
        except Exception as e:
            raise IOError(f"Failed to write {file_path}: {e}")

    @staticmethod
    def delete_file(file_path: Path) -> bool:
        """ファイルを削除する"""
        if not file_path.exists():
            return False

        try:
            file_path.unlink()
            return True
        except Exception as e:
            raise IOError(f"Failed to delete {file_path}: {e}")

    @staticmethod
    def list_files(directory: Path, pattern: str = "*.json") -> list[Path]:
        """ディレクトリ内のファイル一覧を取得"""
        if not directory.exists():
            return []

        return sorted(directory.glob(pattern))

    @staticmethod
    def backup_file(file_path: Path) -> Optional[Path]:
        """ファイルをバックアップする"""
        if not file_path.exists():
            return None

        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        backup_path = file_path.with_suffix(f".{timestamp}.backup")

        try:
            shutil.copy2(file_path, backup_path)
            return backup_path
        except Exception as e:
            raise IOError(f"Failed to backup {file_path}: {e}")
