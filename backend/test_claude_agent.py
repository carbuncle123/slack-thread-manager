"""
Claude Agent SDKのテストスクリプト
"""
import sys
from pathlib import Path

# プロジェクトルートをパスに追加
sys.path.insert(0, str(Path(__file__).parent))

from services.claude_agent import ClaudeAgentClient

def test_query():
    """クエリのテスト"""
    client = ClaudeAgentClient()

    print("Claude Agent Client initialized")
    print(f"MCP Server: {client.mcp_server}")

    test_query = "認証に関するスレッドを教えてください"
    print(f"\nTesting query: {test_query}")

    try:
        result = client.query(test_query)
        print(f"\nResult:")
        print(f"Answer: {result['answer']}")
        print(f"Confidence: {result['confidence']}")
        print(f"Related threads: {result['related_threads']}")
    except Exception as e:
        print(f"\nError: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    test_query()
