# プロジェクト/ユーザー別 Daily・Weekly 整理 仕様

## 1. 目的

上司が複数の部下・複数プロジェクトの進捗と活動状況を把握できるよう、Slack のコミュニケーション内容を以下2軸で整理する。

- プロジェクト別
- ユーザー別

対象期間は日次（daily）・週次（weekly）。

---

## 2. ユースケース

- 「Project A について今週どのようなコミュニケーションがあったか」を確認したい
- 「部下 U123 が今週どのプロジェクトでどのような活動をしたか」を確認したい
- Codex CLI などの AI agent に、ローカル保存済み Slack データを読ませて要約させたい

---

## 3. 前提と方針

- Slack メッセージはローカルにダウンロードして保持する
- ダウンロード対象は指定チャンネルのみ
- message 単位で恒久的な `project_id` は事前付与しない
- 要約時に `project` 定義（対象チャンネル・キーワード）を使って候補を抽出し、AI が文脈解釈して要約する

---

## 4. 必須メタデータ

初期スコープは以下の最小構成のみとする。

## 4.1 project 定義（必須）

- `project_id`
- `name`
- `target_channel_ids` (string[])
- `keywords` (string[])

例:

```json
{
  "project_id": "proj_a",
  "name": "Project A",
  "target_channel_ids": ["C01AAA", "C01BBB"],
  "keywords": ["project-a", "A案件", "alpha"]
}
```

## 4.2 user 定義（必須）

- `user_id`
- `display_name`

例:

```json
{
  "user_id": "U012345",
  "display_name": "tsukiji"
}
```

## 4.3 display_name 取得方針

`display_name` は Slack API から取得可能。`users.info` を使い、以下優先順で採用する。

1. `profile.display_name`
2. `real_name`
3. `name`

`user_id` を正とし、`display_name` は更新可能なキャッシュとして扱う。

---

## 5. データダウンロード仕様

## 5.1 対象

- `target_channel_ids` で指定されたチャンネル

## 5.2 取得方法

- 親メッセージ: `conversations.history`
- スレッド返信: `conversations.replies`

## 5.3 同期方式

- 増分同期を基本とし、チャンネルごとに `last_synced_ts` を保持
- 冪等性を担保するため、メッセージは `channel_id + ts` で一意扱い

## 5.4 保存方針

- 日別 JSON は `ts` キーでマージ保存（上書き欠落を防ぐ）
- Markdown は日別 JSON から再構築して整合性を保つ
- タイムゾーン境界はワークスペース基準で固定

---

## 6. AI 要約実行仕様

## 6.1 入力

- ローカル保存済み Slack メッセージ
- project 定義 (`target_channel_ids`, `keywords`)
- user 定義 (`user_id`, `display_name`)
- 期間（daily/weekly）

## 6.2 抽出

- `target_channel_ids + keywords + 期間` で候補メッセージを抽出
- ユーザー別は候補の中から `user_id` で整理

## 6.3 出力

- プロジェクト別 daily/weekly 要約
- ユーザー別 daily/weekly 要約

---

## 7. ケース対応

## 7.1 どのプロジェクトにも属さないチャンネル

- ユーザー別整理には含める
- プロジェクト別整理では project 条件に一致するもののみ採用

## 7.2 複数プロジェクトにまたがるチャンネル

- チャンネルは複数 project に共有可能
- 最終的な project 採用可否は `keywords` と文脈解釈で判断

---

## 8. UI 要件

ブラウザ上で以下を編集できること。

## 8.1 Projects 設定

- 追加 / 編集 / 削除
- 入力項目:
  - `project_id`
  - `name`
  - `target_channel_ids`（カンマ区切り入力可）
  - `keywords`（カンマ区切り入力可）

## 8.2 Users 設定

- 追加 / 編集 / 削除
- 入力項目:
  - `user_id`
  - `display_name`

## 8.3 補助機能

- Slack から user 表示名を再取得するボタン
- 保存時のバリデーション（必須項目空欄を拒否）

---

## 9. 非スコープ（現時点）

以下は今回の最小仕様には含めない。

- `account` 軸
- message 単位の恒久 `project_id` 付与
- 複雑なスコアリング分類ルール

---

## 10. 期待効果

- 仕様が単純で運用しやすい
- AI 要約前提に最適化され、過剰な前処理を避けられる
- 上司が欲しい「プロジェクト状況」と「部下活動」の両方を同じ基盤で確認できる

