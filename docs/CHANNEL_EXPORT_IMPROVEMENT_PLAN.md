# Channel Export 改善計画（project/account 日次・週次整理向け）

## 目的

`channel_exports/` のデータを使って、`project`・`account` ごとに日次/週次の出来事を安定して集計し、ドキュメント化できるようにする。

現状課題への対応方針は次の3点。

1. 分類軸（project/account）をエクスポート時に保持する
2. 日別ファイルを上書きではなくマージ保存にする
3. 横断分析用の rollup ファイル（日次・週次）を生成する

---

## 1. スキーマ案

### 1-1. 新規マスタ: `backend/data/channel_export/classification.json`

```json
{
  "version": 1,
  "projects": [
    {
      "id": "proj_alpha",
      "name": "Alpha",
      "match": {
        "channels": ["C01G1P9CCDB"],
        "keywords": ["[ALPHA]", "alpha project"],
        "users": ["U123", "U456"]
      }
    }
  ],
  "accounts": [
    {
      "id": "acct_foo",
      "name": "Foo Corp",
      "match": {
        "keywords": ["foo", "foocorp"],
        "channels": [],
        "users": []
      }
    }
  ],
  "defaults": {
    "project_ids": ["unclassified_project"],
    "account_ids": ["unclassified_account"]
  }
}
```

意図:
- ルールベースで project/account を付与（将来 LLM 判定を足せるよう `match` を構造化）。
- 未分類を必ず埋める（集計欠損防止）。

### 1-2. メッセージ保存スキーマの拡張

対象: `channel_exports/{channel}/messages/{YYYY-MM}/{YYYY-MM-DD}.json` の `messages[]` 各要素

追加フィールド:
- `channel_id` (string): 冗長保持（単体レコードでソース追跡可能にする）
- `permalink` (string | null): Slack への参照リンク
- `project_ids` (string[]): 該当 project（最低1要素）
- `account_ids` (string[]): 該当 account（最低1要素）
- `labels` (string[]): 任意ラベル（例: `decision`, `incident`, `todo`）
- `message_type` (string): `parent` / `reply` / `channel_message`
- `updated_at` (string | null): message edits を追跡する余地

例:
```json
{
  "ts": "1773154792.189999",
  "channel_id": "C01G1P9CCDB",
  "user": "UAGJ7N9EK",
  "user_name": "tsukiji",
  "text": "こんにちは",
  "thread_ts": "1773154792.189999",
  "reply_count": 2,
  "message_type": "parent",
  "project_ids": ["proj_alpha"],
  "account_ids": ["acct_foo"],
  "labels": ["discussion"],
  "permalink": null,
  "reactions": [],
  "files": [],
  "created_at": "2026-03-10T23:59:52.189999",
  "updated_at": null
}
```

### 1-3. スレッド保存スキーマの拡張

対象: `channel_exports/{channel}/threads/{thread_ts}.json`

追加フィールド:
- `project_ids` (string[])
- `account_ids` (string[])
- `last_activity_at` (ISO8601)
- `message_count` (parent + replies)

意図:
- スレッド単位の週次トピック整理で直接利用できるようにする。

### 1-4. 新規 rollup ファイル

保存先:
- `channel_exports/_rollups/daily_rollup.json`
- `channel_exports/_rollups/weekly_rollup.json`

`daily_rollup.json` 例:
```json
{
  "version": 1,
  "generated_at": "2026-03-15T18:00:00+09:00",
  "timezone": "Asia/Tokyo",
  "days": [
    {
      "date": "2026-03-10",
      "project_id": "proj_alpha",
      "account_id": "acct_foo",
      "message_count": 12,
      "thread_count": 3,
      "participants": ["UAGJ7N9EK"],
      "highlights": [
        {
          "thread_ts": "1773154792.189999",
          "summary_hint": "要約候補テキスト",
          "message_ts": "1773154804.687979"
        }
      ]
    }
  ]
}
```

`weekly_rollup.json` 例:
```json
{
  "version": 1,
  "generated_at": "2026-03-15T18:00:00+09:00",
  "timezone": "Asia/Tokyo",
  "weeks": [
    {
      "week_start": "2026-03-09",
      "week_end": "2026-03-15",
      "project_id": "proj_alpha",
      "account_id": "acct_foo",
      "message_count": 58,
      "active_days": 5,
      "top_threads": [
        {
          "thread_ts": "1773154792.189999",
          "reply_count": 9
        }
      ]
    }
  ]
}
```

---

## 2. 実装差分（ファイル単位）

## 2-1. `backend/models/channel_export.py`

追加モデル:
- `ClassificationRule`（`channels`, `keywords`, `users`）
- `ProjectDefinition` / `AccountDefinition`
- `ClassificationConfig`
- `DailyRollupItem` / `WeeklyRollupItem` / `RollupDocument`

変更モデル:
- `ChannelExportConfig` はそのまま
- `ChannelDownloadState` は必要なら `last_rollup_at` を追加

## 2-2. `backend/repositories/channel_export_repository.py`

追加メソッド:
- `get_classification_config() -> ClassificationConfig`
- `save_classification_config(config: ClassificationConfig) -> None`
- `load_daily_messages(channel_dir: Path, date: str) -> Dict[str, Any]`
- `save_daily_messages_merged(..., merge_key="ts") -> None`

要点:
- 日別JSON保存を「全置換」から「`ts` マージ」に切り替える基盤をここに寄せる。

## 2-3. `backend/services/slack_client.py`

追加メソッド:
- `get_message_permalink(channel_id: str, message_ts: str) -> Optional[str]`

備考:
- API呼び出し増加を抑えるため、必要なら permalink はオプション化する（設定で有効/無効）。

## 2-4. `backend/services/channel_exporter.py`

主変更:
- `_save_json`:
  - `msg_data` に `project_ids`, `account_ids`, `labels`, `message_type`, `channel_id`, `permalink`, `updated_at` を追加。
  - 日別ファイル保存を上書きではなく `ts` キーでマージ。
- `_save_thread_index`:
  - `project_ids`, `account_ids`, `last_activity_at` を算出して保存。
- 新規 private メソッド:
  - `_classify_message(msg, channel_id, rules) -> (project_ids, account_ids, labels)`
  - `_merge_messages(existing, incoming) -> merged`
  - `_rebuild_rollups()`（全channelを走査して `_rollups/` を生成）

## 2-5. 新規: `backend/services/channel_rollup_builder.py`

責務:
- `channel_exports/*/messages/**/*.json` と `threads/*.json` を走査し、
  `daily_rollup.json` / `weekly_rollup.json` を生成。

主要I/O:
- input: channel export JSON
- output: `_rollups/daily_rollup.json`, `_rollups/weekly_rollup.json`

## 2-6. `backend/api/channel_export.py`

追加エンドポイント案:
- `GET /api/channel-export/rollups/daily`
- `GET /api/channel-export/rollups/weekly`
- `POST /api/channel-export/classification/validate`（任意）

## 2-7. `docs/DATA_STRUCTURE.md`

更新内容:
- `channel_export/classification.json` の説明追加
- `channel_exports/_rollups/*.json` の説明追加
- `messages/*.json`, `threads/*.json`, `index.json` の追加フィールド反映

---

## 3. 互換性・移行

## 3-1. 後方互換

- 既存JSONに新フィールドがなくても読み取り可能にする（`.get(..., default)`）。
- rollup生成は旧データでも `unclassified_*` を補って出力する。

## 3-2. 移行手順

1. 新モデル・リポジトリメソッド追加
2. exporter の保存ロジックをマージ型へ変更
3. rollup builder 追加
4. 既存 `channel_exports` 全体に対して一度 `rebuild_rollups` 実行
5. `docs/DATA_STRUCTURE.md` 更新

---

## 4. テスト観点

- 同一日の複数チャンク取得でメッセージ欠落しない（上書き回避）
- 古いスレッドへの新規返信が rollup 集計に反映される
- `project/account` 未分類時に default が付く
- 週次境界が指定 timezone で計算される
- 既存データ（追加フィールドなし）でも rollup 生成が落ちない

---

## 5. 実装優先順位（最短で価値を出す順）

1. 日別マージ保存（欠落防止）
2. classification 付与（project/account 軸の確立）
3. daily/weekly rollup 生成
4. permalink・labels・API公開

