# Slack スレッド管理アプリケーション - フロントエンド

Slackの複数スレッドを効率的に管理・追跡するためのWebアプリケーションのフロントエンド部分です。

## 技術スタック

- **フレームワーク**: React 18+
- **言語**: TypeScript
- **ビルドツール**: Vite
- **状態管理**: React Query (TanStack Query)
- **ルーティング**: React Router
- **HTTPクライアント**: Axios
- **スタイリング**: CSS (カスタムスタイル)

## 前提条件

以下のソフトウェアがインストールされている必要があります：

- **Node.js**: v18.0.0 以上
- **npm**: v9.0.0 以上（Node.jsに同梱）

### Node.jsのインストール確認

```bash
node --version  # v18.0.0以上であることを確認
npm --version   # v9.0.0以上であることを確認
```

Node.jsがインストールされていない場合は、[公式サイト](https://nodejs.org/)からダウンロードしてインストールしてください。

## 環境構築

### 1. 依存パッケージのインストール

フロントエンドディレクトリで以下のコマンドを実行します：

```bash
cd frontend
npm install
```

これにより、`package.json`に記載されているすべての依存パッケージがインストールされます。

### 2. 環境変数の設定（オプション）

必要に応じて、`.env`ファイルを作成してバックエンドAPIのURLを設定できます：

```bash
# .env
VITE_API_URL=http://localhost:8000
```

デフォルトでは`http://localhost:8000`を使用します。

## 起動方法

### 開発サーバーの起動

```bash
npm run dev
```

起動後、以下のURLでアクセスできます：
- **URL**: http://localhost:3000
- **自動リロード**: ファイル変更時に自動的にブラウザがリロードされます

### 本番ビルド

```bash
npm run build
```

ビルドされたファイルは`dist/`ディレクトリに出力されます。

### 本番ビルドのプレビュー

```bash
npm run preview
```

本番環境と同じ設定でローカルサーバーを起動し、ビルド結果を確認できます。

## 開発時の注意事項

### バックエンドAPIとの連携

フロントエンドはバックエンドAPI（FastAPI）と通信するため、**バックエンドサーバーが起動している必要があります**。

1. 別のターミナルでバックエンドを起動：
   ```bash
   cd ../backend
   uvicorn main:app --reload --host 0.0.0.0 --port 8000
   ```

2. フロントエンドを起動：
   ```bash
   cd frontend
   npm run dev
   ```

### API通信の確認

- バックエンドAPI: http://localhost:8000
- フロントエンド: http://localhost:3000
- APIドキュメント: http://localhost:8000/docs

## プロジェクト構成

```
frontend/
├── src/
│   ├── main.tsx              # アプリケーションのエントリーポイント
│   ├── App.tsx               # ルートコンポーネント
│   ├── pages/                # ページコンポーネント
│   │   ├── ThreadListPage.tsx      # スレッド一覧画面
│   │   ├── ThreadDetailPage.tsx    # スレッド詳細画面
│   │   ├── DiscoverPage.tsx        # 新規スレッド発見画面
│   │   ├── SearchPage.tsx          # 検索・質問画面
│   │   └── SettingsPage.tsx        # 設定画面
│   ├── components/           # 再利用可能なコンポーネント
│   ├── lib/
│   │   └── api.ts           # API通信ロジック
│   └── types/
│       └── index.ts         # TypeScript型定義
├── public/                   # 静的ファイル
├── package.json              # 依存パッケージ定義
├── vite.config.ts           # Vite設定
├── tsconfig.json            # TypeScript設定
└── README.md                # このファイル
```

## 主な機能

### 1. スレッド一覧画面
- スレッドのテーブル表示
- Excelスタイルのフィルタリング（タグ、ステータス）
- 検索・日付範囲フィルタ
- ソート機能（タイトル、メッセージ数、最終更新日）
- ページネーション（10/20/50/100件表示）
- 未読スレッドのハイライト表示

### 2. スレッド詳細画面
- スレッド基本情報の表示
- メッセージ一覧（時系列表示）
- 要約表示（トピック別）
- **LLM質問機能**: スレッドについての自然言語質問（Phase 6）
- Slackへのリンク
- 既読/未読管理

### 3. 新規スレッド発見画面
- メンション/キーワード検出
- 未登録スレッドの一覧表示
- 一括登録機能

### 4. 検索・質問画面
- 自然言語での質問（横断検索）
- Claude Agent SDKによる回答生成
- 関連スレッドへのリンク
- 検索履歴・ブックマーク機能

### 5. 設定画面
- 監視チャンネルの設定
- メンションユーザーの設定
- 検索キーワードの設定

## 開発ガイドライン

### コーディング規約

- **TypeScript**: 型安全性を重視し、`any`型の使用は最小限に
- **コンポーネント**: 機能ごとに分割し、再利用性を高める
- **スタイル**: コンポーネント専用のCSSファイルを使用
- **命名規則**:
  - コンポーネント: PascalCase（例: `ThreadListPage.tsx`）
  - 関数: camelCase（例: `handleSubmit`）
  - 定数: UPPER_SNAKE_CASE（例: `API_BASE_URL`）

### 状態管理

- **React Query**: サーバー状態の管理（API通信、キャッシング）
- **useState**: ローカルUI状態の管理（フォーム入力、モーダル表示など）

### API通信

`src/lib/api.ts`に定義されたAPI関数を使用します：

```typescript
import { threadsApi } from '@/lib/api';

// スレッド一覧取得
const threads = await threadsApi.getThreads({ limit: 20, offset: 0 });

// スレッド詳細取得
const thread = await threadsApi.getThread(threadId);

// スレッド専用質問（Phase 6）
const result = await threadsApi.queryThread(threadId, '質問内容');
```

## トラブルシューティング

### ポートが既に使用されている

```bash
Error: Port 3000 is already in use
```

**解決方法**: 別のポートを指定して起動

```bash
npm run dev -- --port 3001
```

### バックエンドAPIに接続できない

**症状**: API呼び出しが失敗する

**確認事項**:
1. バックエンドサーバーが起動しているか確認
   ```bash
   curl http://localhost:8000/api/threads
   ```
2. CORS設定が正しいか確認（バックエンド側の設定）

### 依存パッケージのエラー

```bash
npm ERR! code ERESOLVE
```

**解決方法**:
```bash
rm -rf node_modules package-lock.json
npm install
```

### ビルドエラー

TypeScriptの型エラーがある場合、以下で確認：

```bash
npm run type-check  # 型チェックのみ実行
```

## 利用可能なスクリプト

| コマンド | 説明 |
|---------|------|
| `npm run dev` | 開発サーバーを起動（HMR有効） |
| `npm run build` | 本番用にビルド |
| `npm run preview` | ビルド結果をプレビュー |
| `npm run lint` | ESLintでコードチェック |

## ブラウザ対応

- Chrome（最新版）
- Firefox（最新版）
- Safari（最新版）
- Edge（最新版）

**注意**: IE11はサポートしていません。

## ライセンス

このプロジェクトは内部利用を想定しています。

## 関連ドキュメント

- [プロジェクト全体の仕様書](../SPECIFICATION.md)
- [バックエンドREADME](../backend/README.md)
- [React公式ドキュメント](https://react.dev/)
- [Vite公式ドキュメント](https://vitejs.dev/)
- [React Query公式ドキュメント](https://tanstack.com/query/latest)

---

**最終更新**: 2025-11-10
**バージョン**: 1.2
