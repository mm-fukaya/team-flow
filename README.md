# GitStatus - GitHub Organization Activity Tracker

GitHub組織のメンバー活動を追跡・分析するWebアプリケーションです。

## 主な機能

### 1. 月毎データ取得機能（新機能）
- **月単位でのデータ取得**: 指定した月のデータを一括取得
- **月毎ファイル保存**: 各月のデータを個別のJSONファイルに保存
- **取得済み月の表示**: UIで取得済みの月と最終取得日時を表示
- **期間指定表示**: 開始月と終了月を指定してデータを表示
- **再取得確認**: 既に取得済みの月を再取得する際の確認ダイアログ

### 2. 週単位データ取得機能（従来機能）
- **週単位でのデータ取得**: 指定した週のデータを取得
- **週毎ファイル保存**: 各週のデータを個別のJSONファイルに保存
- **取得済み週の表示**: UIで取得済みの週と最終取得日時を表示

### 3. メンバー活動サマリー
- **全メンバーの活動一覧**: イシュー、PR、コミット、レビューの集計
- **月別フィルタリング**: 特定の月のデータのみを表示
- **組織横断統合**: 複数組織のメンバーデータを統合表示
- **活動グラフ**: 各メンバーの活動をカラーコード付きバーグラフで表示

### 4. データ管理
- **テストモード**: 最新3リポジトリのみ、各リポジトリから10件ずつ取得
- **レート制限対応**: GitHub APIのレート制限を考慮した取得
- **データ削除**: 不要なデータの削除機能

## 使用方法

### 月毎データ取得
1. **月を選択**: 「取得する月」フィールドで月を選択
2. **データ取得**: 「月毎データ取得（全組織）」ボタンをクリック
3. **確認ダイアログ**: 既に取得済みの場合は確認ダイアログが表示
4. **表示期間設定**: 開始月と終了月を指定して「期間データ読み込み」をクリック

### 週単位データ取得（従来機能）
1. **期間設定**: 開始日と終了日を指定
2. **データ取得**: 「週単位データ取得（全組織）」ボタンをクリック

### メンバー活動サマリー表示
1. **期間設定**: 表示したい月の範囲を指定
2. **サマリー表示**: 「メンバー活動サマリーを表示」ボタンをクリック
3. **データ確認**: 各メンバーの活動をグラフで確認

## API エンドポイント

### 月毎データ関連
- `GET /api/monthly-data/:orgName` - 組織の月毎データ一覧取得
- `POST /api/fetch-monthly-data` - 月毎データ取得・保存
- `DELETE /api/monthly-data/:orgName/:monthStart` - 月毎データ削除
- `GET /api/monthly-activities` - 指定期間の月毎データ統合取得

### 週単位データ関連
- `GET /api/weekly-data/:orgName` - 組織の週単位データ一覧取得
- `POST /api/fetch-weekly-data` - 週単位データ取得・保存
- `DELETE /api/weekly-data/:orgName/:weekStart` - 週単位データ削除
- `GET /api/weekly-activities` - 指定期間の週単位データ統合取得

### 従来のエンドポイント
- `GET /api/activities` - 全組織の活動データ取得
- `GET /api/organizations` - 組織一覧取得
- `POST /api/fetch` - 全組織のデータ取得

## データファイル構造

### 月毎データファイル (`{orgName}-monthly-activities.json`)
```json
{
  "organization": "macromill",
  "months": {
    "2025-06": {
      "monthKey": "2025-06",
      "monthStart": "2025-06-01",
      "monthEnd": "2025-06-30",
      "lastUpdated": "2025-07-19T23:04:30.719Z",
      "activities": [...]
    }
  },
  "lastUpdated": "2025-07-19T23:04:30.719Z"
}
```

### 週単位データファイル (`{orgName}-weekly-activities.json`)
```json
{
  "organization": "macromill",
  "weeks": {
    "2025-W25": {
      "weekKey": "2025-W25",
      "weekStart": "2025-06-16",
      "weekEnd": "2025-06-22",
      "lastUpdated": "2025-07-19T23:04:30.719Z",
      "activities": [...]
    }
  },
  "lastUpdated": "2025-07-19T23:04:30.719Z"
}
```

## セットアップ

### 前提条件
- Node.js (v16以上)
- npm または yarn
- GitHub Personal Access Token

### インストール
1. リポジトリをクローン
```bash
git clone <repository-url>
cd GitStatus
```

2. 依存関係をインストール
```bash
# バックエンド
cd backend
npm install

# フロントエンド
cd ../frontend
npm install
```

3. 環境変数を設定
```bash
# backend/.env
GITHUB_TOKEN=your_github_token_here
```

4. アプリケーションを起動
```bash
# バックエンド（ポート3001）
cd backend
npm start

# フロントエンド（ポート3000）
cd frontend
npm start
```

## 設定ファイル

### `config/organizations.json`
```json
{
  "organizations": [
    {
      "name": "macromill",
      "displayName": "macromill"
    },
    {
      "name": "macromill-mint",
      "displayName": "macromill-mint"
    }
  ]
}
```

## 技術スタック

### バックエンド
- **Node.js** + **TypeScript**
- **Express.js** - Webフレームワーク
- **Octokit** - GitHub API クライアント
- **Moment.js** - 日付処理

### フロントエンド
- **React** + **TypeScript**
- **Tailwind CSS** - スタイリング
- **Axios** - HTTP クライアント
- **Moment.js** - 日付処理

## 注意事項

1. **GitHub API レート制限**: 認証済みリクエストで5,000リクエスト/時間
2. **テストモード**: 開発・テスト時はテストモードを使用してAPI使用量を削減
3. **データ保存**: 取得したデータは `backend/data/` ディレクトリに保存
4. **エラーハンドリング**: API エラーやネットワークエラーに対する適切な処理を実装

## トラブルシューティング

### よくある問題
1. **レート制限エラー**: テストモードを使用するか、しばらく待ってから再試行
2. **データが取得できない**: GitHub Tokenの権限を確認
3. **フロントエンドエラー**: バックエンドサーバーが起動しているか確認

### ログ確認
- バックエンドのコンソールログで詳細なエラー情報を確認
- ブラウザの開発者ツールでネットワークエラーを確認 