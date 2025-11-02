from pathlib import Path
from typing import Optional

from models.config import AppConfig, SlackConfig, SyncConfig, LLMConfig, AppSettings
from utils.file_handler import FileHandler
from utils.logger import get_logger

logger = get_logger(__name__)


class ConfigRepository:
    """設定データのデータアクセス層"""

    def __init__(self, data_dir: Path):
        self.data_dir = data_dir
        self.config_path = data_dir / "config.json"
        FileHandler.ensure_dir(data_dir)

    def get(self) -> Optional[AppConfig]:
        """設定を取得"""
        data = FileHandler.read_json(self.config_path)

        if data is None:
            return None

        return AppConfig(**data)

    def save(self, config: AppConfig) -> None:
        """設定を保存"""
        FileHandler.write_json(self.config_path, config.model_dump())
        logger.info("Saved application config")

    def get_or_create_default(
        self,
        workspace: str = "",
        xoxc_token: str = "",
        cookie: str = ""
    ) -> AppConfig:
        """設定を取得、存在しない場合はデフォルト設定を作成"""
        config = self.get()

        if config is None:
            config = AppConfig(
                slack=SlackConfig(
                    workspace=workspace,
                    xoxc_token=xoxc_token,
                    cookie=cookie,
                    monitored_channels=[]
                ),
                sync=SyncConfig(),
                llm=LLMConfig(),
                app=AppSettings()
            )
            self.save(config)
            logger.info("Created default application config")

        return config

    def update_slack_config(self, slack_config: SlackConfig) -> AppConfig:
        """Slack設定を更新"""
        config = self.get_or_create_default()
        config.slack = slack_config
        self.save(config)
        logger.info("Updated Slack config")
        return config

    def update_sync_config(self, sync_config: SyncConfig) -> AppConfig:
        """同期設定を更新"""
        config = self.get_or_create_default()
        config.sync = sync_config
        self.save(config)
        logger.info("Updated sync config")
        return config
