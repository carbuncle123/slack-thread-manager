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

            # 回答内容から信頼度を計算
            confidence = self._calculate_confidence(answer_text, related_threads, user_question)

            return {
                "answer": answer_text,
                "confidence": confidence,
                "related_threads": related_threads
            }

        except Exception as e:
            logger.error(f"Claude Agent query failed: {e}", exc_info=True)
            raise

    def _calculate_confidence(self, answer_text: str, related_threads: List[Dict[str, Any]],
                              user_question: str) -> float:
        """
        回答内容から信頼度を計算

        評価基準:
        - 関連スレッドの数
        - 回答の長さと詳細度
        - 具体的な情報（ID、タイトル等）の有無
        - ネガティブワード（見つかりませんでした、不明等）の有無
        """
        confidence = 0.5  # ベーススコア

        # 1. 関連スレッドによる加点 (最大+0.3)
        if related_threads:
            # スレッド数に応じて加点（1-3個で最大）
            thread_bonus = min(len(related_threads) * 0.1, 0.3)
            confidence += thread_bonus

        # 2. 回答の詳細度による加点 (最大+0.2)
        answer_length = len(answer_text)
        if answer_length > 500:
            confidence += 0.2
        elif answer_length > 200:
            confidence += 0.1
        elif answer_length > 100:
            confidence += 0.05

        # 3. 具体的な情報の有無による加点 (最大+0.15)
        has_thread_id = bool(re.search(r'thread_[a-z0-9]+|[TC][A-Z0-9]+', answer_text))
        has_url = 'https://' in answer_text or 'http://' in answer_text
        has_structured_info = '**' in answer_text or '##' in answer_text  # マークダウン構造

        if has_thread_id:
            confidence += 0.05
        if has_url:
            confidence += 0.05
        if has_structured_info:
            confidence += 0.05

        # 4. ネガティブワードによる減点 (最大-0.3)
        negative_patterns = [
            r'見つかりませんでした',
            r'該当する.*?ありません',
            r'不明',
            r'わかりません',
            r'確認できません',
            r'存在しません'
        ]

        negative_count = 0
        for pattern in negative_patterns:
            if re.search(pattern, answer_text):
                negative_count += 1

        if negative_count > 0:
            confidence -= min(negative_count * 0.1, 0.3)

        # 5. 質問との関連性チェック (簡易版)
        # 質問のキーワードが回答に含まれているかチェック
        question_keywords = [word for word in user_question.split() if len(word) > 2]
        keyword_matches = sum(1 for kw in question_keywords if kw in answer_text)

        if question_keywords and keyword_matches / len(question_keywords) > 0.5:
            confidence += 0.1

        # 最終的に0.0-1.0の範囲に収める
        confidence = max(0.0, min(1.0, confidence))

        return round(confidence, 2)

    def _extract_related_threads(self, answer_text: str) -> List[Dict[str, Any]]:
        """
        回答テキストからスレッド情報を抽出
        """
        related_threads = []
        # 改善: より多くのパターンでスレッドIDを検索
        thread_id_patterns = [
            r'スレッドID[:\s]*`?([a-z0-9_]+)`?',  # スレッドID: thread_xxx
            r'ID[:\s]*`?([TC][A-Z0-9]+)`?',        # ID: Txxx or Cxxx
            r'`(thread_[a-z0-9]+)`',                # `thread_xxx`
        ]

        seen_ids = set()
        for pattern in thread_id_patterns:
            matches = re.findall(pattern, answer_text, re.IGNORECASE)
            for thread_id in matches:
                if thread_id not in seen_ids:
                    seen_ids.add(thread_id)
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
