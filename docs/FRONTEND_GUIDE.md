# Frontend 実装ガイド - React 初学者向け

このドキュメントは、Slack Thread Manager のフロントエンド実装を理解し、開発に参加できるようになるための包括的なガイドです。React の基礎知識がない方を対象に、React の基本概念から本プロジェクト固有の実装まで解説します。

---

## 目次

0. [JavaScript/Node.js 開発の基礎](#0-javascriptnodejs-開発の基礎)
1. [React の基礎知識](#1-react-の基礎知識)
2. [プロジェクト構成](#2-プロジェクト構成)
3. [開発環境のセットアップ](#3-開発環境のセットアップ)
4. [コンポーネントの理解](#4-コンポーネントの理解)
5. [状態管理(State Management)](#5-状態管理state-management)
6. [ルーティング(Routing)](#6-ルーティングrouting)
7. [API通信](#7-api通信)
8. [重要なパターンとベストプラクティス](#8-重要なパターンとベストプラクティス)
9. [実装例とチュートリアル](#9-実装例とチュートリアル)
10. [よくあるエラーと解決方法](#10-よくあるエラーと解決方法)

---

## 0. JavaScript/Node.js 開発の基礎

JavaScript/Node.js 開発が初めての方のために、基本的な概念とツールを説明します。

### 0.1 JavaScript とは?

**JavaScript** は、もともとブラウザ上で動的なWebページを作るために開発されたプログラミング言語です。現在では:

- **ブラウザ**: ユーザーインターフェースの構築(フロントエンド)
- **サーバー**: Node.js を使ってバックエンド開発も可能
- **モバイル**: React Native でスマホアプリ開発

このプロジェクトでは、ブラウザで動くフロントエンド開発に JavaScript を使用します。

### 0.2 Node.js とは?

**Node.js** は、JavaScript をブラウザの外(サーバー環境やローカルPC)で実行できるランタイム環境です。

**フロントエンド開発での役割**:
- 開発サーバーの起動
- パッケージ(ライブラリ)の管理
- ビルドツールの実行
- テストの実行

**重要**: フロントエンド開発でも Node.js は必須です。ブラウザで動くコードを書く際のツールとして使います。

### 0.3 npm とは?

**npm (Node Package Manager)** は、JavaScript のパッケージマネージャーです。

**主な機能**:
1. **パッケージのインストール**: 他の人が作った便利なライブラリを利用
2. **スクリプト実行**: プロジェクトで定義されたコマンドを実行
3. **依存関係の管理**: プロジェクトに必要なライブラリのバージョン管理

**類似ツールとの比較**:
- Python の `pip`
- Ruby の `gem`
- Java の `Maven`/`Gradle`

**基本コマンド**:

```bash
# パッケージをインストール(package.json の依存関係をすべてインストール)
npm install

# 特定のパッケージを追加
npm install axios

# 開発用パッケージを追加(-D は --save-dev の省略形)
npm install -D typescript

# スクリプトを実行
npm run dev
npm run build

# グローバルにパッケージをインストール
npm install -g create-react-app
```

### 0.4 package.json - プロジェクトの設定ファイル

**package.json** は、プロジェクトの情報と依存関係を記述するファイルです。

**場所**: [frontend/package.json](frontend/package.json)

```json
{
  "name": "frontend",
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "lint": "eslint .",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^19.1.1",
    "react-dom": "^19.1.1",
    "axios": "^1.13.1"
  },
  "devDependencies": {
    "typescript": "~5.9.3",
    "vite": "^7.1.7"
  }
}
```

**各セクションの説明**:

1. **name**: プロジェクト名
2. **version**: プロジェクトのバージョン
3. **type**: `"module"` は ES Modules を使用することを示す
4. **scripts**: 実行可能なコマンドを定義
   - `npm run dev` → `vite` コマンドを実行
   - `npm run build` → TypeScript コンパイル後、ビルド実行
5. **dependencies**: 本番環境でも必要なパッケージ
6. **devDependencies**: 開発時のみ必要なパッケージ

**バージョン表記**:
- `^19.1.1`: 19.x.x の最新版(メジャーバージョンは固定)
- `~5.9.3`: 5.9.x の最新版(マイナーバージョンも固定)
- `^` は互換性のある範囲で更新、`~` はより保守的な更新

### 0.5 node_modules とは?

**node_modules** は、`npm install` でインストールされたパッケージが保存されるディレクトリです。

**特徴**:
- 数千〜数万のファイルを含む(パッケージの依存関係も含む)
- Git にはコミットしない(`.gitignore` に記載)
- `npm install` で再生成できる

**サイズが大きい理由**:
- パッケージが他のパッケージに依存している
- 依存関係が連鎖的に増える
- 例: React をインストールすると、React が依存する他のパッケージも自動インストールされる

### 0.6 ES Modules (import/export)

モダンな JavaScript では、ファイル間でコードを共有するために **ES Modules** を使います。

#### エクスポート(公開)

```typescript
// lib/api.ts - 他のファイルで使えるように公開

// 名前付きエクスポート(複数可)
export const API_BASE_URL = 'http://localhost:8000';

export function getThreads() {
  return fetch('/threads');
}

// デフォルトエクスポート(1つのみ)
export default class ApiClient {
  // ...
}
```

#### インポート(使用)

```typescript
// pages/ThreadListPage.tsx - 他のファイルから利用

// 名前付きインポート
import { API_BASE_URL, getThreads } from '../lib/api';

// デフォルトインポート
import ApiClient from '../lib/api';

// すべてをインポート
import * as api from '../lib/api';

// 使用
console.log(api.API_BASE_URL);
api.getThreads();
```

**他の言語との比較**:
- Python の `import` / `from ... import ...`
- Java の `import`
- C++ の `#include`

### 0.7 Vite - 開発サーバー&ビルドツール

**Vite (ヴィート)** は、高速な開発環境を提供するビルドツールです。

**主な機能**:

1. **開発サーバー**
   - コードを保存すると即座にブラウザに反映(HMR: Hot Module Replacement)
   - 起動が超高速(大規模プロジェクトでも数秒)

2. **本番ビルド**
   - TypeScript → JavaScript に変換
   - コードの最適化・圧縮
   - 複数ファイルをバンドル(結合)

3. **自動変換**
   - TypeScript → JavaScript
   - JSX → JavaScript
   - 最新の JavaScript → 古いブラウザでも動く JavaScript

**従来のツール(Webpack)との違い**:
- Webpack: 全ファイルをバンドルしてから起動(遅い)
- Vite: 必要なファイルだけを読み込む(速い)

**設定ファイル**: [frontend/vite.config.ts](frontend/vite.config.ts)

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()], // React のサポートを有効化
})
```

シンプルな設定で、複雑なビルド処理を自動化してくれます。

**開発フロー**:

```bash
# 開発サーバー起動
npm run dev

# ↓ Vite が以下を自動実行:
# 1. TypeScript → JavaScript に変換
# 2. JSX → JavaScript に変換
# 3. 開発サーバー起動(デフォルト: http://localhost:5173)
# 4. ファイル監視開始
# 5. 変更を検知したら自動リロード
```

**本番ビルド**:

```bash
npm run build

# ↓ 以下が実行される:
# 1. TypeScript の型チェック (tsc -b)
# 2. コードの最適化・圧縮
# 3. 複数ファイルを少数のファイルにバンドル
# 4. dist/ ディレクトリに出力
```

### 0.8 TypeScript - 型付き JavaScript

**TypeScript** は、JavaScript に型の概念を追加した言語です。

**JavaScript の問題点**:

```javascript
// JavaScript - 型がないので実行時エラー
function greet(name) {
  return 'Hello, ' + name.toUpperCase();
}

greet(123); // 実行時エラー: toUpperCase is not a function
```

**TypeScript の解決策**:

```typescript
// TypeScript - 型を指定
function greet(name: string): string {
  return 'Hello, ' + name.toUpperCase();
}

greet(123); // コンパイルエラー: 数値は受け付けない(実行前に気づける!)
greet('太郎'); // OK
```

**メリット**:
1. **エディタの補完**: コードを書く時に候補が表示される
2. **エラーの早期発見**: 実行前にミスを発見
3. **リファクタリングが安全**: 変更の影響範囲がわかる
4. **ドキュメント代わり**: 型を見れば使い方がわかる

**他の言語との対応**:
- C++/Java の静的型付けに近い
- Python の型ヒント(Type Hints)に似ている

**TypeScript の設定**: [frontend/tsconfig.json](frontend/tsconfig.json)

```json
{
  "compilerOptions": {
    "target": "ES2022",              // 出力する JavaScript のバージョン
    "module": "ESNext",              // モジュールシステム
    "strict": true,                  // 厳格な型チェックを有効化
    "jsx": "react-jsx",              // JSX のサポート
    "moduleResolution": "bundler"    // モジュールの解決方法
  }
}
```

### 0.9 開発に必要なツールのまとめ

| ツール | 役割 | このプロジェクトでの用途 |
|--------|------|------------------------|
| **Node.js** | JavaScript 実行環境 | 開発サーバーとビルドツールの実行 |
| **npm** | パッケージマネージャー | ライブラリのインストールとスクリプト実行 |
| **Vite** | ビルドツール | 開発サーバーと本番ビルド |
| **TypeScript** | 型付き JavaScript | 型安全なコード記述 |
| **React** | UI ライブラリ | ユーザーインターフェースの構築 |
| **ESLint** | コード品質チェック | コーディング規約の自動チェック |

### 0.10 開発の流れ(初回セットアップから実行まで)

```bash
# ステップ 1: Node.js がインストールされているか確認
node --version  # v18 以上が推奨

# ステップ 2: npm のバージョン確認
npm --version

# ステップ 3: プロジェクトのディレクトリに移動
cd /path/to/frontend

# ステップ 4: 依存関係をインストール
npm install
# ↓ これで package.json に記載された全パッケージが node_modules/ にインストールされる

# ステップ 5: 環境変数を設定
echo "VITE_API_BASE_URL=http://localhost:8000" > .env

# ステップ 6: 開発サーバーを起動
npm run dev
# ↓ ブラウザで http://localhost:5173 にアクセス

# ステップ 7: コードを編集
# エディタでファイルを編集して保存すると、ブラウザが自動でリロード

# ステップ 8: ビルドして本番用ファイルを生成(必要な場合)
npm run build
# ↓ dist/ ディレクトリに最適化されたファイルが出力される
```

### 0.11 よくある初心者の疑問

**Q1: なぜ npm install を実行する必要があるの?**

A: Git リポジトリには `node_modules/` が含まれていません(サイズが大きいため)。`package.json` に記載されているパッケージを `npm install` でダウンロードする必要があります。

**Q2: package.json と package-lock.json の違いは?**

A:
- `package.json`: 依存パッケージの「範囲」を指定(`^19.1.1` など)
- `package-lock.json`: 実際にインストールされた「正確なバージョン」を記録

両方を Git にコミットすることで、チーム全員が同じバージョンのパッケージを使えます。

**Q3: node_modules/ を削除しても大丈夫?**

A: はい、大丈夫です。`npm install` で再生成できます。ディスク容量を圧迫する場合は削除して問題ありません。

**Q4: npm run dev と npm run build の違いは?**

A:
- `npm run dev`: 開発サーバー起動(コードの変更を即座に反映)
- `npm run build`: 本番用ファイル生成(最適化・圧縮された静的ファイル)

開発中は `npm run dev` を使い、デプロイ時に `npm run build` を実行します。

**Q5: TypeScript のエラーが出たらどうすればいい?**

A: エディタ(VS Code)に赤い波線が表示されます。マウスを乗せるとエラー内容が表示されるので、型を修正します。わからない場合は `any` 型を使うことも可能ですが、TypeScript の恩恵が減ります。

---

## 1. React の基礎知識

### 1.1 React とは?

React は、ユーザーインターフェース(UI)を構築するための JavaScript ライブラリです。Facebook(現Meta)が開発し、以下の特徴があります:

- **コンポーネントベース**: UI を再利用可能な部品(コンポーネント)に分割
- **宣言的**: 「どうやって」ではなく「何を」表示するかを記述
- **仮想DOM**: 効率的な画面更新

### 1.2 JSX - HTML のような構文

React では JSX という構文を使います。JavaScript の中に HTML のようなコードを書けます:

```jsx
// JSX の例
const greeting = <h1>こんにちは、世界!</h1>;

// JavaScript の変数を埋め込める
const name = "太郎";
const element = <h1>こんにちは、{name}さん!</h1>;

// 条件分岐も可能
const isLoggedIn = true;
const message = (
  <div>
    {isLoggedIn ? <p>ログイン中です</p> : <p>ログインしてください</p>}
  </div>
);
```

### 1.3 コンポーネント - UI の部品

コンポーネントは React の基本単位です。関数として定義します:

```tsx
// シンプルなコンポーネント
function Welcome() {
  return <h1>ようこそ!</h1>;
}

// プロパティ(props)を受け取るコンポーネント
function Greeting({ name }: { name: string }) {
  return <h1>こんにちは、{name}さん!</h1>;
}

// 使用例
function App() {
  return (
    <div>
      <Welcome />
      <Greeting name="太郎" />
    </div>
  );
}
```

### 1.4 State - 動的なデータ

State は、コンポーネントが持つ変化するデータです。`useState` フックを使います:

```tsx
import { useState } from 'react';

function Counter() {
  // [現在の値, 値を更新する関数] = useState(初期値)
  const [count, setCount] = useState(0);

  return (
    <div>
      <p>カウント: {count}</p>
      <button onClick={() => setCount(count + 1)}>
        増やす
      </button>
    </div>
  );
}
```

### 1.5 Effect - 副作用の処理

API 呼び出しやタイマーなどの副作用は `useEffect` で処理します:

```tsx
import { useState, useEffect } from 'react';

function UserProfile({ userId }: { userId: string }) {
  const [user, setUser] = useState(null);

  useEffect(() => {
    // コンポーネント表示時に実行される
    fetch(`/api/users/${userId}`)
      .then(res => res.json())
      .then(data => setUser(data));
  }, [userId]); // userId が変わったら再実行

  if (!user) return <div>読み込み中...</div>;
  return <div>{user.name}</div>;
}
```

### 1.6 TypeScript との組み合わせ

このプロジェクトでは TypeScript を使用しています。型を明示することでエラーを防ぎます:

```tsx
// Props の型定義
interface ButtonProps {
  text: string;
  onClick: () => void;
  disabled?: boolean; // ? は省略可能を意味する
}

// 型安全なコンポーネント
function Button({ text, onClick, disabled = false }: ButtonProps) {
  return (
    <button onClick={onClick} disabled={disabled}>
      {text}
    </button>
  );
}

// 使用時に型チェックされる
<Button text="保存" onClick={() => console.log('保存')} />
```

---

## 2. プロジェクト構成

### 2.1 ディレクトリ構造

```
frontend/
├── public/                      # 静的ファイル
│   └── vite.svg                # ファビコン
├── src/                        # ソースコード
│   ├── main.tsx               # アプリケーションのエントリーポイント
│   ├── App.tsx                # ルートコンポーネント(ルーティング設定)
│   ├── index.css              # グローバルスタイル
│   ├── App.css                # App コンポーネントのスタイル
│   │
│   ├── pages/                 # ページコンポーネント(5つ)
│   │   ├── ThreadListPage.tsx         # スレッド一覧ページ
│   │   ├── ThreadDetailPage.tsx       # スレッド詳細ページ
│   │   ├── ArchivedThreadsPage.tsx    # アーカイブページ
│   │   ├── DiscoverPage.tsx           # 新規スレッド発見ページ
│   │   └── SearchPage.tsx             # 検索ページ
│   │
│   ├── components/            # 再利用可能なUIコンポーネント(11個)
│   │   ├── FilterPanel.tsx            # フィルタパネル
│   │   ├── Pagination.tsx             # ページネーション
│   │   ├── ViewSelector.tsx           # ビュー選択
│   │   ├── ThreadEditModal.tsx        # スレッド編集モーダル
│   │   ├── ThreadCreateModal.tsx      # スレッド作成モーダル
│   │   ├── ViewFormModal.tsx          # ビュー作成・編集モーダル
│   │   ├── ViewManagementModal.tsx    # ビュー管理モーダル
│   │   ├── SlackCredentialsModal.tsx  # Slack認証情報設定モーダル
│   │   ├── ChannelManagementModal.tsx # チャンネル管理モーダル
│   │   └── TagManagementModal.tsx     # タグ管理モーダル
│   │
│   ├── lib/                   # ビジネスロジック・ユーティリティ
│   │   └── api.ts            # API クライアント(Axios)
│   │
│   ├── types/                 # TypeScript 型定義
│   │   └── index.ts          # すべての interface と type
│   │
│   └── utils/                 # ヘルパー関数
│       └── formatSlackText.tsx # Slack テキストのフォーマット
│
├── package.json               # 依存関係とスクリプト
├── vite.config.ts            # Vite ビルド設定
├── tsconfig.json             # TypeScript 設定
└── index.html                # HTML エントリーポイント
```

### 2.2 設計原則

1. **ページとコンポーネントの分離**
   - `pages/`: ルートに対応する画面コンポーネント
   - `components/`: 複数の場所で再利用される UI 部品

2. **関心の分離**
   - API ロジックは `lib/api.ts` に集約
   - UI コンポーネントはプレゼンテーションに専念

3. **型安全性**
   - すべての型定義を `types/index.ts` に集中管理
   - TypeScript の strict モードを有効化

4. **コロケーション**
   - 各コンポーネントに対応する CSS ファイルを同じディレクトリに配置

---

## 3. 開発環境のセットアップ

### 3.1 必要なツール

- **Node.js** (v18 以上推奨)
- **npm** (Node.js に付属)
- **エディタ**: VS Code 推奨(TypeScript サポートが優秀)

### 3.2 初回セットアップ

```bash
# 1. frontend ディレクトリに移動
cd frontend

# 2. 依存関係をインストール
npm install

# 3. 環境変数を設定(.env ファイルを作成)
echo "VITE_API_BASE_URL=http://localhost:8000" > .env

# 4. 開発サーバーを起動
npm run dev
```

開発サーバーが起動したら、ブラウザで `http://localhost:5173` にアクセスします。

### 3.3 開発フロー

```bash
# 開発サーバーを起動(ファイル保存時に自動リロード)
npm run dev

# TypeScript の型チェック
npm run build

# Linter でコード品質チェック
npm run lint

# 本番ビルド(dist/ フォルダに生成)
npm run build

# 本番ビルドをプレビュー
npm run preview
```

### 3.4 Hot Module Replacement (HMR)

Vite は HMR に対応しています。ファイルを編集して保存すると:

1. ブラウザが自動的に更新される
2. State が保持される(画面の状態がリセットされない)
3. 変更した部分だけが即座に反映される

これにより、開発体験が大幅に向上します。

---

## 4. コンポーネントの理解

### 4.1 コンポーネント階層

```
main.tsx (エントリーポイント)
  └── App.tsx (ルートコンポーネント)
      ├── BrowserRouter (ルーティング)
      ├── QueryClientProvider (状態管理)
      └── Routes (ルート定義)
          ├── ThreadListPage (スレッド一覧)
          │   ├── FilterPanel (フィルタ)
          │   ├── ViewSelector (ビュー選択)
          │   ├── Pagination (ページネーション)
          │   └── 各種モーダル
          ├── ThreadDetailPage (スレッド詳細)
          ├── SearchPage (検索)
          ├── DiscoverPage (発見)
          └── ArchivedThreadsPage (アーカイブ)
```

### 4.2 エントリーポイント - main.tsx

**場所**: [frontend/src/main.tsx](frontend/src/main.tsx)

```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// HTML の <div id="root"></div> に React アプリをマウント
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
```

**解説**:
- `createRoot`: React 19 の新しいルートAPI
- `StrictMode`: 開発時に潜在的な問題を警告
- `getElementById('root')!`: `!` は TypeScript に「この要素は必ず存在する」と伝える

### 4.3 ルートコンポーネント - App.tsx

**場所**: [frontend/src/App.tsx](frontend/src/App.tsx)

```tsx
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// ページコンポーネントをインポート
import ThreadListPage from './pages/ThreadListPage';
import ThreadDetailPage from './pages/ThreadDetailPage';
// ... 他のページ

// React Query の設定
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false, // ウィンドウフォーカス時に再取得しない
      retry: 1,                    // 失敗時に1回だけリトライ
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        {/* ナビゲーションバー */}
        <nav className="navbar">
          <div className="nav-content">
            <Link to="/" className="nav-brand">Slack Thread Manager</Link>
            <div className="nav-links">
              <Link to="/">スレッド一覧</Link>
              <Link to="/search">検索</Link>
              <Link to="/discover">新規発見</Link>
              <Link to="/archived">アーカイブ</Link>
            </div>
          </div>
        </nav>

        {/* ルート定義 */}
        <Routes>
          <Route path="/" element={<ThreadListPage />} />
          <Route path="/threads/:threadId" element={<ThreadDetailPage />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/discover" element={<DiscoverPage />} />
          <Route path="/archived" element={<ArchivedThreadsPage />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
```

**重要ポイント**:
- `QueryClientProvider`: 全体を React Query でラップ
- `BrowserRouter`: ブラウザのURL履歴を管理
- `Routes` と `Route`: URL パスとコンポーネントの対応
- `Link`: ページ遷移のためのリンク

### 4.4 ページコンポーネント例 - ThreadListPage

**場所**: [frontend/src/pages/ThreadListPage.tsx](frontend/src/pages/ThreadListPage.tsx)

主な機能:
1. スレッド一覧の取得・表示
2. フィルタリング(検索、日付範囲、タグ)
3. ソート(作成日時、更新日時、未読優先)
4. ページネーション
5. ビュー保存・呼び出し
6. スレッド作成・編集

**構造**:

```tsx
function ThreadListPage() {
  // 1. State 管理
  const [filters, setFilters] = useState<FilterState>({
    search: '',
    dateFrom: '',
    dateTo: '',
    tags: []
  });
  const [sortBy, setSortBy] = useState('created_at');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);

  // 2. React Query でデータ取得
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['threads', filters, sortBy, currentPage, itemsPerPage],
    queryFn: () => threadsApi.getThreads({
      search: filters.search,
      date_from: filters.dateFrom,
      date_to: filters.dateTo,
      tag_ids: filters.tags,
      sort_by: sortBy,
      page: currentPage,
      limit: itemsPerPage
    }),
  });

  // 3. UI レンダリング
  return (
    <div className="thread-list-page">
      {/* フィルタパネル */}
      <FilterPanel filters={filters} onFilterChange={setFilters} />

      {/* ソート・ビュー選択 */}
      <div className="controls">
        <select value={sortBy} onChange={e => setSortBy(e.target.value)}>
          <option value="created_at">作成日時</option>
          <option value="updated_at">更新日時</option>
        </select>
        <ViewSelector onViewApply={handleViewApply} />
      </div>

      {/* スレッド一覧 */}
      {isLoading && <div>読み込み中...</div>}
      {error && <div>エラー: {error.message}</div>}
      {data && (
        <>
          {data.items.map(thread => (
            <ThreadCard key={thread.id} thread={thread} />
          ))}
          <Pagination
            currentPage={currentPage}
            totalItems={data.total}
            itemsPerPage={itemsPerPage}
            onPageChange={setCurrentPage}
            onItemsPerPageChange={setItemsPerPage}
          />
        </>
      )}
    </div>
  );
}
```

### 4.5 再利用可能なコンポーネント例 - FilterPanel

**場所**: [frontend/src/components/FilterPanel.tsx](frontend/src/components/FilterPanel.tsx)

```tsx
interface FilterPanelProps {
  filters: FilterState;
  onFilterChange: (filters: FilterState) => void;
}

function FilterPanel({ filters, onFilterChange }: FilterPanelProps) {
  // デバウンス処理(入力が止まってから500ms後に検索)
  const [searchInput, setSearchInput] = useState(filters.search);

  useEffect(() => {
    const timer = setTimeout(() => {
      onFilterChange({ ...filters, search: searchInput });
    }, 500);

    return () => clearTimeout(timer); // クリーンアップ
  }, [searchInput]);

  return (
    <div className="filter-panel">
      {/* 検索ボックス */}
      <input
        type="text"
        placeholder="スレッドを検索..."
        value={searchInput}
        onChange={e => setSearchInput(e.target.value)}
      />

      {/* 日付範囲 */}
      <input
        type="date"
        value={filters.dateFrom}
        onChange={e => onFilterChange({ ...filters, dateFrom: e.target.value })}
      />
      <input
        type="date"
        value={filters.dateTo}
        onChange={e => onFilterChange({ ...filters, dateTo: e.target.value })}
      />
    </div>
  );
}
```

**重要パターン**:
- **Controlled Components**: input の値を state で管理
- **Debouncing**: 入力完了を待ってから処理(無駄なAPI呼び出しを防ぐ)
- **Props Drilling**: 親から子へデータを渡す

---

## 5. 状態管理(State Management)

### 5.1 状態管理の種類

このプロジェクトでは、2種類の状態を区別して管理します:

1. **サーバー状態**: API から取得するデータ → **React Query**
2. **UI 状態**: モーダルの開閉、入力フォームの値 → **useState**

### 5.2 React Query - サーバー状態管理

**なぜ React Query?**

従来は Redux などを使っていましたが、React Query を使うと:
- API レスポンスの自動キャッシュ
- バックグラウンド再取得
- 楽観的更新(Optimistic Updates)
- ローディング・エラー状態の自動管理
- Redux のボイラープレート不要

#### 5.2.1 データ取得 - useQuery

```tsx
import { useQuery } from '@tanstack/react-query';
import { threadsApi } from '../lib/api';

function ThreadList() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['threads'],           // キャッシュのキー
    queryFn: () => threadsApi.getThreads(), // データ取得関数
  });

  // ローディング中
  if (isLoading) return <div>読み込み中...</div>;

  // エラー発生
  if (error) return <div>エラー: {error.message}</div>;

  // データ表示
  return (
    <div>
      {data.items.map(thread => (
        <div key={thread.id}>{thread.title}</div>
      ))}
      <button onClick={() => refetch()}>再読み込み</button>
    </div>
  );
}
```

**queryKey の役割**:
- キャッシュの識別子
- 配列で指定し、要素が変わると再取得される

```tsx
// パラメータが変わったら自動的に再取得
const { data } = useQuery({
  queryKey: ['threads', page, filters], // page や filters が変わると再取得
  queryFn: () => threadsApi.getThreads({ page, ...filters }),
});
```

#### 5.2.2 データ更新 - useMutation

```tsx
import { useMutation, useQueryClient } from '@tanstack/react-query';

function ThreadEditor() {
  const queryClient = useQueryClient();

  const updateMutation = useMutation({
    mutationFn: (data) => threadsApi.updateThread(threadId, data),
    onSuccess: () => {
      // キャッシュを無効化して再取得
      queryClient.invalidateQueries({ queryKey: ['threads'] });
      queryClient.invalidateQueries({ queryKey: ['thread', threadId] });
    },
    onError: (error) => {
      alert(`エラー: ${error.message}`);
    },
  });

  const handleSubmit = (formData) => {
    updateMutation.mutate(formData);
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* フォーム */}
      <button type="submit" disabled={updateMutation.isPending}>
        {updateMutation.isPending ? '保存中...' : '保存'}
      </button>
    </form>
  );
}
```

**フロー**:
1. `mutate()` を呼ぶ → API リクエスト
2. 成功 → `onSuccess` が実行 → キャッシュを無効化
3. キャッシュ無効化 → 関連する `useQuery` が自動的に再取得

#### 5.2.3 楽観的更新(Optimistic Updates)

サーバーのレスポンスを待たずに UI を更新する手法:

```tsx
const markAsReadMutation = useMutation({
  mutationFn: (threadId) => threadsApi.markAsRead(threadId),
  onMutate: async (threadId) => {
    // 進行中のクエリをキャンセル
    await queryClient.cancelQueries({ queryKey: ['threads'] });

    // 以前のデータを保存(ロールバック用)
    const previousThreads = queryClient.getQueryData(['threads']);

    // キャッシュを即座に更新(楽観的)
    queryClient.setQueryData(['threads'], (old) => ({
      ...old,
      items: old.items.map(thread =>
        thread.id === threadId ? { ...thread, is_read: true } : thread
      )
    }));

    return { previousThreads };
  },
  onError: (err, threadId, context) => {
    // エラー時はロールバック
    queryClient.setQueryData(['threads'], context.previousThreads);
  },
  onSettled: () => {
    // 最後にサーバーの最新データで同期
    queryClient.invalidateQueries({ queryKey: ['threads'] });
  },
});
```

**メリット**:
- ユーザーに即座にフィードバック
- レスポンシブな UX
- ネットワーク遅延を感じさせない

### 5.3 useState - UI 状態管理

モーダルの開閉、フォーム入力など、ローカルな状態は `useState`:

```tsx
function ThreadListPage() {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedThread, setSelectedThread] = useState(null);

  const handleEdit = (thread) => {
    setSelectedThread(thread);
    setIsEditModalOpen(true);
  };

  return (
    <div>
      <button onClick={() => setIsCreateModalOpen(true)}>
        新規作成
      </button>

      <ThreadCreateModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
      />

      <ThreadEditModal
        isOpen={isEditModalOpen}
        thread={selectedThread}
        onClose={() => {
          setIsEditModalOpen(false);
          setSelectedThread(null);
        }}
      />
    </div>
  );
}
```

---

## 6. ルーティング(Routing)

### 6.1 React Router の基本

**ライブラリ**: React Router v6

**場所**: [frontend/src/App.tsx](frontend/src/App.tsx)

```tsx
import { BrowserRouter, Routes, Route, Link, useNavigate, useParams } from 'react-router-dom';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<ThreadListPage />} />
        <Route path="/threads/:threadId" element={<ThreadDetailPage />} />
        <Route path="/search" element={<SearchPage />} />
        <Route path="/discover" element={<DiscoverPage />} />
        <Route path="/archived" element={<ArchivedThreadsPage />} />
      </Routes>
    </BrowserRouter>
  );
}
```

### 6.2 ナビゲーション

#### 宣言的ナビゲーション - Link

```tsx
import { Link } from 'react-router-dom';

function Navigation() {
  return (
    <nav>
      <Link to="/">ホーム</Link>
      <Link to="/search">検索</Link>
      <Link to="/threads/123">スレッド123</Link>
    </nav>
  );
}
```

#### プログラマティックナビゲーション - useNavigate

```tsx
import { useNavigate } from 'react-router-dom';

function ThreadActions() {
  const navigate = useNavigate();

  const handleDelete = async (threadId) => {
    await threadsApi.deleteThread(threadId);
    navigate('/'); // 削除後、一覧ページへ
  };

  const handleCancel = () => {
    navigate(-1); // 前のページに戻る
  };

  return (
    <div>
      <button onClick={() => handleDelete('123')}>削除</button>
      <button onClick={handleCancel}>キャンセル</button>
    </div>
  );
}
```

### 6.3 URL パラメータの取得 - useParams

```tsx
import { useParams } from 'react-router-dom';

function ThreadDetailPage() {
  // URL の :threadId 部分を取得
  const { threadId } = useParams<{ threadId: string }>();

  const { data: thread } = useQuery({
    queryKey: ['thread', threadId],
    queryFn: () => threadsApi.getThread(threadId!),
  });

  if (!thread) return <div>読み込み中...</div>;

  return (
    <div>
      <h1>{thread.title}</h1>
      {/* スレッド詳細 */}
    </div>
  );
}
```

**URL例**: `/threads/abc123` → `threadId` は `"abc123"`

### 6.4 クエリパラメータの利用

```tsx
import { useSearchParams } from 'react-router-dom';

function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams();

  // URL から取得: /search?q=react&page=2
  const query = searchParams.get('q') || '';
  const page = parseInt(searchParams.get('page') || '1');

  const handleSearch = (newQuery) => {
    setSearchParams({ q: newQuery, page: '1' });
  };

  return (
    <div>
      <input
        value={query}
        onChange={e => handleSearch(e.target.value)}
      />
    </div>
  );
}
```

---

## 7. API通信

### 7.1 Axios ベースの API クライアント

**場所**: [frontend/src/lib/api.ts](frontend/src/lib/api.ts)

#### 基本セットアップ

```tsx
import axios from 'axios';

// .env から環境変数を取得
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

// Axios インスタンスを作成
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// エラーハンドリング
api.interceptors.response.use(
  response => response,
  error => {
    console.error('API Error:', error);
    return Promise.reject(error);
  }
);
```

### 7.2 API モジュールの構成

API 機能ごとに名前空間で整理:

```tsx
// スレッド関連 API
export const threadsApi = {
  // 一覧取得
  getThreads: async (params: ThreadsQuery) => {
    const response = await api.get('/threads', { params });
    return response.data;
  },

  // 詳細取得
  getThread: async (threadId: string) => {
    const response = await api.get(`/threads/${threadId}`);
    return response.data;
  },

  // 作成
  createThread: async (data: ThreadCreate) => {
    const response = await api.post('/threads', data);
    return response.data;
  },

  // 更新
  updateThread: async (threadId: string, data: ThreadUpdate) => {
    const response = await api.patch(`/threads/${threadId}`, data);
    return response.data;
  },

  // 削除
  deleteThread: async (threadId: string) => {
    await api.delete(`/threads/${threadId}`);
  },

  // カスタムアクション
  markAsRead: async (threadId: string) => {
    const response = await api.post(`/threads/${threadId}/mark-read`);
    return response.data;
  },

  archiveThread: async (threadId: string) => {
    const response = await api.post(`/threads/${threadId}/archive`);
    return response.data;
  },
};

// サマリー関連 API
export const summariesApi = {
  getSummary: async (threadId: string) => {
    const response = await api.get(`/threads/${threadId}/summary`);
    return response.data;
  },

  generateSummary: async (threadId: string, force: boolean = false) => {
    const response = await api.post(`/threads/${threadId}/summary/generate`, { force });
    return response.data;
  },
};

// 検索関連 API
export const searchApi = {
  search: async (query: string) => {
    const response = await api.get('/search', { params: { q: query } });
    return response.data;
  },

  getSearchHistory: async () => {
    const response = await api.get('/search/history');
    return response.data;
  },
};

// 設定関連 API
export const configApi = {
  getMonitoredChannels: async () => {
    const response = await api.get('/config/monitored-channels');
    return response.data;
  },

  updateMonitoredChannels: async (channels: string[]) => {
    const response = await api.post('/config/monitored-channels', { channels });
    return response.data;
  },
};

// ビュー(保存されたフィルタ)関連 API
export const viewsApi = {
  getViews: async () => {
    const response = await api.get('/views');
    return response.data;
  },

  createView: async (data: ViewCreate) => {
    const response = await api.post('/views', data);
    return response.data;
  },

  deleteView: async (viewId: string) => {
    await api.delete(`/views/${viewId}`);
  },
};

// タグ関連 API
export const tagsApi = {
  getTags: async () => {
    const response = await api.get('/tags');
    return response.data;
  },

  createTag: async (data: TagCreate) => {
    const response = await api.post('/tags', data);
    return response.data;
  },
};
```

### 7.3 コンポーネントでの使用例

```tsx
import { threadsApi, summariesApi } from '../lib/api';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

function ThreadDetailPage() {
  const { threadId } = useParams<{ threadId: string }>();
  const queryClient = useQueryClient();

  // スレッド詳細を取得
  const { data: thread, isLoading } = useQuery({
    queryKey: ['thread', threadId],
    queryFn: () => threadsApi.getThread(threadId!),
  });

  // サマリーを取得
  const { data: summary } = useQuery({
    queryKey: ['summary', threadId],
    queryFn: () => summariesApi.getSummary(threadId!),
  });

  // サマリー生成
  const generateMutation = useMutation({
    mutationFn: () => summariesApi.generateSummary(threadId!, true),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['summary', threadId] });
    },
  });

  // 既読マーク
  const markAsReadMutation = useMutation({
    mutationFn: () => threadsApi.markAsRead(threadId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['thread', threadId] });
      queryClient.invalidateQueries({ queryKey: ['threads'] });
    },
  });

  if (isLoading) return <div>読み込み中...</div>;

  return (
    <div>
      <h1>{thread.title}</h1>

      <button onClick={() => markAsReadMutation.mutate()}>
        既読にする
      </button>

      {summary ? (
        <div className="summary">{summary.content}</div>
      ) : (
        <button onClick={() => generateMutation.mutate()}>
          サマリーを生成
        </button>
      )}
    </div>
  );
}
```

### 7.4 環境変数の設定

**ファイル**: `frontend/.env`

```bash
VITE_API_BASE_URL=http://localhost:8000
```

**使用方法**:

```tsx
// Vite では import.meta.env で環境変数にアクセス
const apiUrl = import.meta.env.VITE_API_BASE_URL;

// 型安全にするための定義(vite-env.d.ts)
interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string;
}
```

**重要**:
- Vite の環境変数は必ず `VITE_` で始める必要があります
- `.env` ファイルは Git に含めない(`.gitignore` に追加)

---

## 8. 重要なパターンとベストプラクティス

### 8.1 デバウンス(Debounce)

ユーザーの入力が止まるまで処理を遅延させるパターン:

**場所**: [frontend/src/components/FilterPanel.tsx](frontend/src/components/FilterPanel.tsx)

```tsx
function SearchInput({ onSearch }) {
  const [inputValue, setInputValue] = useState('');

  useEffect(() => {
    // 500ms 後に検索を実行
    const timer = setTimeout(() => {
      onSearch(inputValue);
    }, 500);

    // クリーンアップ: 次の入力があったらタイマーをキャンセル
    return () => clearTimeout(timer);
  }, [inputValue, onSearch]);

  return (
    <input
      type="text"
      value={inputValue}
      onChange={e => setInputValue(e.target.value)}
      placeholder="検索..."
    />
  );
}
```

**メリット**:
- API リクエストの回数を削減
- サーバー負荷の軽減
- ユーザー体験の向上(入力中に何度もローディング表示されない)

### 8.2 条件付きレンダリング

```tsx
function ThreadList() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['threads'],
    queryFn: threadsApi.getThreads,
  });

  // パターン1: 早期リターン
  if (isLoading) return <LoadingSpinner />;
  if (error) return <ErrorMessage error={error} />;
  if (!data || data.items.length === 0) return <EmptyState />;

  // パターン2: 三項演算子
  return (
    <div>
      {data.items.length > 0 ? (
        <ul>
          {data.items.map(thread => <ThreadItem key={thread.id} thread={thread} />)}
        </ul>
      ) : (
        <p>スレッドがありません</p>
      )}
    </div>
  );

  // パターン3: 論理 AND 演算子
  return (
    <div>
      {isLoading && <LoadingSpinner />}
      {error && <ErrorMessage error={error} />}
      {data && <ThreadList threads={data.items} />}
    </div>
  );
}
```

### 8.3 リストレンダリングと key 属性

```tsx
function ThreadList({ threads }) {
  return (
    <ul>
      {threads.map(thread => (
        // key は必須: React が要素を識別するために使用
        <li key={thread.id}>
          <h3>{thread.title}</h3>
          <p>{thread.description}</p>
        </li>
      ))}
    </ul>
  );
}
```

**重要**:
- `key` は兄弟要素間で一意である必要がある
- インデックスを key にするのは避ける(並び順が変わると問題が起きる)
- `key` は変更されるべきではない(常に同じID)

### 8.4 フォーム処理

```tsx
function ThreadEditForm({ thread, onSave }) {
  const [formData, setFormData] = useState({
    title: thread.title,
    description: thread.description,
    tags: thread.tags || [],
  });

  const handleChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault(); // デフォルトのフォーム送信を防ぐ
    onSave(formData);
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="text"
        value={formData.title}
        onChange={e => handleChange('title', e.target.value)}
        required
      />

      <textarea
        value={formData.description}
        onChange={e => handleChange('description', e.target.value)}
      />

      <button type="submit">保存</button>
    </form>
  );
}
```

### 8.5 モーダルパターン

```tsx
interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

function Modal({ isOpen, onClose, children }: ModalProps) {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>×</button>
        {children}
      </div>
    </div>
  );
}

// 使用例
function App() {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <div>
      <button onClick={() => setIsModalOpen(true)}>開く</button>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)}>
        <h2>モーダルタイトル</h2>
        <p>コンテンツ</p>
      </Modal>
    </div>
  );
}
```

### 8.6 エラーハンドリング

```tsx
function ThreadDetailPage() {
  const { threadId } = useParams();
  const { data, error, isLoading } = useQuery({
    queryKey: ['thread', threadId],
    queryFn: () => threadsApi.getThread(threadId!),
  });

  const deleteMutation = useMutation({
    mutationFn: () => threadsApi.deleteThread(threadId!),
    onError: (error) => {
      // エラー時の処理
      if (error.response?.status === 404) {
        alert('スレッドが見つかりません');
      } else if (error.response?.status === 403) {
        alert('削除する権限がありません');
      } else {
        alert(`エラーが発生しました: ${error.message}`);
      }
    },
    onSuccess: () => {
      alert('削除しました');
      navigate('/');
    },
  });

  if (error) {
    return (
      <div className="error-container">
        <h2>エラーが発生しました</h2>
        <p>{error.message}</p>
        <button onClick={() => navigate('/')}>ホームに戻る</button>
      </div>
    );
  }

  // 正常時の表示
  return <div>{/* ... */}</div>;
}
```

### 8.7 TypeScript の型安全性

**型定義**: [frontend/src/types/index.ts](frontend/src/types/index.ts)

```tsx
// 型定義
export interface Thread {
  id: string;
  title: string;
  description: string | null;
  created_at: string;
  updated_at: string;
  is_read: boolean;
  is_archived: boolean;
  tags: Tag[];
}

export interface ThreadCreate {
  title: string;
  description?: string;
  tag_ids?: string[];
}

export interface ThreadUpdate {
  title?: string;
  description?: string;
  tag_ids?: string[];
}

// コンポーネントでの使用
function ThreadCard({ thread }: { thread: Thread }) {
  // thread.id, thread.title などが型チェックされる
  return (
    <div className="thread-card">
      <h3>{thread.title}</h3>
      {thread.description && <p>{thread.description}</p>}
    </div>
  );
}

// API 関数での使用
async function createThread(data: ThreadCreate): Promise<Thread> {
  const response = await api.post('/threads', data);
  return response.data;
}
```

**メリット**:
- エディタの自動補完
- タイポの防止
- リファクタリングの安全性

---

## 9. 実装例とチュートリアル

### 9.1 簡単な機能追加: お気に入りボタン

**目標**: スレッドにお気に入り機能を追加する

#### ステップ 1: 型定義を追加

**ファイル**: [frontend/src/types/index.ts](frontend/src/types/index.ts)

```tsx
export interface Thread {
  // ... 既存のフィールド
  is_favorited: boolean; // 追加
}
```

#### ステップ 2: API 関数を追加

**ファイル**: [frontend/src/lib/api.ts](frontend/src/lib/api.ts)

```tsx
export const threadsApi = {
  // ... 既存のメソッド

  toggleFavorite: async (threadId: string) => {
    const response = await api.post(`/threads/${threadId}/toggle-favorite`);
    return response.data;
  },
};
```

#### ステップ 3: コンポーネントを実装

**ファイル**: [frontend/src/components/FavoriteButton.tsx](frontend/src/components/FavoriteButton.tsx)

```tsx
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { threadsApi } from '../lib/api';
import { FaStar, FaRegStar } from 'react-icons/fa';

interface FavoriteButtonProps {
  threadId: string;
  isFavorited: boolean;
}

function FavoriteButton({ threadId, isFavorited }: FavoriteButtonProps) {
  const queryClient = useQueryClient();

  const favoriteMutation = useMutation({
    mutationFn: () => threadsApi.toggleFavorite(threadId),
    onMutate: async () => {
      // 楽観的更新
      await queryClient.cancelQueries({ queryKey: ['threads'] });
      const previousData = queryClient.getQueryData(['threads']);

      queryClient.setQueryData(['threads'], (old: any) => ({
        ...old,
        items: old.items.map((thread: Thread) =>
          thread.id === threadId
            ? { ...thread, is_favorited: !thread.is_favorited }
            : thread
        ),
      }));

      return { previousData };
    },
    onError: (err, variables, context) => {
      // エラー時はロールバック
      queryClient.setQueryData(['threads'], context?.previousData);
      alert('お気に入りの更新に失敗しました');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['threads'] });
    },
  });

  return (
    <button
      onClick={() => favoriteMutation.mutate()}
      className="favorite-button"
      disabled={favoriteMutation.isPending}
    >
      {isFavorited ? <FaStar color="gold" /> : <FaRegStar />}
    </button>
  );
}

export default FavoriteButton;
```

**CSS ファイル**: [frontend/src/components/FavoriteButton.css](frontend/src/components/FavoriteButton.css)

```css
.favorite-button {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 1.2rem;
  padding: 0.5rem;
  transition: transform 0.2s;
}

.favorite-button:hover {
  transform: scale(1.2);
}

.favorite-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
```

#### ステップ 4: 既存のコンポーネントに組み込む

**ファイル**: [frontend/src/pages/ThreadListPage.tsx](frontend/src/pages/ThreadListPage.tsx)

```tsx
import FavoriteButton from '../components/FavoriteButton';

function ThreadListPage() {
  // ... 既存のコード

  return (
    <div className="thread-list">
      {data?.items.map(thread => (
        <div key={thread.id} className="thread-card">
          <h3>{thread.title}</h3>
          <FavoriteButton
            threadId={thread.id}
            isFavorited={thread.is_favorited}
          />
        </div>
      ))}
    </div>
  );
}
```

### 9.2 中級チュートリアル: フィルタ機能の拡張

**目標**: お気に入りのみを表示するフィルタを追加

#### ステップ 1: フィルタの State を拡張

```tsx
const [filters, setFilters] = useState({
  search: '',
  dateFrom: '',
  dateTo: '',
  tags: [],
  showFavoritesOnly: false, // 追加
});
```

#### ステップ 2: API パラメータに追加

```tsx
const { data } = useQuery({
  queryKey: ['threads', filters],
  queryFn: () => threadsApi.getThreads({
    search: filters.search,
    date_from: filters.dateFrom,
    date_to: filters.dateTo,
    tag_ids: filters.tags,
    favorites_only: filters.showFavoritesOnly, // 追加
  }),
});
```

#### ステップ 3: UI に追加

```tsx
<div className="filter-panel">
  <label>
    <input
      type="checkbox"
      checked={filters.showFavoritesOnly}
      onChange={e => setFilters({
        ...filters,
        showFavoritesOnly: e.target.checked
      })}
    />
    お気に入りのみ表示
  </label>
</div>
```

---

## 10. よくあるエラーと解決方法

### 10.1 `Cannot read property 'map' of undefined`

**原因**: データがまだ取得されていない状態で map を実行

**解決方法**:

```tsx
// 悪い例
function ThreadList() {
  const { data } = useQuery({ queryKey: ['threads'], queryFn: getThreads });
  return data.items.map(thread => <div key={thread.id}>{thread.title}</div>);
}

// 良い例
function ThreadList() {
  const { data, isLoading } = useQuery({ queryKey: ['threads'], queryFn: getThreads });

  if (isLoading) return <div>読み込み中...</div>;
  if (!data) return null;

  return data.items.map(thread => <div key={thread.id}>{thread.title}</div>);
}
```

### 10.2 `Each child in a list should have a unique "key" prop`

**原因**: map でリストをレンダリングする際に key を指定していない

**解決方法**:

```tsx
// 悪い例
{threads.map(thread => <div>{thread.title}</div>)}

// 良い例
{threads.map(thread => <div key={thread.id}>{thread.title}</div>)}
```

### 10.3 `Too many re-renders`

**原因**: 無限ループが発生している(useEffect の依存配列が不適切など)

**解決方法**:

```tsx
// 悪い例: 無限ループ
function Component() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    setCount(count + 1); // count が更新 → useEffect 再実行 → 無限ループ
  });

  return <div>{count}</div>;
}

// 良い例: 依存配列を指定
function Component() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    // 初回のみ実行
    setCount(1);
  }, []); // 空の依存配列

  return <div>{count}</div>;
}
```

### 10.4 `Cannot update a component while rendering a different component`

**原因**: レンダリング中に State を更新しようとしている

**解決方法**:

```tsx
// 悪い例
function Component() {
  const [count, setCount] = useState(0);

  if (count === 0) {
    setCount(1); // レンダリング中に State 更新 → エラー
  }

  return <div>{count}</div>;
}

// 良い例: useEffect を使う
function Component() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (count === 0) {
      setCount(1);
    }
  }, [count]);

  return <div>{count}</div>;
}
```

### 10.5 TypeScript エラー: `Object is possibly 'undefined'`

**原因**: 値が undefined の可能性がある

**解決方法**:

```tsx
// 悪い例
const { threadId } = useParams();
const { data } = useQuery({
  queryKey: ['thread', threadId],
  queryFn: () => threadsApi.getThread(threadId), // エラー: threadId が undefined かも
});

// 良い例 1: Non-null assertion (確実に存在する場合)
queryFn: () => threadsApi.getThread(threadId!)

// 良い例 2: 条件チェック
queryFn: () => {
  if (!threadId) throw new Error('Thread ID is required');
  return threadsApi.getThread(threadId);
}

// 良い例 3: Optional chaining
const title = data?.thread?.title || 'タイトルなし';
```

### 10.6 環境変数が読み込まれない

**原因**: 環境変数名が `VITE_` で始まっていない、または `.env` の配置場所が間違っている

**解決方法**:

```bash
# 悪い例
API_BASE_URL=http://localhost:8000

# 良い例
VITE_API_BASE_URL=http://localhost:8000
```

**確認ポイント**:
1. `.env` ファイルは `frontend/` ディレクトリ直下に配置
2. 環境変数名は `VITE_` で始める
3. 開発サーバーを再起動する(環境変数の変更は再起動が必要)

### 10.7 CORS エラー

**エラーメッセージ**: `Access to fetch at 'http://localhost:8000/threads' from origin 'http://localhost:5173' has been blocked by CORS policy`

**原因**: バックエンドが CORS を許可していない

**解決方法** (バックエンド側):

```python
# backend/main.py
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

---

## 補足: 学習リソース

### 公式ドキュメント

1. **React 公式**: https://react.dev/
2. **React Router**: https://reactrouter.com/
3. **TanStack Query**: https://tanstack.com/query/latest
4. **TypeScript**: https://www.typescriptlang.org/docs/
5. **Vite**: https://vitejs.dev/

### 推奨学習パス

1. **React の基礎** (1-2週間)
   - コンポーネント、JSX
   - Props と State
   - イベントハンドリング
   - 条件付きレンダリング、リスト

2. **React Hooks** (1週間)
   - useState
   - useEffect
   - カスタムフック

3. **TypeScript 入門** (1週間)
   - 基本的な型
   - Interface と Type
   - ジェネリクス

4. **ルーティングと状態管理** (1-2週間)
   - React Router
   - React Query

5. **実践** (継続的)
   - このプロジェクトのコードを読む
   - 小さな機能を追加してみる
   - バグ修正に挑戦する

### デバッグツール

1. **React Developer Tools** (ブラウザ拡張)
   - コンポーネントツリーの確認
   - Props と State の監視

2. **TanStack Query DevTools**
   ```tsx
   import { ReactQueryDevtools } from '@tanstack/react-query-devtools';

   <QueryClientProvider client={queryClient}>
     <App />
     <ReactQueryDevtools initialIsOpen={false} />
   </QueryClientProvider>
   ```

3. **ブラウザの開発者ツール**
   - Console: エラーとログ
   - Network: API リクエストの確認
   - Elements: DOM の確認

---

## まとめ

このドキュメントでは、以下を学びました:

1. **React の基礎**: コンポーネント、JSX、State、Effect
2. **プロジェクト構成**: ディレクトリ構造と設計原則
3. **状態管理**: React Query と useState の使い分け
4. **ルーティング**: React Router でのページ遷移
5. **API 通信**: Axios を使った通信パターン
6. **実装パターン**: デバウンス、モーダル、フォーム処理
7. **エラー対処**: よくあるエラーと解決方法

### 次のステップ

1. **コードを読む**: 実際のコンポーネントを開いて理解を深める
2. **小さな変更**: UI の文言変更やスタイル調整から始める
3. **機能追加**: お気に入り機能など簡単な機能を追加
4. **バグ修正**: Issue から簡単なバグを選んで修正
5. **質問**: わからないことは遠慮なく聞く

React は最初は難しく感じるかもしれませんが、実際にコードを書いて動かすことで理解が深まります。このドキュメントを参照しながら、少しずつ実装に挑戦してみてください!
