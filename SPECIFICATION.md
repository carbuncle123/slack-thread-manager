# Slack スレッド管理アプリケーション 機能仕様書

## 1. 概要・目的

### 1.1 アプリケーション概要
本アプリケーションは、Slackの複数チャンネル・複数スレッドで行われるコミュニケーションのキャッチアップを支援するローカルWebアプリケーションです。

### 1.2 ターゲットユーザー
- エンジニアチームのマネージャー
- 複数のチャンネル・スレッドを日常的に追跡する必要がある方
- 過去のディスカッションを効率的に検索・参照したい方

### 1.3 解決する課題
- 複数スレッドの最新状態の把握が困難
- スレッド内の長い議論の要点把握に時間がかかる
- 過去の議論の検索・参照が非効率
- 重要なスレッドの見落とし

---

## 2. 機能要件

### 2.1 スレッド管理機能

#### 2.1.1 スレッド登録
- **概要**: キャッチアップ対象のSlackスレッドを手動で登録・管理する
- **入力情報**:
  - チャンネルID
  - スレッドタイムスタンプ (thread_ts)
  - タイトル (ユーザー入力)
  - タグ (複数設定可能、任意)
- **自動取得情報**:
  - スレッドURL
  - メッセージ開始日時
  - 最新メッセージ投稿日時

#### 2.1.2 スレッド一覧表示
- **表示形式**: テーブル形式
- **表示項目**:
  - タイトル (リンク付き)
  - トピック要約 (自動生成)
  - メッセージ開始日時
  - 最新メッセージ投稿日時
  - タグ
  - 未読メッセージ有無 (バッジ表示)
  - 新規メッセージ件数
- **操作機能**:
  - ソート (各カラムでの昇順・降順)
  - フィルタリング:
    - タグによるフィルタ
    - 未読/既読フィルタ
    - 日付範囲フィルタ
  - 検索ボックス (タイトル、要約の全文検索)
  - スレッド削除
  - スレッド編集 (タイトル、タグ)

#### 2.1.3 スレッド詳細表示
- **表示内容**:
  - スレッド基本情報
  - メッセージ一覧 (時系列)
  - 日次要約セクション
  - トピック別要約セクション
- **操作**:
  - Slackで開くボタン
  - 既読マークボタン
  - データ再取得ボタン

### 2.2 スレッドデータ取得機能

#### 2.2.1 データ取得方式
- **定期取得**: 設定された間隔で自動取得
  - デフォルト: 30分ごと (設定で変更可能)
  - バックグラウンドで実行
- **手動取得**: ユーザーがボタンクリックで即時取得
  - 全スレッド一括取得
  - 個別スレッド取得

#### 2.2.2 取得データ
- スレッド内の全メッセージ
  - メッセージテキスト
  - 投稿者情報
  - タイムスタンプ
  - リアクション
  - 添付ファイル情報 (メタデータのみ)

#### 2.2.3 新規メッセージ検出
- 前回取得時以降の新規メッセージを検出
- 新規メッセージ数をカウント
- 一覧画面でバッジ表示
- 未読状態を管理

#### 2.2.4 データ整理処理
取得後、以下の処理を自動実行:
1. メッセージデータの保存
2. トピック要約の生成/更新
3. 日次要約の生成/更新
4. 最終更新日時の記録

### 2.3 新規スレッド発見機能

#### 2.3.1 監視設定
- **設定項目**:
  - 監視対象チャンネル (複数設定可)
  - 検出条件:
    - メンションユーザー (例: @username)
    - キーワード (任意)
    - 時間範囲 (過去N日間)

#### 2.3.2 発見通知
- 条件に一致する未登録スレッドを検出
- 発見スレッド一覧を表示:
  - チャンネル名
  - スレッド最初のメッセージ (プレビュー)
  - 開始日時
  - メッセージ数
- 一括登録機能
- 個別登録/スキップ機能

### 2.4 個別スレッド情報整理機能

#### 2.4.1 日次要約生成
- **処理内容**:
  - 1日単位でメッセージをグループ化
  - 各日のやり取りを要約 (ChatGPT APIを使用)
  - 主要な議論ポイントを箇条書きで抽出
- **要約内容**:
  - その日の議論テーマ
  - 主な発言内容
  - 決定事項
  - 未解決の課題

#### 2.4.2 トピック別要約生成
- **処理内容**:
  - スレッド全体のメッセージを分析
  - 議論されているトピックを自動抽出
  - トピックごとに関連メッセージを整理
  - 各トピックの要約を生成
- **要約内容**:
  - トピック名
  - 議論の概要
  - 結論/現状
  - 関連メッセージへのリンク

#### 2.4.3 要約の表示
- スレッド詳細画面に2つのタブで表示:
  - 「日次要約」タブ
  - 「トピック別要約」タブ
- 要約をクリックで該当メッセージへジャンプ
- 要約の再生成機能

### 2.5 スレッド横断検索・質問機能

#### 2.5.1 自然言語質問
- **機能概要**:
  - 自然文での質問入力
  - Claude Agent SDKを使用してローカルで処理
  - 保存されている全スレッドデータを検索対象

- **質問例**:
  - "認証機能の実装についての議論はどのスレッドで行われていますか?"
  - "データベース選定の結論はどうなりましたか?"
  - "先週議論された課題で未解決のものは?"

#### 2.5.2 回答生成
- **処理フロー**:
  1. 質問をClaude Agent SDKに送信
  2. エージェントがローカルのスレッドデータファイルを検索・分析
  3. 関連する情報を抽出
  4. 回答を生成

- **回答内容**:
  - 質問への直接的な回答
  - 該当するスレッドへのリンク
  - 関連するメッセージの引用
  - 情報の確信度表示

#### 2.5.3 検索履歴
- 過去の質問と回答を保存
- 履歴から再検索可能
- 質問のブックマーク機能

---

## 3. 非機能要件

### 3.1 パフォーマンス
- スレッド一覧表示: 1秒以内
- 個別スレッド表示: 2秒以内
- メッセージ取得: スレッドあたり5秒以内
- 要約生成: スレッドあたり30秒以内 (バックグラウンド処理)

### 3.2 セキュリティ
- Slack認証情報 (xoxc token, cookie) の安全な保存
- 認証情報ファイルの暗号化推奨
- localhostのみでの動作 (外部アクセス不可)
- データは全てローカルに保存

### 3.3 運用性
- エラーログの記録
- データバックアップ機能
- 設定のエクスポート/インポート
- データ削除機能 (プライバシー保護)

### 3.4 拡張性
- 新しいLLMプロバイダーの追加が容易
- データ形式の変更に対応可能
- プラグイン機構の検討

---

## 4. 技術スタック

### 4.1 フロントエンド
- **フレームワーク**: React 18+
- **言語**: TypeScript
- **UIライブラリ**:
  - Material-UI または Ant Design (テーブル、フォーム)
  - React Router (ルーティング)
- **状態管理**: React Context API または Zustand
- **HTTPクライアント**: Axios
- **ビルドツール**: Vite

### 4.2 バックエンド
- **フレームワーク**: FastAPI (Python 3.10+)
- **非同期処理**: asyncio
- **定期実行**: APScheduler
- **HTTPクライアント**: httpx (Slack API呼び出し)
- **LLM統合**:
  - OpenAI Python SDK (ChatGPT API)
  - Claude Agent SDK (ローカルLLMエージェント)

### 4.3 データ保存
- **形式**: JSON形式のファイル
- **構造**:
  ```
  data/
  ├── threads/           # スレッド情報
  │   ├── thread_001.json
  │   ├── thread_002.json
  │   └── ...
  ├── messages/          # メッセージデータ
  │   ├── thread_001_messages.json
  │   ├── thread_002_messages.json
  │   └── ...
  ├── summaries/         # 要約データ
  │   ├── thread_001_daily.json
  │   ├── thread_001_topic.json
  │   └── ...
  ├── config.json        # アプリケーション設定
  └── search_history.json # 検索履歴
  ```

### 4.4 外部API
- **Slack API**:
  - conversations.history
  - conversations.replies
  - search.messages
  - 認証: xoxc token + cookie
- **ChatGPT API**:
  - gpt-4-turbo または gpt-4o (要約生成)
- **Claude Agent SDK**:
  - ローカルでの質問応答処理

---

## 5. システムアーキテクチャ

### 5.1 アプリケーション構成

```
┌─────────────────────────────────────────┐
│          Browser (localhost:3000)       │
│  ┌───────────────────────────────────┐  │
│  │      React Frontend (Vite)        │  │
│  │  - スレッド一覧                    │  │
│  │  - スレッド詳細                    │  │
│  │  - 検索・質問UI                   │  │
│  └───────────────────────────────────┘  │
└─────────────────┬───────────────────────┘
                  │ HTTP/REST API
                  │
┌─────────────────▼───────────────────────┐
│    FastAPI Backend (localhost:8000)     │
│  ┌───────────────────────────────────┐  │
│  │         API Endpoints             │  │
│  ├───────────────────────────────────┤  │
│  │      Business Logic Layer         │  │
│  │  - スレッド管理                    │  │
│  │  - データ取得スケジューラー         │  │
│  │  - 要約生成                       │  │
│  │  - 検索・質問処理                  │  │
│  ├───────────────────────────────────┤  │
│  │      External Service Layer       │  │
│  │  - Slack API Client               │  │
│  │  - ChatGPT API Client             │  │
│  │  - Claude Agent SDK Client        │  │
│  ├───────────────────────────────────┤  │
│  │      Data Access Layer            │  │
│  │  - JSONファイル読み書き            │  │
│  └───────────────────────────────────┘  │
└─────────────────┬───────────────────────┘
                  │
┌─────────────────▼───────────────────────┐
│         Local File System               │
│  data/                                  │
│  ├── threads/                           │
│  ├── messages/                          │
│  ├── summaries/                         │
│  └── config.json                        │
└─────────────────────────────────────────┘

External Services:
├── Slack API (via xoxc token + cookie)
├── ChatGPT API (要約生成)
└── Claude Agent SDK (ローカル質問応答)
```

### 5.2 データフロー

#### 5.2.1 スレッドデータ取得フロー
```
1. ユーザー操作 or スケジューラー起動
   ↓
2. FastAPI: Slack API呼び出し
   ↓
3. メッセージデータ取得
   ↓
4. JSONファイルに保存 (messages/)
   ↓
5. 新規メッセージ検出・カウント
   ↓
6. スレッド情報更新 (threads/)
   ↓
7. 要約生成キュー追加 (非同期)
   ↓
8. フロントエンドに結果返却
```

#### 5.2.2 要約生成フロー
```
1. バックグラウンドタスク起動
   ↓
2. メッセージデータ読み込み
   ↓
3. ChatGPT APIで要約生成
   - 日次要約
   - トピック別要約
   ↓
4. 要約データ保存 (summaries/)
   ↓
5. スレッド情報に要約完了フラグ
```

#### 5.2.3 質問応答フロー
```
1. ユーザーが質問入力
   ↓
2. FastAPI: Claude Agent SDKを起動
   ↓
3. Claude Agent: data/配下のファイルを検索
   ↓
4. Claude Agent: 関連情報を抽出・分析
   ↓
5. Claude Agent: 回答生成
   ↓
6. 回答をフロントエンドに返却
   ↓
7. 検索履歴に保存
```

---

## 6. データモデル

### 6.1 スレッド情報 (threads/thread_{id}.json)

```json
{
  "id": "thread_001",
  "channel_id": "C1234567890",
  "thread_ts": "1234567890.123456",
  "title": "認証機能の実装について",
  "url": "https://workspace.slack.com/archives/C1234567890/p1234567890123456",
  "tags": ["認証", "セキュリティ", "優先度高"],
  "created_at": "2025-01-15T10:30:00Z",
  "updated_at": "2025-01-20T15:45:00Z",
  "last_message_ts": "1234987654.789012",
  "message_count": 45,
  "new_message_count": 3,
  "is_read": false,
  "has_daily_summary": true,
  "has_topic_summary": true,
  "summary": {
    "topic": "OAuth 2.0とJWT認証の実装方針について議論",
    "generated_at": "2025-01-20T16:00:00Z"
  }
}
```

### 6.2 メッセージデータ (messages/thread_{id}_messages.json)

```json
{
  "thread_id": "thread_001",
  "channel_id": "C1234567890",
  "thread_ts": "1234567890.123456",
  "messages": [
    {
      "ts": "1234567890.123456",
      "user": "U0987654321",
      "user_name": "Takeshi",
      "text": "認証機能の実装について相談させてください",
      "reactions": [
        {
          "name": "thumbsup",
          "count": 3
        }
      ],
      "files": [],
      "created_at": "2025-01-15T10:30:00Z"
    },
    {
      "ts": "1234567891.234567",
      "user": "U1234567890",
      "user_name": "Yamada",
      "text": "OAuth 2.0がいいと思います",
      "reactions": [],
      "files": [],
      "created_at": "2025-01-15T10:35:00Z"
    }
  ],
  "last_fetched_at": "2025-01-20T15:45:00Z"
}
```

### 6.3 日次要約 (summaries/thread_{id}_daily.json)

```json
{
  "thread_id": "thread_001",
  "summaries": [
    {
      "date": "2025-01-15",
      "message_count": 12,
      "summary": "## 1月15日の議論\n\n### 主なトピック\n- OAuth 2.0とJWT認証の比較\n- セキュリティ要件の確認\n\n### 主な発言\n- Takeshi: 認証機能の実装方針について提案\n- Yamada: OAuth 2.0の採用を推奨\n- Sato: セキュリティ監査の必要性を指摘\n\n### 決定事項\n- OAuth 2.0を採用する方向で検討\n\n### 未解決の課題\n- トークンの有効期限設定",
      "participants": ["U0987654321", "U1234567890", "U2345678901"],
      "generated_at": "2025-01-15T18:00:00Z"
    },
    {
      "date": "2025-01-16",
      "message_count": 8,
      "summary": "...",
      "participants": ["U0987654321", "U1234567890"],
      "generated_at": "2025-01-16T18:00:00Z"
    }
  ],
  "last_updated_at": "2025-01-20T16:00:00Z"
}
```

### 6.4 トピック別要約 (summaries/thread_{id}_topic.json)

```json
{
  "thread_id": "thread_001",
  "topics": [
    {
      "topic_id": "topic_001",
      "title": "OAuth 2.0 vs JWT認証",
      "summary": "OAuth 2.0とJWT認証の比較検討。最終的にOAuth 2.0を採用する方向で合意。JWTはトークン形式として使用。",
      "conclusion": "OAuth 2.0を採用、トークン形式にJWTを使用",
      "status": "決定",
      "related_messages": [
        "1234567890.123456",
        "1234567891.234567",
        "1234567892.345678"
      ],
      "participants": ["U0987654321", "U1234567890", "U2345678901"]
    },
    {
      "topic_id": "topic_002",
      "title": "トークン有効期限の設定",
      "summary": "アクセストークンとリフレッシュトークンの有効期限について議論中。セキュリティとUXのバランスを検討。",
      "conclusion": "未定",
      "status": "議論中",
      "related_messages": [
        "1234567893.456789",
        "1234567894.567890"
      ],
      "participants": ["U0987654321", "U2345678901"]
    }
  ],
  "generated_at": "2025-01-20T16:00:00Z"
}
```

### 6.5 アプリケーション設定 (data/config.json)

```json
{
  "slack": {
    "workspace": "myworkspace",
    "xoxc_token": "xoxc-encrypted-token",
    "cookie": "d-encrypted-cookie",
    "monitored_channels": [
      {
        "channel_id": "C1234567890",
        "channel_name": "engineering",
        "mention_users": ["U0987654321"],
        "keywords": []
      }
    ]
  },
  "sync": {
    "auto_sync_enabled": true,
    "sync_interval_minutes": 30,
    "last_sync_at": "2025-01-20T15:45:00Z"
  },
  "llm": {
    "chatgpt": {
      "api_key": "sk-encrypted-key",
      "model": "gpt-4o",
      "max_tokens": 2000
    },
    "claude_agent": {
      "enabled": true,
      "model": "claude-sonnet-4.5"
    }
  },
  "app": {
    "theme": "light",
    "items_per_page": 20
  }
}
```

### 6.6 検索履歴 (data/search_history.json)

```json
{
  "queries": [
    {
      "id": "query_001",
      "query": "認証機能の実装についての結論は?",
      "answer": "OAuth 2.0を採用し、トークン形式にJWTを使用することで決定しました。関連する議論は「認証機能の実装について」スレッドで行われています。",
      "related_threads": ["thread_001"],
      "created_at": "2025-01-20T14:30:00Z",
      "is_bookmarked": true
    }
  ]
}
```

---

## 7. API設計

### 7.1 エンドポイント一覧

#### 7.1.1 スレッド管理

| メソッド | エンドポイント | 説明 |
|---------|--------------|------|
| GET | /api/threads | スレッド一覧取得 |
| GET | /api/threads/{thread_id} | 個別スレッド情報取得 |
| POST | /api/threads | 新規スレッド登録 |
| PUT | /api/threads/{thread_id} | スレッド情報更新 |
| DELETE | /api/threads/{thread_id} | スレッド削除 |
| POST | /api/threads/{thread_id}/mark-read | 既読マーク |

#### 7.1.2 メッセージ取得

| メソッド | エンドポイント | 説明 |
|---------|--------------|------|
| GET | /api/threads/{thread_id}/messages | メッセージ一覧取得 |
| POST | /api/threads/{thread_id}/sync | メッセージ同期 (Slackから取得) |
| POST | /api/sync/all | 全スレッド同期 |

#### 7.1.3 要約

| メソッド | エンドポイント | 説明 |
|---------|--------------|------|
| GET | /api/threads/{thread_id}/summary/daily | 日次要約取得 |
| GET | /api/threads/{thread_id}/summary/topic | トピック別要約取得 |
| POST | /api/threads/{thread_id}/summary/generate | 要約再生成 |

#### 7.1.4 新規スレッド発見

| メソッド | エンドポイント | 説明 |
|---------|--------------|------|
| POST | /api/discover/threads | 新規スレッド検出 |
| POST | /api/discover/register | 検出スレッド一括登録 |

#### 7.1.5 検索・質問

| メソッド | エンドポイント | 説明 |
|---------|--------------|------|
| POST | /api/search/query | 自然言語質問 |
| GET | /api/search/history | 検索履歴取得 |
| POST | /api/search/history/{query_id}/bookmark | 質問ブックマーク |

#### 7.1.6 設定

| メソッド | エンドポイント | 説明 |
|---------|--------------|------|
| GET | /api/config | 設定取得 |
| PUT | /api/config | 設定更新 |
| GET | /api/config/channels | 監視チャンネル一覧 |
| POST | /api/config/channels | 監視チャンネル追加 |

### 7.2 主要APIの詳細

#### 7.2.1 GET /api/threads

**概要**: スレッド一覧を取得

**クエリパラメータ**:
```
- tags: string[] (optional) - フィルタするタグ
- is_read: boolean (optional) - 既読/未読フィルタ
- sort_by: string (optional) - ソート項目 (updated_at, created_at, title)
- sort_order: string (optional) - ソート順序 (asc, desc)
- search: string (optional) - 検索キーワード
- limit: number (optional) - 取得件数
- offset: number (optional) - オフセット
```

**レスポンス**:
```json
{
  "threads": [
    {
      "id": "thread_001",
      "title": "認証機能の実装について",
      "url": "https://...",
      "tags": ["認証", "セキュリティ"],
      "created_at": "2025-01-15T10:30:00Z",
      "updated_at": "2025-01-20T15:45:00Z",
      "message_count": 45,
      "new_message_count": 3,
      "is_read": false,
      "summary": {
        "topic": "OAuth 2.0とJWT認証の実装方針について議論"
      }
    }
  ],
  "total": 100,
  "limit": 20,
  "offset": 0
}
```

#### 7.2.2 POST /api/threads

**概要**: 新規スレッド登録

**リクエストボディ**:
```json
{
  "channel_id": "C1234567890",
  "thread_ts": "1234567890.123456",
  "title": "認証機能の実装について",
  "tags": ["認証", "セキュリティ"]
}
```

**レスポンス**:
```json
{
  "id": "thread_001",
  "message": "スレッドを登録しました"
}
```

#### 7.2.3 POST /api/threads/{thread_id}/sync

**概要**: 個別スレッドのメッセージを同期

**レスポンス**:
```json
{
  "thread_id": "thread_001",
  "new_messages": 3,
  "total_messages": 45,
  "synced_at": "2025-01-20T16:00:00Z"
}
```

#### 7.2.4 POST /api/search/query

**概要**: 自然言語で質問

**リクエストボディ**:
```json
{
  "query": "認証機能の実装についての結論は?"
}
```

**レスポンス**:
```json
{
  "query_id": "query_001",
  "query": "認証機能の実装についての結論は?",
  "answer": "OAuth 2.0を採用し、トークン形式にJWTを使用することで決定しました。",
  "related_threads": [
    {
      "thread_id": "thread_001",
      "title": "認証機能の実装について",
      "relevance_score": 0.95
    }
  ],
  "confidence": 0.9,
  "created_at": "2025-01-20T16:00:00Z"
}
```

---

## 8. UI/UX設計

### 8.1 画面構成

#### 8.1.1 画面一覧
1. **スレッド一覧画面** (/)
2. **スレッド詳細画面** (/threads/:id)
3. **新規スレッド発見画面** (/discover)
4. **検索・質問画面** (/search)
5. **設定画面** (/settings)

#### 8.1.2 レイアウト
```
┌─────────────────────────────────────────┐
│  Header (ナビゲーション、同期ボタン)      │
├─────────────────────────────────────────┤
│                                         │
│                                         │
│          Main Content Area              │
│                                         │
│                                         │
├─────────────────────────────────────────┤
│  Footer (ステータス表示)                 │
└─────────────────────────────────────────┘
```

### 8.2 スレッド一覧画面

#### 8.2.1 コンポーネント構成
- **ヘッダーバー**:
  - アプリタイトル
  - 全体同期ボタン
  - 新規スレッド発見ボタン
  - 設定ボタン

- **フィルター・検索バー**:
  - 検索ボックス (タイトル、要約を検索)
  - タグフィルター (マルチセレクト)
  - 既読/未読フィルター (トグル)
  - 日付範囲フィルター

- **スレッド一覧テーブル**:
  - カラム:
    - タイトル (リンク) + 新規バッジ
    - トピック要約
    - 開始日時
    - 最終更新日時
    - タグ (チップ表示)
    - アクション (詳細、編集、削除)
  - ソート機能 (各カラムヘッダークリック)
  - ページネーション

- **新規スレッド登録ボタン** (フローティング)

### 8.3 スレッド詳細画面

#### 8.3.1 コンポーネント構成
- **スレッドヘッダー**:
  - タイトル
  - タグ編集
  - Slackで開くボタン
  - 同期ボタン
  - 既読マークボタン

- **タブ**:
  - メッセージタブ
  - 日次要約タブ
  - トピック別要約タブ

- **メッセージタブ**:
  - メッセージ一覧 (時系列)
  - 各メッセージ:
    - ユーザー名、アイコン
    - タイムスタンプ
    - メッセージ本文
    - リアクション表示

- **日次要約タブ**:
  - 日付ごとにアコーディオン表示
  - 各日の要約を展開可能
  - 要約クリックで該当メッセージへジャンプ

- **トピック別要約タブ**:
  - トピックごとにカード表示
  - トピック名、ステータス、結論
  - 関連メッセージへのリンク

### 8.4 検索・質問画面

#### 8.4.1 コンポーネント構成
- **質問入力エリア**:
  - テキストエリア (複数行入力可)
  - 送信ボタン

- **検索履歴サイドバー**:
  - 過去の質問一覧
  - ブックマーク済み質問
  - クリックで再表示

- **回答表示エリア**:
  - 質問の再表示
  - 回答テキスト (マークダウン対応)
  - 関連スレッドリスト (リンク付き)
  - 確信度表示
  - ブックマークボタン

### 8.5 新規メッセージの通知方法

#### 8.5.1 視覚的インジケーター
- **一覧画面**:
  - タイトル横に「NEW」バッジ (赤色)
  - 新規メッセージ件数を数値で表示 (+3)
  - 未読行を太字で表示

- **ヘッダー**:
  - 未読スレッド総数をバッジ表示

#### 8.5.2 色分け
- 未読スレッド: 背景色を薄い黄色
- 既読スレッド: 白色背景
- 24時間以内の更新: タイムスタンプを青色

---

## 9. Claude Agent SDK連携設計

### 9.1 概要

Claude Agent SDKをPythonから利用し、ローカルのスレッドデータファイルを対象に質問応答を実行します。

### 9.2 実装方針

#### 9.2.1 Claude Agent SDKの役割
- ユーザーの自然言語質問を理解
- `data/` 配下のJSONファイルを検索・読み込み
- 複数スレッドにまたがる情報を統合
- 回答を生成

#### 9.2.2 統合アーキテクチャ

```
FastAPI Backend
    ↓
Claude Agent SDK (Python)
    ↓
ツール定義:
- read_thread_info(thread_id) → threads/配下を読む
- read_messages(thread_id) → messages/配下を読む
- read_summary(thread_id, type) → summaries/配下を読む
- search_threads(query) → 全スレッドを検索
    ↓
Local File System (data/)
```

### 9.3 実装例

#### 9.3.1 ツール定義 (backend/tools/thread_tools.py)

```python
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

    for thread_file in threads_dir.glob("*.json"):
        with open(thread_file, "r", encoding="utf-8") as f:
            thread = json.load(f)
            # タイトル、要約、タグで検索
            if (keyword.lower() in thread.get("title", "").lower() or
                keyword.lower() in thread.get("summary", {}).get("topic", "").lower() or
                keyword.lower() in " ".join(thread.get("tags", [])).lower()):
                results.append(thread)

    return results

def list_all_threads() -> List[Dict[str, Any]]:
    """全スレッド一覧を取得"""
    threads_dir = DATA_DIR / "threads"
    threads = []

    for thread_file in threads_dir.glob("*.json"):
        with open(thread_file, "r", encoding="utf-8") as f:
            threads.append(json.load(f))

    return threads
```

#### 9.3.2 Claude Agent SDKクライアント (backend/services/claude_agent.py)

```python
from anthropic import Anthropic
from .tools.thread_tools import (
    read_thread_info,
    read_messages,
    read_summary,
    search_threads,
    list_all_threads
)

class ClaudeAgentClient:
    def __init__(self, api_key: str = None):
        # Claude Agent SDKの初期化
        # ローカル実行の場合はAPI keyは不要かもしれません
        self.client = Anthropic(api_key=api_key)

        # 利用可能なツールを定義
        self.tools = [
            {
                "name": "read_thread_info",
                "description": "指定されたスレッドの基本情報を取得します",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "thread_id": {"type": "string", "description": "スレッドID"}
                    },
                    "required": ["thread_id"]
                }
            },
            {
                "name": "read_messages",
                "description": "指定されたスレッドの全メッセージを取得します",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "thread_id": {"type": "string", "description": "スレッドID"}
                    },
                    "required": ["thread_id"]
                }
            },
            {
                "name": "read_summary",
                "description": "指定されたスレッドの要約を取得します",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "thread_id": {"type": "string", "description": "スレッドID"},
                        "summary_type": {
                            "type": "string",
                            "enum": ["daily", "topic"],
                            "description": "要約タイプ (daily or topic)"
                        }
                    },
                    "required": ["thread_id", "summary_type"]
                }
            },
            {
                "name": "search_threads",
                "description": "キーワードでスレッドを検索します",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "keyword": {"type": "string", "description": "検索キーワード"}
                    },
                    "required": ["keyword"]
                }
            },
            {
                "name": "list_all_threads",
                "description": "全てのスレッドの一覧を取得します",
                "input_schema": {
                    "type": "object",
                    "properties": {}
                }
            }
        ]

        # ツール実行マッピング
        self.tool_functions = {
            "read_thread_info": read_thread_info,
            "read_messages": read_messages,
            "read_summary": read_summary,
            "search_threads": search_threads,
            "list_all_threads": list_all_threads
        }

    def query(self, user_question: str) -> dict:
        """
        ユーザーの質問に対してClaude Agentで回答
        """
        messages = [
            {
                "role": "user",
                "content": user_question
            }
        ]

        # システムプロンプト
        system_prompt = """
あなたはSlackスレッド管理アプリケーションのアシスタントです。
ユーザーの質問に対して、ローカルに保存されているスレッドデータを検索・分析し、回答してください。

利用可能なツール:
- read_thread_info: スレッドの基本情報を取得
- read_messages: スレッドの全メッセージを取得
- read_summary: スレッドの要約 (日次 or トピック別) を取得
- search_threads: キーワードでスレッドを検索
- list_all_threads: 全スレッド一覧を取得

回答には以下を含めてください:
1. 質問への直接的な回答
2. 該当するスレッドID、タイトル
3. 関連する情報の引用
4. 回答の確信度 (0-1の範囲)
"""

        # Claude APIを呼び出し (ツール使用)
        response = self.client.messages.create(
            model="claude-sonnet-4.5",
            max_tokens=4096,
            system=system_prompt,
            messages=messages,
            tools=self.tools
        )

        # ツール呼び出しを処理
        while response.stop_reason == "tool_use":
            tool_use_block = next(
                block for block in response.content if block.type == "tool_use"
            )

            tool_name = tool_use_block.name
            tool_input = tool_use_block.input

            # ツールを実行
            tool_result = self.tool_functions[tool_name](**tool_input)

            # ツール結果をメッセージに追加
            messages.append({
                "role": "assistant",
                "content": response.content
            })
            messages.append({
                "role": "user",
                "content": [
                    {
                        "type": "tool_result",
                        "tool_use_id": tool_use_block.id,
                        "content": str(tool_result)
                    }
                ]
            })

            # 再度APIを呼び出し
            response = self.client.messages.create(
                model="claude-sonnet-4.5",
                max_tokens=4096,
                system=system_prompt,
                messages=messages,
                tools=self.tools
            )

        # 最終回答を抽出
        answer_text = next(
            block.text for block in response.content if hasattr(block, "text")
        )

        return {
            "answer": answer_text,
            "confidence": 0.85,  # 実際には回答内容から推定
            "related_threads": []  # 回答から抽出
        }
```

#### 9.3.3 FastAPI エンドポイント (backend/api/search.py)

```python
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from ..services.claude_agent import ClaudeAgentClient
import uuid
from datetime import datetime

router = APIRouter()
claude_agent = ClaudeAgentClient()

class QueryRequest(BaseModel):
    query: str

class QueryResponse(BaseModel):
    query_id: str
    query: str
    answer: str
    related_threads: list
    confidence: float
    created_at: str

@router.post("/search/query", response_model=QueryResponse)
async def search_query(request: QueryRequest):
    """自然言語で質問"""
    try:
        # Claude Agentで処理
        result = claude_agent.query(request.query)

        query_id = f"query_{uuid.uuid4().hex[:8]}"

        # 検索履歴に保存 (省略)

        return QueryResponse(
            query_id=query_id,
            query=request.query,
            answer=result["answer"],
            related_threads=result["related_threads"],
            confidence=result["confidence"],
            created_at=datetime.utcnow().isoformat() + "Z"
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
```

### 9.4 代替案: MCP (Model Context Protocol)

もしClaude Agent SDKが直接利用できない場合、MCPサーバーとして実装する方法もあります:

1. FastAPIをMCPサーバーとして公開
2. Claude Codeから接続して質問
3. FastAPI側でデータ検索・整形して返却

この方法では、Claude Codeの対話形式でより柔軟な質問応答が可能になります。

---

## 10. 実装フェーズ提案

### Phase 1: 基盤構築 (2-3週間)
**目標**: 基本的なスレッド管理とデータ取得機能

- バックエンド基盤
  - FastAPIプロジェクト構築
  - データモデル実装
  - ファイルベースのデータ永続化層

- Slack API統合
  - xoxc token + cookie認証実装
  - メッセージ取得API実装
  - スレッド情報取得

- フロントエンド基盤
  - React + TypeScriptプロジェクト構築
  - ルーティング設定
  - 基本レイアウト

- 基本機能
  - スレッド登録 (手動)
  - スレッド一覧表示
  - メッセージ取得・保存

**成果物**:
- スレッドを登録し、Slackからメッセージを取得できる
- 一覧画面でスレッドを確認できる

---

### Phase 2: UI/UX強化 (1-2週間) ✅ 完了
**目標**: 使いやすいインターフェース

- スレッド一覧画面
  - フィルタリング機能（今後実装予定）
  - ソート機能（今後実装予定）
  - 検索ボックス（今後実装予定）
  - ページネーション（今後実装予定）
  - ✅ 基本的な一覧表示
  - ✅ 新着メッセージバッジ表示
  - ✅ 全スレッド同期ボタン

- スレッド詳細画面
  - ✅ メッセージ表示
  - ✅ 基本情報表示
  - ✅ Slackへのリンク
  - ✅ リアクション表示

**成果物**:
- ✅ 直感的に操作できる基本UI
- 注: 定期同期機能はPhase 6に移動

---

### Phase 3: 要約機能 (2-3週間)
**目標**: スレッド情報の整理と可視化

- ChatGPT API統合
  - API認証
  - プロンプト設計
  - レート制限対応

- 要約生成
  - 日次要約の実装
  - トピック別要約の実装
  - バックグラウンド処理

- 要約表示UI
  - タブ切り替え
  - アコーディオン表示
  - 要約からメッセージへのジャンプ

**成果物**:
- 長いスレッドの内容を要約で把握できる
- トピックごとの議論状況が分かる

---

### Phase 4: 新規スレッド発見 (1週間)
**目標**: 重要なスレッドの見落とし防止

- チャンネル監視機能
  - 監視対象チャンネル設定
  - メンション検出
  - 未登録スレッド発見

- 発見UI
  - 発見スレッド一覧
  - プレビュー表示
  - 一括登録機能

**成果物**:
- 重要なメンションを含むスレッドを自動発見
- ワンクリックで登録可能

---

### Phase 5: 質問応答機能 (2-3週間)
**目標**: スレッドを跨いだ情報検索

- Claude Agent SDK統合
  - SDK初期化
  - ツール定義
  - 質問応答ロジック

- 検索UI
  - 質問入力フォーム
  - 回答表示
  - 関連スレッドリンク
  - 検索履歴

- 検索履歴管理
  - 履歴保存
  - ブックマーク機能

**成果物**:
- 自然言語で過去の議論を検索できる
- 複数スレッドにまたがる情報を統合して回答

---

### Phase 6: 定期実行機能 (1週間)
**目標**: 自動的なメッセージ同期

- 定期同期機能
  - APSchedulerによる定期実行
  - 新規メッセージ検出
  - 未読カウント表示
  - バックグラウンド実行

- 設定UI
  - 同期間隔の設定
  - 自動同期のON/OFF切り替え
  - 最終同期日時の表示

**成果物**:
- 自動的にメッセージが同期される
- 手動操作なしで最新状態を維持

---

### Phase 7: 最適化・改善 (1-2週間)
**目標**: パフォーマンスとUX向上

- パフォーマンス最適化
  - データ読み込み高速化
  - キャッシング実装
  - 大量データ対応

- エラーハンドリング
  - Slack API エラー対応
  - LLM API エラー対応
  - ユーザーフィードバック改善

- 運用機能
  - データバックアップ
  - ログ機能
  - 設定エクスポート/インポート

**成果物**:
- 安定動作する本番品質
- 長期利用に耐えるシステム

---

## 11. 想定される技術的課題と対策

### 11.1 Slack API制限
**課題**: Rate limitによる取得失敗

**対策**:
- エクスポネンシャルバックオフ実装
- リクエスト間隔の調整
- 優先度に応じた取得順序制御

### 11.2 大量データの管理
**課題**: スレッド数・メッセージ数増加時のパフォーマンス

**対策**:
- ページネーション徹底
- インデックスファイルの作成 (threads_index.json)
- 古いデータのアーカイブ機能

### 11.3 LLM API コスト
**課題**: ChatGPT API利用料金

**対策**:
- 要約生成の最適化 (差分更新)
- キャッシュ活用
- トークン数制限
- 必要に応じてローカルLLM検討

### 11.4 認証情報の管理
**課題**: xoxc token + cookieの安全な保管

**対策**:
- 環境変数での管理
- ファイル暗号化 (cryptographyライブラリ)
- .gitignoreでの除外徹底

---

## 12. 今後の拡張可能性

### 12.1 機能拡張
- Slackへの返信機能 (双方向連携)
- チーム間でのスレッド共有機能
- スレッドのエクスポート (PDF, Markdown)
- ダッシュボード (統計情報、活動推移)
- モバイル対応

### 12.2 技術的拡張
- データベース移行 (SQLite, PostgreSQL)
- 複数ワークスペース対応
- デスクトップアプリ化 (Electron)
- 他のチャットツール対応 (Discord, Teams)

---

## 付録A: ディレクトリ構造

```
slack-thread-manager/
├── backend/
│   ├── main.py                      # FastAPI アプリケーション
│   ├── requirements.txt
│   ├── api/
│   │   ├── __init__.py
│   │   ├── threads.py               # スレッド管理API
│   │   ├── messages.py              # メッセージAPI
│   │   ├── summaries.py             # 要約API
│   │   ├── search.py                # 検索・質問API
│   │   ├── discover.py              # 新規スレッド発見API
│   │   └── config.py                # 設定API
│   ├── services/
│   │   ├── __init__.py
│   │   ├── slack_client.py          # Slack API クライアント
│   │   ├── chatgpt_client.py        # ChatGPT API クライアント
│   │   ├── claude_agent.py          # Claude Agent SDK クライアント
│   │   ├── thread_manager.py        # スレッド管理ロジック
│   │   ├── summary_generator.py     # 要約生成ロジック
│   │   └── scheduler.py             # 定期実行スケジューラー
│   ├── models/
│   │   ├── __init__.py
│   │   ├── thread.py                # スレッドモデル
│   │   ├── message.py               # メッセージモデル
│   │   ├── summary.py               # 要約モデル
│   │   └── config.py                # 設定モデル
│   ├── repositories/
│   │   ├── __init__.py
│   │   ├── thread_repository.py     # スレッドデータアクセス
│   │   ├── message_repository.py    # メッセージデータアクセス
│   │   └── config_repository.py     # 設定データアクセス
│   ├── tools/
│   │   ├── __init__.py
│   │   └── thread_tools.py          # Claude Agent用ツール
│   └── utils/
│       ├── __init__.py
│       ├── file_handler.py          # ファイル操作ユーティリティ
│       └── logger.py                # ロガー設定
├── frontend/
│   ├── package.json
│   ├── vite.config.ts
│   ├── tsconfig.json
│   ├── index.html
│   ├── src/
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   ├── pages/
│   │   │   ├── ThreadList.tsx       # スレッド一覧画面
│   │   │   ├── ThreadDetail.tsx     # スレッド詳細画面
│   │   │   ├── Discover.tsx         # 新規スレッド発見画面
│   │   │   ├── Search.tsx           # 検索・質問画面
│   │   │   └── Settings.tsx         # 設定画面
│   │   ├── components/
│   │   │   ├── ThreadTable.tsx      # スレッドテーブル
│   │   │   ├── MessageList.tsx      # メッセージ一覧
│   │   │   ├── DailySummary.tsx     # 日次要約
│   │   │   ├── TopicSummary.tsx     # トピック別要約
│   │   │   ├── SearchBar.tsx        # 検索バー
│   │   │   └── FilterPanel.tsx      # フィルターパネル
│   │   ├── services/
│   │   │   └── api.ts               # API クライアント
│   │   ├── hooks/
│   │   │   ├── useThreads.ts        # スレッド関連フック
│   │   │   ├── useMessages.ts       # メッセージ関連フック
│   │   │   └── useSearch.ts         # 検索関連フック
│   │   ├── types/
│   │   │   └── index.ts             # 型定義
│   │   └── styles/
│   │       └── global.css
│   └── public/
├── data/                            # データディレクトリ (git除外)
│   ├── threads/
│   ├── messages/
│   ├── summaries/
│   ├── config.json
│   └── search_history.json
├── .gitignore
├── README.md
└── SPECIFICATION.md                 # 本ドキュメント
```

---

## 付録B: 環境変数設定例

```env
# .env ファイル

# Slack
SLACK_WORKSPACE=myworkspace
SLACK_XOXC_TOKEN=xoxc-xxxxx
SLACK_COOKIE=d-xxxxx

# ChatGPT
OPENAI_API_KEY=sk-xxxxx
OPENAI_MODEL=gpt-4o
OPENAI_MAX_TOKENS=2000

# Claude Agent (必要に応じて)
ANTHROPIC_API_KEY=sk-ant-xxxxx

# Application
DATA_DIR=./data
SYNC_INTERVAL_MINUTES=30
LOG_LEVEL=INFO

# Server
BACKEND_HOST=127.0.0.1
BACKEND_PORT=8000
FRONTEND_PORT=3000
```

---

## 付録C: 参考リンク

- [Slack API Documentation](https://api.slack.com/)
- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [React Documentation](https://react.dev/)
- [OpenAI API Documentation](https://platform.openai.com/docs/)
- [Anthropic Claude Documentation](https://docs.anthropic.com/)
- [Claude Agent SDK](https://github.com/anthropics/anthropic-sdk-python)

---

**作成日**: 2025-01-20
**バージョン**: 1.0
**作成者**: Claude (Anthropic)
