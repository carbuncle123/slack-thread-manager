from typing import Optional, List
from pydantic import BaseModel
from pydantic_settings import BaseSettings


class MonitoredChannel(BaseModel):
    """監視対象チャンネル"""
    channel_id: str
    channel_name: str
    mention_users: List[str] = []
    keywords: List[str] = []


class SlackConfig(BaseModel):
    """Slack設定"""
    workspace: str
    xoxc_token: str
    cookie: str
    monitored_channels: List[MonitoredChannel] = []
    default_mention_users: List[str] = []


class SyncConfig(BaseModel):
    """同期設定"""
    auto_sync_enabled: bool = True
    sync_interval_minutes: int = 30
    last_sync_at: Optional[str] = None


class LLMConfig(BaseModel):
    """LLM設定"""
    chatgpt_api_key: Optional[str] = None
    chatgpt_model: str = "gpt-4o"
    chatgpt_max_tokens: int = 2000
    claude_api_key: Optional[str] = None
    claude_agent_enabled: bool = False


class AppSettings(BaseModel):
    """アプリケーション設定"""
    theme: str = "light"
    items_per_page: int = 20


class AppConfig(BaseModel):
    """アプリケーション全体の設定"""
    slack: SlackConfig
    sync: SyncConfig = SyncConfig()
    llm: LLMConfig = LLMConfig()
    app: AppSettings = AppSettings()


class Settings(BaseSettings):
    """環境変数から読み込む設定"""
    # Slack
    slack_workspace: str = ""
    slack_xoxc_token: str = ""
    slack_cookie: str = ""

    # ChatGPT
    openai_api_key: str = ""
    openai_model: str = "gpt-4o"
    openai_max_tokens: int = 2000

    # Claude
    anthropic_api_key: str = ""

    # Application
    data_dir: str = "./data"
    sync_interval_minutes: int = 30
    log_level: str = "INFO"

    # Server
    backend_host: str = "127.0.0.1"
    backend_port: int = 8000
    frontend_url: str = "http://localhost:3000"

    class Config:
        env_file = "backend/.env"
        env_file_encoding = "utf-8"
