# データディレクトリ構造

`backend/data/` 配下に保存されるSlack関連データの構造と各ファイルの内容を説明する。

## ディレクトリツリー

```
backend/data/
├── config.json                          # アプリケーション設定
├── tags.json                            # タグ定義
├── views.json                           # ビュー（保存済みフィルタ条件）
├── threads/                             # スレッドメタデータ
│   └── thread_{id}.json
├── messages/                            # スレッドのメッセージ一覧
│   └── thread_{id}_messages.json
├── summaries/                           # スレッド要約
│   └── {thread_id}_summary.json
├── channel_export/                      # チャンネルエクスポートの設定・状態管理
│   ├── config.json
│   ├── state.json
│   └── job.json
└── channel_exports/                     # エクスポートされたチャンネルデータ
    └── {channel_name}_{channel_id}/
        ├── metadata.json
        ├── index.json
        ├── messages/
        │   └── {YYYY-MM}/
        │       ├── {YYYY-MM-DD}.json
        │       └── {YYYY-MM-DD}.md
        └── threads/
            ├── {thread_ts}.json
            └── {thread_ts}.md
```

---

## ルートレベルの設定ファイル

### config.json

アプリケーション全体の設定。

```json
{
  "slack": {
    "workspace": "my-workspace",
    "xoxc_token": "xoxc-...",
    "cookie": "xoxd-...",
    "monitored_channels": [],
    "default_mention_users": []
  },
  "sync": {
    "auto_sync_enabled": true,
    "sync_interval_minutes": 30,
    "last_sync_at": "2026-03-15T17:05:38.893304"
  },
  "llm": {
    "chatgpt_api_key": null,
    "chatgpt_model": "gpt-4o",
    "chatgpt_max_tokens": 2000,
    "claude_api_key": null,
    "claude_agent_enabled": false
  },
  "app": {
    "theme": "light",
    "items_per_page": 20
  }
}
```

### tags.json

スレッドに付与可能なタグの一覧。

```json
{
  "tags": ["実運用", "テスト", "バグ", "機能追加", "質問", "議論", "決定事項", "TODO"],
  "updated_at": "2026-03-15T00:00:00"
}
```

### views.json

保存済みのフィルタ・ソート条件（ビュー）の配列。

---

## スレッド管理 (threads/ & messages/)

### threads/thread_{id}.json

個々のスレッドのメタデータ。WebUI上で登録されたスレッドごとに1ファイル。

```json
{
  "id": "thread_f69b0852",
  "channel_id": "C01G1P9CCDB",
  "thread_ts": "1762073947.063909",
  "title": "新規スレッドテスト",
  "url": "https://my-workspace.slack.com/archives/C01G1P9CCDB/p1762073947063909",
  "tags": ["TODO"],
  "created_at": "2026-03-15T15:31:09.216798",
  "updated_at": "2026-03-15T17:05:38.893304",
  "last_message_ts": "1773155251.229839",
  "message_count": 7,
  "new_message_count": 0,
  "is_read": false,
  "is_archived": false,
  "has_daily_summary": false,
  "has_topic_summary": false,
  "summary": {
    "topic": "",
    "generated_at": null
  }
}
```

### messages/thread_{id}_messages.json

スレッドに紐づくメッセージの全量。Slack APIから同期した内容を保持。

```json
{
  "thread_id": "thread_f69b0852",
  "channel_id": "C01G1P9CCDB",
  "thread_ts": "1762073947.063909",
  "messages": [
    {
      "ts": "1762073947.063909",
      "user": "UAGJ7N9EK",
      "user_name": "tsukiji",
      "text": "メッセージ本文",
      "reactions": [{ "name": "thumbsup", "count": 2 }],
      "files": [],
      "created_at": "2025-11-02T17:59:07.063909"
    }
  ],
  "last_fetched_at": "2026-03-15T17:05:38.891379"
}
```

---

## チャンネルエクスポート管理 (channel_export/)

エクスポート機能の設定・進捗状態を管理するファイル群。実際のエクスポートデータは `channel_exports/` に出力される。

### channel_export/config.json

ダウンロード対象チャンネルとスケジュール設定。

```json
{
  "channels": [
    {
      "channel_id": "C01G1P9CCDB",
      "channel_name": "やりたいこと投げ入れbox",
      "enabled": true
    }
  ],
  "schedule_enabled": true,
  "schedule_interval_hours": 1
}
```

### channel_export/state.json

チャンネルごとのダウンロード進捗。中断再開のための情報を含む。

```json
[
  {
    "channel_id": "C01G1P9CCDB",
    "channel_name": "やりたいこと投げ入れbox",
    "last_downloaded_at": "2026-03-15T17:05:15.138025",
    "last_message_ts": "1773154889.233119",
    "total_messages_downloaded": 8,
    "total_threads_downloaded": 6,
    "status": "completed",
    "error_message": null,
    "initial_fetch_oldest": "2025-03-15T17:05:09.594629",
    "initial_fetch_done": true
  }
]
```

| フィールド | 説明 |
|---|---|
| `status` | `pending` / `downloading` / `completed` / `error` |
| `initial_fetch_oldest` | 初回DLでどこまで遡ったか（中断再開用） |
| `initial_fetch_done` | 初回DL（過去1年分）が完了したか |
| `last_message_ts` | 差分更新の基準となる最新メッセージのタイムスタンプ |

### channel_export/job.json

直近のダウンロードジョブの実行状態。

```json
{
  "job_id": "7c9838b8",
  "started_at": "2026-03-15T17:05:38.130061",
  "completed_at": "2026-03-15T17:05:38.408671",
  "status": "completed",
  "channels": [],
  "current_channel": null,
  "progress_percent": 100.0
}
```

---

## エクスポートデータ (channel_exports/)

チャンネルごとにディレクトリが作成され、JSON（構造化データ）とMarkdown（LLM解析用）の2形式で出力される。

### ディレクトリ命名規則

```
{channel_name}_{channel_id}/
```

例: `やりたいこと投げ入れbox_C01G1P9CCDB/`

### metadata.json

チャンネル全体のエクスポートメタデータ。

```json
{
  "channel_id": "C01G1P9CCDB",
  "channel_name": "やりたいこと投げ入れbox",
  "downloaded_at": "2026-03-15T17:05:18.769650",
  "total_messages": 4,
  "total_threads": 3,
  "date_range": {
    "oldest": "2025-12-22T09:31:50.779799",
    "newest": "2026-03-11T00:01:29.233119"
  }
}
```

### index.json

スレッドの索引。どのスレッドがあるかを素早く把握するためのファイル。

```json
[
  {
    "thread_ts": "1773154792.189999",
    "first_message": "こんにちは",
    "reply_count": 2,
    "participants": ["tsukiji"],
    "created_at": "2026-03-10T23:59:52.189999"
  }
]
```

### messages/{YYYY-MM}/{YYYY-MM-DD}.json

日別のチャンネルメッセージ（JSON形式）。

```json
{
  "channel_id": "C01G1P9CCDB",
  "channel_name": "やりたいこと投げ入れbox",
  "date": "2026-03-10",
  "messages": [
    {
      "ts": "1773154792.189999",
      "user": "UAGJ7N9EK",
      "user_name": "tsukiji",
      "text": "こんにちは",
      "thread_ts": "1773154792.189999",
      "reply_count": 2,
      "reactions": [],
      "files": [],
      "created_at": "2026-03-10T23:59:52.189999"
    }
  ]
}
```

### messages/{YYYY-MM}/{YYYY-MM-DD}.md

日別のチャンネルメッセージ（Markdown形式）。スレッド返信はインラインで表示される。

```markdown
# #やりたいこと投げ入れbox - 2026-03-10

### 23:59 - tsukiji (thread: 2 replies)

こんにちは

  > **00:00 - tsukiji**: hello!!!!!!!!!!
  > **15:14 - tsukiji**: piyo

---
```

### threads/{thread_ts}.json

個別スレッドの会話データ（JSON形式）。親メッセージと返信を分離して保持。

```json
{
  "channel_id": "C01G1P9CCDB",
  "thread_ts": "1773154792.189999",
  "parent_message": {
    "ts": "1773154792.189999",
    "user": "UAGJ7N9EK",
    "user_name": "tsukiji",
    "text": "こんにちは",
    "reactions": [],
    "files": [],
    "created_at": "2026-03-10T23:59:52.189999"
  },
  "replies": [
    {
      "ts": "1773154804.687979",
      "user": "UAGJ7N9EK",
      "user_name": "tsukiji",
      "text": "hello!!!!!!!!!!",
      "reactions": [],
      "files": [],
      "created_at": "2026-03-11T00:00:04.687979"
    }
  ],
  "reply_count": 2,
  "participants": ["tsukiji"]
}
```

### threads/{thread_ts}.md

個別スレッドの会話データ（Markdown形式）。

```markdown
# Thread 1773154792.189999

## 2026-03-10 23:59 - tsukiji (parent)

こんにちは

---

### 2026-03-11 00:00 - tsukiji

hello!!!!!!!!!!

---
```

---

## リポジトリクラスとファイルの対応

| リポジトリ | 対象ファイル | 役割 |
|---|---|---|
| `ThreadRepository` | `threads/thread_{id}.json` | スレッドメタデータのCRUD |
| `MessageRepository` | `messages/thread_{id}_messages.json` | メッセージ一覧の取得・保存 |
| `ConfigRepository` | `config.json` | アプリケーション設定の管理 |
| `TagRepository` | `tags.json` | タグの追加・更新・削除 |
| `ViewRepository` | `views.json` | ビューのCRUD |
| `SummaryRepository` | `summaries/{thread_id}_summary.json` | スレッド要約の管理 |
| `ChannelExportRepository` | `channel_export/{config,state,job}.json` | エクスポート設定・進捗の管理 |

エクスポートデータ (`channel_exports/`) の書き込みは `ChannelExporter` サービスが担当する。
