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
from repositories.summary_repository import SummaryRepository
from repositories.view_repository import ViewRepository
from repositories.tag_repository import TagRepository
from services.slack_client import SlackClient
from services.thread_manager import ThreadManager
from services.chatgpt_client import ChatGPTClient
from services.summary_generator import SummaryGenerator
from services.thread_discovery import ThreadDiscoveryService
from api import threads, sync, config as config_api, summaries, discover, search, views, tags
from services.claude_agent import ClaudeAgentClient
from utils.logger import setup_logger

# 設定読み込み
settings = Settings()

# Claude Agent初期化 (ローカルClaude Code SDK版)
search.claude_agent = ClaudeAgentClient()

# ロガーセットアップ
logger = setup_logger("slack_thread_manager", settings.log_level)

# データディレクトリ
data_dir = Path(settings.data_dir)

# リポジトリ初期化
thread_repo = ThreadRepository(data_dir)
message_repo = MessageRepository(data_dir)
config_repo = ConfigRepository(data_dir)
summary_repo = SummaryRepository(data_dir)
view_repo = ViewRepository(data_dir)
tag_repo = TagRepository(data_dir)

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

# ChatGPT クライアント初期化
chatgpt_client = None
if settings.openai_api_key:
    chatgpt_client = ChatGPTClient(
        api_key=settings.openai_api_key,
        model=settings.openai_model,
        max_tokens=settings.openai_max_tokens
    )
    logger.info("ChatGPT クライアント初期化完了")
else:
    logger.warning("OpenAI API Keyが設定されていません。要約機能は利用できません。")

# 要約生成サービス初期化
summary_generator = None
if chatgpt_client:
    summary_generator = SummaryGenerator(
        chatgpt_client=chatgpt_client,
        summary_repo=summary_repo,
        message_repo=message_repo,
        thread_repo=thread_repo
    )
    logger.info("要約生成サービス初期化完了")

# スレッド発見サービス初期化
discovery_service = ThreadDiscoveryService(
    slack_client=slack_client,
    thread_repo=thread_repo,
    config_repo=config_repo
)
logger.info("スレッド発見サービス初期化完了")

# FastAPI アプリケーション
app = FastAPI(
    title="Slack Thread Manager API",
    description="Slackスレッド管理アプリケーションのバックエンドAPI",
    version="1.0.0"
)

# CORS設定
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_url, "http://localhost:3000", "http://localhost:5173", "http://localhost:5174"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 依存性注入
threads.set_thread_manager(thread_manager)
sync.set_thread_manager(thread_manager)
config_api.set_config_repository(config_repo)
discover.discovery_service = discovery_service
discover.thread_repo = thread_repo
views.set_view_repository(view_repo)
tags.set_tag_repository(tag_repo)

# 要約機能が有効な場合のみ登録
if summary_generator:
    summaries.set_summary_generator(summary_generator)
    app.include_router(summaries.router)

# ルーター登録
app.include_router(threads.router)
app.include_router(sync.router)
app.include_router(config_api.router)
app.include_router(discover.router, prefix="/api/discover", tags=["discover"])
app.include_router(search.router, prefix="/api", tags=["search"])
app.include_router(views.router)
app.include_router(tags.router)


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
