"""要約データのリポジトリ"""
import json
from pathlib import Path
from typing import Optional
from datetime import datetime
from models.summary import ThreadSummary
from utils.logger import setup_logger

logger = setup_logger(__name__)


class SummaryRepository:
    """要約データの永続化を管理"""

    def __init__(self, data_dir: Path):
        self.data_dir = data_dir
        self.summaries_dir = data_dir / "summaries"
        self.summaries_dir.mkdir(parents=True, exist_ok=True)

    def save(self, summary: ThreadSummary) -> None:
        """要約データを保存"""
        file_path = self.summaries_dir / f"{summary.thread_id}_summary.json"

        try:
            data = summary.model_dump(mode='json')

            with open(file_path, "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, indent=2)

            logger.info(f"要約データ保存成功: {summary.thread_id}")

        except Exception as e:
            logger.error(f"要約データ保存エラー: {str(e)}")
            raise

    def get(self, thread_id: str) -> Optional[ThreadSummary]:
        """要約データを取得"""
        file_path = self.summaries_dir / f"{thread_id}_summary.json"

        if not file_path.exists():
            return None

        try:
            with open(file_path, "r", encoding="utf-8") as f:
                data = json.load(f)

            # datetimeフィールドをパース
            if "last_updated" in data:
                data["last_updated"] = datetime.fromisoformat(data["last_updated"])

            summary = ThreadSummary(**data)
            logger.info(f"要約データ取得成功: {thread_id}")
            return summary

        except Exception as e:
            logger.error(f"要約データ取得エラー: {str(e)}")
            return None

    def delete(self, thread_id: str) -> bool:
        """要約データを削除"""
        file_path = self.summaries_dir / f"{thread_id}_summary.json"

        if not file_path.exists():
            return False

        try:
            file_path.unlink()
            logger.info(f"要約データ削除成功: {thread_id}")
            return True

        except Exception as e:
            logger.error(f"要約データ削除エラー: {str(e)}")
            return False

    def exists(self, thread_id: str) -> bool:
        """要約データが存在するか確認"""
        file_path = self.summaries_dir / f"{thread_id}_summary.json"
        return file_path.exists()
