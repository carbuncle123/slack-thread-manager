# Slack Thread Manager - Backend

FastAPIで実装されたSlackスレッド管理アプリケーションのバックエンドです。

## セットアップ

### 1. 依存関係のインストール

このプロジェクトは[uv](https://docs.astral.sh/uv/)で依存関係を管理しています。

```bash
cd backend
uv sync
```

### 2. 環境変数の設定

`.env`ファイルを作成して、Slack認証情報を設定します:

```bash
cp .env.example .env
```

`.env`ファイルを編集:

```env
SLACK_WORKSPACE=your-workspace
SLACK_XOXC_TOKEN=xoxc-your-token
SLACK_COOKIE=d-your-cookie
DATA_DIR=../data
```

#### Slack認証情報の取得方法

1. ブラウザでSlackにログイン
2. 開発者ツール (F12) を開く
3. Networkタブを開いて任意のAPIリクエストを確認
4. リクエストヘッダーから以下を取得:
   - `Authorization: Bearer xoxc-...` → `SLACK_XOXC_TOKEN`
   - `Cookie: d=...` → `SLACK_COOKIE`

### 3. アプリケーションの起動

```bash
uv run python main.py
```

または:

```bash
uv run uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

起動後、以下のURLにアクセス:
- API: http://localhost:8000
- ドキュメント: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## API エンドポイント

### スレッド管理

- `GET /api/threads` - スレッド一覧取得
- `GET /api/threads/{thread_id}` - 個別スレッド取得
- `POST /api/threads` - スレッド登録
- `PUT /api/threads/{thread_id}` - スレッド更新
- `DELETE /api/threads/{thread_id}` - スレッド削除
- `POST /api/threads/{thread_id}/mark-read` - 既読マーク

### メッセージ

- `GET /api/threads/{thread_id}/messages` - メッセージ一覧取得
- `POST /api/threads/{thread_id}/sync` - メッセージ同期

### 同期

- `POST /api/sync/all` - 全スレッド同期

### 設定

- `GET /api/config` - 設定取得
- `PUT /api/config` - 設定更新
- `GET /api/config/channels` - 監視チャンネル一覧
- `POST /api/config/channels` - 監視チャンネル追加

### ヘルスチェック

- `GET /api/health` - ヘルスチェック

## プロジェクト構造

```
backend/
├── main.py                  # FastAPIアプリケーション
├── pyproject.toml           # プロジェクト設定・依存パッケージ (uv)
├── .env.example            # 環境変数テンプレート
├── api/                    # APIエンドポイント
│   ├── threads.py
│   ├── sync.py
│   └── config.py
├── models/                 # データモデル
│   ├── thread.py
│   ├── message.py
│   └── config.py
├── repositories/           # データアクセス層
│   ├── thread_repository.py
│   ├── message_repository.py
│   └── config_repository.py
├── services/               # ビジネスロジック
│   ├── slack_client.py
│   └── thread_manager.py
└── utils/                  # ユーティリティ
    ├── file_handler.py
    └── logger.py
```

## 使用例

### スレッドの登録

```bash
curl -X POST http://localhost:8000/api/threads \
  -H "Content-Type: application/json" \
  -d '{
    "channel_id": "C1234567890",
    "thread_ts": "1234567890.123456",
    "title": "認証機能の実装について",
    "tags": ["認証", "セキュリティ"]
  }'
```

### スレッド一覧の取得

```bash
curl http://localhost:8000/api/threads
```

### メッセージの同期

```bash
curl -X POST http://localhost:8000/api/threads/{thread_id}/sync
```

### 全スレッドの同期

```bash
curl -X POST http://localhost:8000/api/sync/all
```

## 開発

### ログレベルの変更

`.env`ファイルで設定:

```env
LOG_LEVEL=DEBUG  # DEBUG, INFO, WARNING, ERROR
```

### データディレクトリ

デフォルトでは`../data`ディレクトリにデータが保存されます。

```
data/
├── threads/           # スレッド情報
├── messages/          # メッセージデータ
├── summaries/         # 要約データ (Phase 3で実装)
└── config.json        # アプリケーション設定
```

## トラブルシューティング

### Slack APIエラー

- **認証エラー**: `SLACK_XOXC_TOKEN`と`SLACK_COOKIE`が正しいか確認
- **トークン期限切れ**: ブラウザから再度取得
- **Rate limit**: リクエスト頻度を下げる

### データ読み込みエラー

- データディレクトリのパーミッションを確認
- JSONファイルの形式が正しいか確認

## 次のステップ (Phase 2以降)

- [ ] 定期同期機能の実装 (APScheduler)
- [ ] 要約生成機能の実装 (ChatGPT API)
- [ ] 新規スレッド発見機能
- [ ] 検索・質問機能 (Claude Agent SDK)

## 依存関係の管理

このプロジェクトはuvで依存関係を管理しています。

### 新しいパッケージの追加

```bash
uv add package-name
```

### 開発用パッケージの追加

```bash
uv add --dev package-name
```

### 依存関係の更新

```bash
uv sync
```

## ライセンス

This project is for personal use.
