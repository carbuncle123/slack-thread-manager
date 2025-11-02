"""ChatGPT API クライアント"""
import json
from typing import List, Dict, Any
import httpx
from utils.logger import setup_logger

logger = setup_logger(__name__)


class ChatGPTClient:
    """ChatGPT API を使用した要約生成クライアント"""

    def __init__(self, api_key: str, model: str = "gpt-4o", max_tokens: int = 2000):
        self.api_key = api_key
        self.model = model
        self.max_tokens = max_tokens
        self.base_url = "https://api.openai.com/v1/chat/completions"

    async def generate_summary(self, messages: List[Dict[str, Any]], prompt: str) -> str:
        """
        メッセージリストから要約を生成

        Args:
            messages: メッセージリスト
            prompt: 要約生成用プロンプト

        Returns:
            生成された要約テキスト
        """
        try:
            # メッセージを整形
            messages_text = self._format_messages(messages)

            # APIリクエスト
            headers = {
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json"
            }

            payload = {
                "model": self.model,
                "messages": [
                    {
                        "role": "system",
                        "content": prompt
                    },
                    {
                        "role": "user",
                        "content": messages_text
                    }
                ],
                "max_tokens": self.max_tokens,
                "temperature": 0.3
            }

            async with httpx.AsyncClient(timeout=60.0) as client:
                response = await client.post(
                    self.base_url,
                    headers=headers,
                    json=payload
                )
                response.raise_for_status()

                result = response.json()
                summary = result["choices"][0]["message"]["content"]

                logger.info(f"要約生成成功: {len(messages)}件のメッセージから生成")
                return summary.strip()

        except httpx.HTTPStatusError as e:
            logger.error(f"ChatGPT API エラー: {e.response.status_code} - {e.response.text}")
            raise Exception(f"ChatGPT API エラー: {e.response.status_code}")
        except Exception as e:
            logger.error(f"要約生成エラー: {str(e)}")
            raise

    async def generate_topic_summary(self, messages: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        トピック別要約を生成

        Args:
            messages: メッセージリスト

        Returns:
            トピック別要約（JSON形式）
        """
        prompt = """あなたはSlackスレッドの内容を分析し、トピック別に要約する専門家です。

以下のSlackスレッドのメッセージを分析し、議論されている主要なトピックを抽出して、各トピックについて以下の形式のJSON配列で要約してください。

出力形式（JSON配列）:
[
  {
    "topic_name": "トピック名（簡潔に）",
    "status": "議論中 or 解決済み or 保留中",
    "summary": "トピックの要約（2-3文）",
    "conclusion": "結論や決定事項（あれば）",
    "participants": ["参加者1", "参加者2"]
  }
]

重要:
- 必ず有効なJSON配列形式で出力してください
- トピックは主要なもの3-5個程度に絞ってください
- 各トピックの要約は簡潔かつ具体的に"""

        try:
            result_text = await self.generate_summary(messages, prompt)

            # JSONのパース
            # マークダウンのコードブロックを除去
            if "```json" in result_text:
                result_text = result_text.split("```json")[1].split("```")[0].strip()
            elif "```" in result_text:
                result_text = result_text.split("```")[1].split("```")[0].strip()

            topics = json.loads(result_text)

            return {
                "topics": topics,
                "count": len(topics)
            }

        except json.JSONDecodeError as e:
            logger.error(f"JSON パースエラー: {str(e)}")
            logger.error(f"レスポンステキスト: {result_text}")
            # フォールバック: 単純なトピックとして返す
            return {
                "topics": [{
                    "topic_name": "議論全体",
                    "status": "分析中",
                    "summary": result_text[:200],
                    "conclusion": None,
                    "participants": []
                }],
                "count": 1
            }

    async def generate_daily_summary(self, messages: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        日次要約を生成

        Args:
            messages: メッセージリスト（日付でグループ化済み想定）

        Returns:
            日次要約（JSON形式）
        """
        prompt = """あなたはSlackスレッドの日次活動を要約する専門家です。

以下のメッセージを日付ごとに分析し、各日の活動を以下の形式のJSON配列で要約してください。

出力形式（JSON配列）:
[
  {
    "date": "YYYY-MM-DD",
    "message_count": メッセージ数,
    "summary": "その日の活動要約（2-3文）",
    "key_points": ["重要ポイント1", "重要ポイント2"],
    "participants": ["参加者1", "参加者2"]
  }
]

重要:
- 必ず有効なJSON配列形式で出力してください
- メッセージのタイムスタンプから日付を判断してください
- key_pointsは各日2-3個程度に絞ってください"""

        try:
            result_text = await self.generate_summary(messages, prompt)

            # JSONのパース
            if "```json" in result_text:
                result_text = result_text.split("```json")[1].split("```")[0].strip()
            elif "```" in result_text:
                result_text = result_text.split("```")[1].split("```")[0].strip()

            daily_summaries = json.loads(result_text)

            return {
                "daily_summaries": daily_summaries,
                "total_days": len(daily_summaries)
            }

        except json.JSONDecodeError as e:
            logger.error(f"JSON パースエラー: {str(e)}")
            logger.error(f"レスポンステキスト: {result_text}")
            # フォールバック
            return {
                "daily_summaries": [],
                "total_days": 0
            }

    async def generate_overview(self, messages: List[Dict[str, Any]]) -> Dict[str, str]:
        """
        スレッド全体の概要を生成

        Args:
            messages: メッセージリスト

        Returns:
            トピックと概要
        """
        prompt = """あなたはSlackスレッドの内容を簡潔に要約する専門家です。

以下のスレッドの内容を分析し、以下の情報を提供してください:

1. topic: このスレッドの主題を一言で（20文字以内）
2. overview: スレッド全体の概要（2-3行、100文字程度）

以下のJSON形式で出力してください:
{
  "topic": "主題",
  "overview": "概要説明"
}

重要: 必ず有効なJSON形式で出力してください"""

        try:
            result_text = await self.generate_summary(messages, prompt)

            # JSONのパース
            if "```json" in result_text:
                result_text = result_text.split("```json")[1].split("```")[0].strip()
            elif "```" in result_text:
                result_text = result_text.split("```")[1].split("```")[0].strip()

            overview = json.loads(result_text)

            return {
                "topic": overview.get("topic", "議論"),
                "overview": overview.get("overview", "")
            }

        except json.JSONDecodeError as e:
            logger.error(f"JSON パースエラー: {str(e)}")
            return {
                "topic": "議論",
                "overview": result_text[:100] if result_text else "要約の生成に失敗しました"
            }

    def _format_messages(self, messages: List[Dict[str, Any]]) -> str:
        """メッセージリストをテキスト形式に整形"""
        formatted = []

        for msg in messages:
            user = msg.get("user_name", msg.get("user", "Unknown"))
            text = msg.get("text", "")
            timestamp = msg.get("created_at", "")

            formatted.append(f"[{timestamp}] {user}: {text}")

        return "\n".join(formatted)
