from pathlib import Path
from typing import Optional, List
import re

from models.channel_export import (
    AccountDefinition,
    ChannelExportConfig,
    ChannelDownloadState,
    ClassificationConfig,
    ClassificationMatchRule,
    ProjectDefinition,
    DownloadJobStatus,
)
from utils.file_handler import FileHandler
from utils.logger import get_logger

logger = get_logger(__name__)


class ChannelExportRepository:
    """チャンネルエクスポート設定・状態のデータアクセス層"""

    def __init__(self, data_dir: Path):
        self.data_dir = data_dir
        self.export_dir = data_dir / "channel_export"
        self.config_path = self.export_dir / "config.json"
        self.classification_path = self.export_dir / "classification.json"
        self.state_path = self.export_dir / "state.json"
        self.job_path = self.export_dir / "job.json"
        FileHandler.ensure_dir(self.export_dir)

    # --- Config ---

    def get_config(self) -> ChannelExportConfig:
        """エクスポート設定を取得"""
        data = FileHandler.read_json(self.config_path)
        if data is None:
            return ChannelExportConfig()
        return ChannelExportConfig(**data)

    def save_config(self, config: ChannelExportConfig) -> None:
        """エクスポート設定を保存"""
        FileHandler.write_json(self.config_path, config.model_dump())
        logger.info("Saved channel export config")

    def get_classification_config(self) -> ClassificationConfig:
        """project/account分類設定を取得"""
        data = FileHandler.read_json(self.classification_path)
        if data is None:
            config = self._build_initial_classification_config()
            FileHandler.write_json(self.classification_path, config.model_dump())
            logger.info("Created default channel export classification config")
            return config
        return ClassificationConfig(**data)

    def save_classification_config(self, config: ClassificationConfig) -> None:
        """project/account分類設定を保存"""
        FileHandler.write_json(self.classification_path, config.model_dump())
        logger.info("Saved channel export classification config")

    def _build_initial_classification_config(self) -> ClassificationConfig:
        """現在のchannel設定をもとに初期 classification を生成"""
        config = self.get_config()
        projects: List[ProjectDefinition] = []
        accounts: List[AccountDefinition] = []

        for channel in config.channels:
            slug = self._slugify(channel.channel_name) or channel.channel_id.lower()
            projects.append(
                ProjectDefinition(
                    id=f"proj_{slug}",
                    name=channel.channel_name,
                    match=ClassificationMatchRule(channels=[channel.channel_id]),
                )
            )
            accounts.append(
                AccountDefinition(
                    id=f"acct_{slug}",
                    name=channel.channel_name,
                    match=ClassificationMatchRule(channels=[channel.channel_id]),
                )
            )

        return ClassificationConfig(projects=projects, accounts=accounts)

    def _slugify(self, value: str) -> str:
        normalized = value.strip().lower()
        normalized = re.sub(r"\s+", "_", normalized)
        normalized = re.sub(r"[^a-z0-9_]+", "", normalized)
        return normalized[:40]

    # --- Download State ---

    def get_all_states(self) -> List[ChannelDownloadState]:
        """全チャンネルのダウンロード状態を取得"""
        data = FileHandler.read_json(self.state_path)
        if data is None:
            return []
        return [ChannelDownloadState(**s) for s in data]

    def get_state(self, channel_id: str) -> Optional[ChannelDownloadState]:
        """特定チャンネルのダウンロード状態を取得"""
        states = self.get_all_states()
        for state in states:
            if state.channel_id == channel_id:
                return state
        return None

    def save_state(self, state: ChannelDownloadState) -> None:
        """チャンネルのダウンロード状態を保存（upsert）"""
        states = self.get_all_states()
        updated = False
        for i, s in enumerate(states):
            if s.channel_id == state.channel_id:
                states[i] = state
                updated = True
                break
        if not updated:
            states.append(state)
        FileHandler.write_json(self.state_path, [s.model_dump() for s in states])

    def delete_state(self, channel_id: str) -> None:
        """チャンネルのダウンロード状態を削除"""
        states = self.get_all_states()
        states = [s for s in states if s.channel_id != channel_id]
        FileHandler.write_json(self.state_path, [s.model_dump() for s in states])

    # --- Job Status ---

    def get_current_job(self) -> Optional[DownloadJobStatus]:
        """現在のジョブステータスを取得"""
        data = FileHandler.read_json(self.job_path)
        if data is None:
            return None
        return DownloadJobStatus(**data)

    def save_job(self, job: DownloadJobStatus) -> None:
        """ジョブステータスを保存"""
        FileHandler.write_json(self.job_path, job.model_dump())
