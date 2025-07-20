# Git Status - GitHub活動データ管理システム

GitHub組織のメンバー活動データを取得・管理・可視化するシステムです。

## 機能

### 基本機能
- 組織メンバーの活動データ取得（イシュー、プルリクエスト、コミット、レビュー）
- 期間指定でのデータ取得
- テストモードでの動作確認
- 組織別統計表示

### 週単位データ管理機能
- 週単位でのデータ取得・保存・管理
- 取得済み週の一覧表示
- 週単位データの再取得・削除機能
- 既に取得済みの週を再取得する際の確認ダイアログ
- 週単位データの統合表示

### 全メンバー活動サマリー
- 全メンバーの活動を一目で比較できる棒グラフテーブル
- 月単位での期間選択機能
- イシュー作成数、プルリク作成数、コミット数、レビュー数を色分け表示
- 合計値でのソート（降順）
- メンバーアバターと名前の表示
- 組織をまたいだメンバー統合表示

### データ可視化
- 個別メンバーの活動チャート
- 組織別詳細情報
- リアルタイム統計表示

## 技術スタック

### バックエンド
- Node.js + TypeScript
- Express.js
- GitHub API (GraphQL + REST)
- moment.js

### フロントエンド
- React + TypeScript
- Tailwind CSS
- moment.js

## セットアップ

### 前提条件
- Node.js (v16以上)
- npm
- GitHub Personal Access Token

### インストール

1. リポジトリをクローン
```bash
git clone <repository-url>
cd GitStatus
```

2. 依存関係をインストール
```bash
npm install
cd backend && npm install
cd ../frontend && npm install
```

3. 環境変数を設定
```bash
cp backend/env.example backend/.env
# .envファイルを編集してGitHubトークンを設定
```

4. アプリケーションを起動
```bash
# バックエンド
cd backend && npm start

# フロントエンド（別ターミナル）
cd frontend && npm start
```

## 使用方法

### データ取得
1. 開始日・終了日を設定
2. テストモードの確認
3. 「データ取得（全組織）」ボタンでデータを取得

### 週単位データ管理
1. 週の開始日を選択（自動で週の範囲が計算される）
2. 「週単位データ取得」ボタンで全組織の該当週データを取得
3. 取得済み週一覧で再取得・削除が可能

### 全メンバー活動サマリー
1. 「表示月を選択」で月を選択
2. 「メンバーテーブルを表示」ボタンでサマリーテーブルを表示
3. 全メンバーの活動を一目で比較

### 個別メンバー詳細
1. 「全組織メンバー選択」でメンバーを選択
2. 選択したメンバーの活動チャートを表示

## データ構造

### 週単位データ
- ファイル形式: `{orgName}-weekly-activities.json`
- 構造: 週キー（YYYY-WW）ごとの活動データ

### メンバー活動データ
- ファイル形式: `{orgName}-activities.json`
- 構造: メンバーごとの月別活動データ

## API エンドポイント

### 週単位データ
- `GET /api/weekly-data/:orgName` - 組織の週単位データ取得
- `POST /api/fetch-weekly-data` - 週単位データ取得・保存
- `DELETE /api/weekly-data/:orgName/:weekStart` - 週単位データ削除
- `GET /api/weekly-activities` - 全組織の週単位データ統合取得

### 基本データ
- `GET /api/activities` - 全組織の活動データ取得
- `POST /api/fetch-all-organizations` - 全組織のデータ一括取得

## 設定

### 組織設定
`config/organizations.json`で対象組織を設定

```json
{
  "organizations": [
    {
      "name": "organization-name",
      "displayName": "Organization Display Name"
    }
  ]
}
```

## 注意事項

- GitHub APIのレート制限に注意
- 大量データ取得時は時間がかかる場合があります
- テストモードでは制限されたデータのみ取得されます

## ライセンス

MIT License 