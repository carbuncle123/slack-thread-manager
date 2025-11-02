"""
Claude Agent SDK用のツール定義
スレッドデータの検索・読み込み機能を提供
"""
import json
from pathlib import Path
from typing import List, Dict, Any

DATA_DIR = Path("data")

def read_thread_info(thread_id: str) -> Dict[str, Any]:
    """スレッド情報を読み込む"""
    file_path = DATA_DIR / "threads" / f"{thread_id}.json"
    if not file_path.exists():
        return {"error": "Thread not found"}

    with open(file_path, "r", encoding="utf-8") as f:
        return json.load(f)

def read_messages(thread_id: str) -> Dict[str, Any]:
    """メッセージデータを読み込む"""
    file_path = DATA_DIR / "messages" / f"{thread_id}_messages.json"
    if not file_path.exists():
        return {"error": "Messages not found"}

    with open(file_path, "r", encoding="utf-8") as f:
        return json.load(f)

def read_summary(thread_id: str, summary_type: str) -> Dict[str, Any]:
    """要約データを読み込む (daily or topic)"""
    file_path = DATA_DIR / "summaries" / f"{thread_id}_{summary_type}.json"
    if not file_path.exists():
        return {"error": "Summary not found"}

    with open(file_path, "r", encoding="utf-8") as f:
        return json.load(f)

def search_threads(keyword: str) -> List[Dict[str, Any]]:
    """キーワードでスレッドを検索"""
    threads_dir = DATA_DIR / "threads"
    results = []

    if not threads_dir.exists():
        return results

    for thread_file in threads_dir.glob("*.json"):
        try:
            with open(thread_file, "r", encoding="utf-8") as f:
                thread = json.load(f)
                
                # タイトル、要約、タグで検索
                search_text = " ".join([
                    thread.get("title", "").lower(),
                    thread.get("summary", {}).get("topic", "").lower(),
                    " ".join(thread.get("tags", [])).lower()
                ])
                
                if keyword.lower() in search_text:
                    results.append(thread)
        except (json.JSONDecodeError, IOError):
            continue

    return results

def list_all_threads() -> List[Dict[str, Any]]:
    """全スレッド一覧を取得"""
    threads_dir = DATA_DIR / "threads"
    threads = []

    if not threads_dir.exists():
        return threads

    for thread_file in threads_dir.glob("*.json"):
        try:
            with open(thread_file, "r", encoding="utf-8") as f:
                threads.append(json.load(f))
        except (json.JSONDecodeError, IOError):
            continue

    return threads

def search_messages_content(keyword: str) -> List[Dict[str, Any]]:
    """メッセージ内容をキーワードで検索"""
    messages_dir = DATA_DIR / "messages"
    results = []

    if not messages_dir.exists():
        return results

    for message_file in messages_dir.glob("*_messages.json"):
        try:
            with open(message_file, "r", encoding="utf-8") as f:
                messages_data = json.load(f)
                thread_id = message_file.stem.replace("_messages", "")
                
                for message in messages_data.get("messages", []):
                    if keyword.lower() in message.get("text", "").lower():
                        results.append({
                            "thread_id": thread_id,
                            "message": message,
                            "match_text": message.get("text", "")
                        })
        except (json.JSONDecodeError, IOError):
            continue

    return results