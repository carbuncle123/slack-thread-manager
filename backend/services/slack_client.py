import httpx
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta

from models.message import Message, Reaction
from utils.logger import get_logger

logger = get_logger(__name__)


class SlackClient:
    """Slack API クライアント (xoxc token + cookie認証)"""

    def __init__(self, xoxc_token: str, cookie: str, workspace: str = ""):
        self.xoxc_token = xoxc_token
        self.cookie = cookie
        self.workspace = workspace
        self.base_url = "https://slack.com/api"

    def _get_headers(self) -> Dict[str, str]:
        """HTTPヘッダーを取得"""
        return {
            "Authorization": f"Bearer {self.xoxc_token}",
            "Cookie": f"d={self.cookie}",
            "Content-Type": "application/json; charset=utf-8",
        }

    async def _make_request(
        self,
        endpoint: str,
        params: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """Slack APIリクエストを実行"""
        url = f"{self.base_url}/{endpoint}"

        async with httpx.AsyncClient() as client:
            try:
                response = await client.get(
                    url,
                    headers=self._get_headers(),
                    params=params,
                    timeout=30.0
                )
                response.raise_for_status()
                data = response.json()

                if not data.get("ok"):
                    error = data.get("error", "Unknown error")
                    raise Exception(f"Slack API error: {error}")

                return data

            except httpx.HTTPStatusError as e:
                logger.error(f"HTTP error occurred: {e}")
                raise
            except Exception as e:
                logger.error(f"Request failed: {e}")
                raise

    async def get_thread_messages(
        self,
        channel_id: str,
        thread_ts: str
    ) -> List[Message]:
        """スレッドのメッセージを取得"""
        logger.info(f"Fetching messages for thread: {channel_id}/{thread_ts}")

        try:
            data = await self._make_request(
                "conversations.replies",
                params={
                    "channel": channel_id,
                    "ts": thread_ts,
                    "limit": 1000  # 最大1000件
                }
            )

            messages_data = data.get("messages", [])
            messages = []

            for msg_data in messages_data:
                # リアクションを解析
                reactions = []
                for reaction_data in msg_data.get("reactions", []):
                    reactions.append(Reaction(
                        name=reaction_data.get("name", ""),
                        count=reaction_data.get("count", 0)
                    ))

                # タイムスタンプを日時に変換
                ts = msg_data.get("ts", "")
                created_at = datetime.fromtimestamp(float(ts))

                message = Message(
                    ts=ts,
                    user=msg_data.get("user", ""),
                    user_name=msg_data.get("user_name"),  # 後でユーザー情報取得で補完
                    text=msg_data.get("text", ""),
                    reactions=reactions,
                    files=msg_data.get("files", []),
                    created_at=created_at
                )
                messages.append(message)

            logger.info(f"Fetched {len(messages)} messages")
            return messages

        except Exception as e:
            logger.error(f"Failed to fetch thread messages: {e}")
            raise

    async def get_user_info(self, user_id: str) -> Optional[Dict[str, Any]]:
        """ユーザー情報を取得"""
        try:
            data = await self._make_request(
                "users.info",
                params={"user": user_id}
            )
            return data.get("user")
        except Exception as e:
            logger.error(f"Failed to fetch user info for {user_id}: {e}")
            return None

    async def search_messages(
        self,
        query: str,
        count: int = 100
    ) -> List[Dict[str, Any]]:
        """メッセージを検索"""
        try:
            data = await self._make_request(
                "search.messages",
                params={
                    "query": query,
                    "count": count
                }
            )
            return data.get("messages", {}).get("matches", [])
        except Exception as e:
            logger.error(f"Failed to search messages: {e}")
            raise

    async def get_channel_history(
        self,
        channel_id: str,
        oldest: Optional[str] = None,
        latest: Optional[str] = None,
        limit: int = 100
    ) -> List[Dict[str, Any]]:
        """チャンネルの履歴を取得"""
        params = {
            "channel": channel_id,
            "limit": limit
        }

        if oldest:
            params["oldest"] = oldest
        if latest:
            params["latest"] = latest

        try:
            data = await self._make_request("conversations.history", params=params)
            return data.get("messages", [])
        except Exception as e:
            logger.error(f"Failed to fetch channel history: {e}")
            raise

    async def find_threads_with_mention(
        self,
        channel_id: str,
        user_id: str,
        days_back: int = 7
    ) -> List[Dict[str, Any]]:
        """特定のメンションを含むスレッドを検出"""
        # 検索期間の開始日を計算
        start_date = datetime.now() - timedelta(days=days_back)
        date_filter = start_date.strftime("after:%Y-%m-%d")
        
        # search.messagesを使用してメンションを検索（日付制限付き）
        query = f"in:<#{channel_id}> <@{user_id}> {date_filter}"

        try:
            matches = await self.search_messages(query, count=100)

            # スレッドの親メッセージのみを抽出
            threads = []
            seen_threads = set()

            for match in matches:
                thread_ts = match.get("thread_ts") or match.get("ts")

                if thread_ts not in seen_threads:
                    seen_threads.add(thread_ts)
                    threads.append({
                        "channel_id": match.get("channel", {}).get("id"),
                        "thread_ts": thread_ts,
                        "text": match.get("text", ""),
                        "user": match.get("user"),
                        "ts": match.get("ts")
                    })

            logger.info(f"Found {len(threads)} threads with mention in the past {days_back} days")
            return threads

        except Exception as e:
            logger.error(f"Failed to find threads with mention: {e}")
            raise
