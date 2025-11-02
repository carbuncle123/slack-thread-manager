"""
Claude Agent SDKクライアント (ローカルClaude Code版)
自然言語質問に対してローカルスレッドデータを検索・分析し回答を生成
"""
import json
import re
from typing import Dict, Any, List
from claude_agent_sdk import query, ClaudeAgentOptions, create_sdk_mcp_server, tool

from tools.thread_tools import (
    read_thread_info,
    read_messages,
    read_summary,
    search_threads,
    list_all_threads,
    search_messages_content
)
from utils.logger import get_logger

logger = get_logger(__name__)


# MCP ツール定義
@tool("read_thread_info", "指定されたスレッドの基本情報を取得します", {"thread_id": str})
async def tool_read_thread_info(args):
    """スレッド情報を取得"""
    result = read_thread_info(args["thread_id"])
    return {"content": [{"type": "text", "text": json.dumps(result, ensure_ascii=False, indent=2)}]}


@tool("read_messages", "指定されたスレッドの全メッセージを取得します", {"thread_id": str})
async def tool_read_messages(args):
    """メッセージデータを取得"""
    result = read_messages(args["thread_id"])
    return {"content": [{"type": "text", "text": json.dumps(result, ensure_ascii=False, indent=2)}]}


@tool("read_summary", "指定されたスレッドの要約を取得します", {"thread_id": str, "summary_type": str})
async def tool_read_summary(args):
    """要約データを取得"""
    result = read_summary(args["thread_id"], args["summary_type"])
    return {"content": [{"type": "text", "text": json.dumps(result, ensure_ascii=False, indent=2)}]}


@tool("search_threads", "キーワードでスレッドを検索します", {"keyword": str})
async def tool_search_threads(args):
    """スレッド検索"""
    result = search_threads(args["keyword"])
    return {"content": [{"type": "text", "text": json.dumps(result, ensure_ascii=False, indent=2)}]}


@tool("search_messages_content", "メッセージ内容をキーワードで検索します", {"keyword": str})
async def tool_search_messages_content(args):
    """メッセージ内容検索"""
    result = search_messages_content(args["keyword"])
    return {"content": [{"type": "text", "text": json.dumps(result, ensure_ascii=False, indent=2)}]}


@tool("list_all_threads", "全てのスレッドの一覧を取得します", {})
async def tool_list_all_threads(args):
    """全スレッド一覧取得"""
    result = list_all_threads()
    return {"content": [{"type": "text", "text": json.dumps(result, ensure_ascii=False, indent=2)}]}


class ClaudeAgentClient:
    def __init__(self):
        """Claude Agent SDKクライアントを初期化 (ローカルClaude Code接続)"""
        # MCPサーバーを作成
        self.mcp_server = create_sdk_mcp_server(
            name="slack_thread_tools",
            version="1.0.0",
            tools=[
                tool_read_thread_info,
                tool_read_messages,
                tool_read_summary,
                tool_search_threads,
                tool_search_messages_content,
                tool_list_all_threads
            ]
        )

        # システムプロンプト
        self.system_prompt = """
あなたはSlackスレッド管理アプリケーションのアシスタントです。
ユーザーの質問に対して、ローカルに保存されているスレッドデータを検索・分析し、回答してください。

利用可能なツール:
- read_thread_info: スレッドの基本情報を取得
- read_messages: スレッドの全メッセージを取得
- read_summary: スレッドの要約 (日次 or トピック別) を取得
- search_threads: キーワードでスレッドを検索
- search_messages_content: メッセージ内容をキーワードで検索
- list_all_threads: 全スレッド一覧を取得

回答には以下を含めてください:
1. 質問への直接的な回答
2. 該当するスレッドID、タイトル
3. 関連する情報の引用
"""

    async def query(self, user_question: str) -> Dict[str, Any]:
        """
        ユーザーの質問に対してClaude Agent (ローカル) で回答
        非同期版
        """
        logger.info(f"Processing query with local Claude Code: {user_question}")

        try:
            # クエリオプション設定
            options = ClaudeAgentOptions(
                system_prompt=self.system_prompt,
                mcp_servers={"slack_tools": self.mcp_server},
                permission_mode="acceptEdits"  # ツール実行を自動許可
            )

            # Claude Agent SDKで質問を実行
            answer_parts = []
            async for message in query(prompt=user_question, options=options):
                # メッセージから回答を抽出
                if hasattr(message, 'content'):
                    for block in message.content:
                        if hasattr(block, 'text'):
                            answer_parts.append(block.text)

            answer_text = "\n".join(answer_parts) if answer_parts else "回答を取得できませんでした"

            # 回答から関連スレッド情報を抽出
            related_threads = self._extract_related_threads(answer_text)

            return {
                "answer": answer_text,
                "confidence": 0.85,  # 実際には回答内容から推定
                "related_threads": related_threads
            }

        except Exception as e:
            logger.error(f"Claude Agent query failed: {e}", exc_info=True)
            raise

    def _extract_related_threads(self, answer_text: str) -> List[Dict[str, Any]]:
        """
        回答テキストからスレッド情報を抽出
        """
        related_threads = []
        # 簡易的な実装: "ID: " パターンを検索
        thread_id_pattern = r'ID:\s*([TC][A-Z0-9]+)'
        matches = re.findall(thread_id_pattern, answer_text)

        for thread_id in matches:
            thread_info = read_thread_info(thread_id)
            if "error" not in thread_info:
                related_threads.append({
                    "thread_id": thread_id,
                    "title": thread_info.get("title", ""),
                    "url": thread_info.get("url", "")
                })

        return related_threads

    def _local_search_fallback(self, user_question: str) -> Dict[str, Any]:
        """
        Claude SDKが利用できない場合のローカル検索フォールバック
        """
        logger.info("Using local search fallback")

        # 簡単なキーワード抽出
        keywords = [word.strip() for word in user_question.split() if len(word.strip()) > 2]

        results = []
        related_threads = []

        for keyword in keywords[:3]:  # 最大3つのキーワードで検索
            # スレッド検索
            thread_results = search_threads(keyword)
            results.extend(thread_results)

            # メッセージ検索
            message_results = search_messages_content(keyword)
            for msg_result in message_results:
                thread_id = msg_result["thread_id"]
                if thread_id not in [t.get("thread_id") for t in related_threads]:
                    thread_info = read_thread_info(thread_id)
                    if "error" not in thread_info:
                        related_threads.append({
                            "thread_id": thread_id,
                            "title": thread_info.get("title", ""),
                            "url": thread_info.get("url", "")
                        })

        # 結果をまとめて回答生成
        if results or related_threads:
            answer = f"「{user_question}」に関連する情報を見つけました。\n\n"

            if related_threads:
                answer += "関連するスレッド:\n"
                for thread in related_threads[:5]:  # 最大5つのスレッド
                    answer += f"- {thread['title']} (ID: {thread['thread_id']})\n"

            if results:
                answer += f"\n{len(results)}件のスレッドが該当しました。"

            confidence = min(0.7, len(related_threads) * 0.1 + 0.3)
        else:
            answer = "申し訳ございませんが、該当する情報が見つかりませんでした。"
            confidence = 0.1

        return {
            "answer": answer,
            "confidence": confidence,
            "related_threads": related_threads[:5]
        }
