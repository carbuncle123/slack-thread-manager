import logging
import sys
from pathlib import Path


def setup_logger(name: str, log_level: str = "INFO", log_file: Path = None) -> logging.Logger:
    """ロガーをセットアップする"""
    logger = logging.getLogger(name)
    logger.setLevel(getattr(logging, log_level.upper()))

    # フォーマッター
    formatter = logging.Formatter(
        "%(asctime)s - %(name)s - %(levelname)s - %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S"
    )

    # コンソールハンドラー
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setFormatter(formatter)
    logger.addHandler(console_handler)

    # ファイルハンドラー (オプション)
    if log_file:
        log_file.parent.mkdir(parents=True, exist_ok=True)
        file_handler = logging.FileHandler(log_file, encoding="utf-8")
        file_handler.setFormatter(formatter)
        logger.addHandler(file_handler)

    return logger


def get_logger(name: str) -> logging.Logger:
    """既存のロガーを取得する"""
    return logging.getLogger(name)
