#!/usr/bin/env python3
"""
簡易的なAPIテストスクリプト
バックエンドが起動している状態で実行してください
"""

import requests
import json

BASE_URL = "http://localhost:8000"


def test_health():
    """ヘルスチェック"""
    print("\n=== Health Check ===")
    response = requests.get(f"{BASE_URL}/api/health")
    print(f"Status: {response.status_code}")
    print(json.dumps(response.json(), indent=2, ensure_ascii=False))


def test_create_thread():
    """スレッド作成テスト"""
    print("\n=== Create Thread ===")
    data = {
        "channel_id": "C1234567890",
        "thread_ts": "1234567890.123456",
        "title": "テストスレッド - 認証機能について",
        "tags": ["認証", "テスト"]
    }
    response = requests.post(f"{BASE_URL}/api/threads", json=data)
    print(f"Status: {response.status_code}")
    print(json.dumps(response.json(), indent=2, ensure_ascii=False))
    return response.json().get("id")


def test_get_threads():
    """スレッド一覧取得テスト"""
    print("\n=== Get Threads ===")
    response = requests.get(f"{BASE_URL}/api/threads")
    print(f"Status: {response.status_code}")
    data = response.json()
    print(f"Total threads: {data['total']}")
    for thread in data['threads']:
        print(f"  - {thread['title']} (ID: {thread['id']})")


def test_get_thread(thread_id):
    """個別スレッド取得テスト"""
    print(f"\n=== Get Thread: {thread_id} ===")
    response = requests.get(f"{BASE_URL}/api/threads/{thread_id}")
    print(f"Status: {response.status_code}")
    print(json.dumps(response.json(), indent=2, ensure_ascii=False))


def test_update_thread(thread_id):
    """スレッド更新テスト"""
    print(f"\n=== Update Thread: {thread_id} ===")
    data = {
        "title": "更新されたテストスレッド",
        "tags": ["認証", "テスト", "更新済み"]
    }
    response = requests.put(f"{BASE_URL}/api/threads/{thread_id}", json=data)
    print(f"Status: {response.status_code}")
    print(json.dumps(response.json(), indent=2, ensure_ascii=False))


def test_mark_as_read(thread_id):
    """既読マークテスト"""
    print(f"\n=== Mark as Read: {thread_id} ===")
    response = requests.post(f"{BASE_URL}/api/threads/{thread_id}/mark-read")
    print(f"Status: {response.status_code}")
    print(json.dumps(response.json(), indent=2, ensure_ascii=False))


def test_get_config():
    """設定取得テスト"""
    print("\n=== Get Config ===")
    response = requests.get(f"{BASE_URL}/api/config")
    print(f"Status: {response.status_code}")
    data = response.json()
    # センシティブ情報をマスク
    if "slack" in data:
        data["slack"]["xoxc_token"] = "***masked***"
        data["slack"]["cookie"] = "***masked***"
    print(json.dumps(data, indent=2, ensure_ascii=False))


def main():
    """メイン処理"""
    print("=" * 50)
    print("Slack Thread Manager API Test")
    print("=" * 50)

    try:
        # ヘルスチェック
        test_health()

        # 設定確認
        test_get_config()

        # スレッド作成
        thread_id = test_create_thread()

        if thread_id:
            # スレッド一覧取得
            test_get_threads()

            # 個別スレッド取得
            test_get_thread(thread_id)

            # スレッド更新
            test_update_thread(thread_id)

            # 既読マーク
            test_mark_as_read(thread_id)

            # 更新後の確認
            test_get_thread(thread_id)

        print("\n" + "=" * 50)
        print("All tests completed!")
        print("=" * 50)

    except requests.exceptions.ConnectionError:
        print("\nError: Cannot connect to the API server.")
        print("Please make sure the backend is running at http://localhost:8000")
    except Exception as e:
        print(f"\nError: {e}")


if __name__ == "__main__":
    main()
