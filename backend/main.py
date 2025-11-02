from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pathlib import Path
import sys

# プロジェクトルートをパスに追加
sys.path.insert(0, str(Path(__file__).parent))

from models.config import Settings
from repositories.thread_repository import ThreadRepository
from repositories.message_repository import MessageRepository
from repositories.config_repository import ConfigRepository
from services.slack_client import SlackClient
from services.thread_manager import ThreadManager
from api import threads, sync, config as config_api
from utils.logger import setup_logger

# 設定読み込み
settings = Settings()

# ロガーセットアップ
logger = setup_logger("slack_thread_manager", settings.log_level)

# データディレクトリ
data_dir = Path(settings.data_dir)

# リポジトリ初期化
thread_repo = ThreadRepository(data_dir)
message_repo = MessageRepository(data_dir)
config_repo = ConfigRepository(data_dir)

# 設定を取得または作成
app_config = config_repo.get_or_create_default(
    workspace=settings.slack_workspace,
    xoxc_token=settings.slack_xoxc_token,
    cookie=settings.slack_cookie
)

# Slack クライアント初期化
slack_client = SlackClient(
    xoxc_token=app_config.slack.xoxc_token,
    cookie=app_config.slack.cookie,
    workspace=app_config.slack.workspace
)

# スレッド管理サービス初期化
thread_manager = ThreadManager(
    thread_repo=thread_repo,
    message_repo=message_repo,
    slack_client=slack_client
)

# FastAPI アプリケーション
app = FastAPI(
    title="Slack Thread Manager API",
    description="Slackスレッド管理アプリケーションのバックエンドAPI",
    version="1.0.0"
)

# CORS設定
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_url, "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 依存性注入
threads.set_thread_manager(thread_manager)
sync.set_thread_manager(thread_manager)
config_api.set_config_repository(config_repo)

# ルーター登録
app.include_router(threads.router)
app.include_router(sync.router)
app.include_router(config_api.router)


@app.get("/")
async def root():
    """ルートエンドポイント"""
    return {
        "message": "Slack Thread Manager API",
        "version": "1.0.0",
        "docs": "/docs"
    }


@app.get("/api/health")
async def health_check():
    """ヘルスチェック"""
    return {
        "status": "healthy",
        "data_dir": str(data_dir),
        "threads_count": len(thread_repo.get_all())
    }


@app.on_event("startup")
async def startup_event():
    """起動時の処理"""
    logger.info("Starting Slack Thread Manager API")
    logger.info(f"Data directory: {data_dir}")
    logger.info(f"Loaded {len(thread_repo.get_all())} threads")


@app.on_event("shutdown")
async def shutdown_event():
    """終了時の処理"""
    logger.info("Shutting down Slack Thread Manager API")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "main:app",
        host=settings.backend_host,
        port=settings.backend_port,
        reload=True,
        log_level=settings.log_level.lower()
    )
