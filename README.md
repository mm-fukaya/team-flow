# Git Status - GitHub活動データ表示アプリ

GitHubからメンバーごとの活動データ（イシュー作成数、プルリク作成数、コミット数、レビュー数）を取得して表示するWebアプリケーションです。

## 機能

- 期間を選択してデータを取得（最大1年）
- 月単位での棒グラフ表示
- メンバーをドロップダウンで選択（検索機能付き）
- データのローカル保存
- 複数組織の設定対応

## 技術スタック

### フロントエンド
- React 18
- TypeScript
- Chart.js + react-chartjs-2
- Tailwind CSS
- Axios

### バックエンド
- Node.js
- Express
- TypeScript
- GitHub REST API v3

## セットアップ

### 1. 依存関係のインストール

```bash
npm run install-all
```

### 2. 環境変数の設定

バックエンドディレクトリに`.env`ファイルを作成：

```bash
cd backend
cp env.example .env
```

`.env`ファイルを編集してGitHubトークンを設定：

```
GITHUB_TOKEN=your_github_personal_access_token_here
PORT=3001
```

### 3. GitHubトークンの取得

1. GitHubにログイン
2. Settings > Developer settings > Personal access tokens > Tokens (classic)
3. "Generate new token"をクリック
4. 以下の権限を付与：
   - `repo` (プライベートリポジトリにアクセスする場合)
   - `read:org` (組織のメンバー情報を取得)
   - `read:user` (ユーザー情報を取得)

### 4. 組織の設定

`config/organizations.json`を編集して対象のGitHub組織を設定：

```json
{
  "organizations": [
    {
      "name": "your-org-name",
      "displayName": "Your Organization Display Name"
    }
  ]
}
```

### 5. アプリケーションの起動

```bash
npm run dev
```

フロントエンド: http://localhost:3000
バックエンド: http://localhost:3001

## 使用方法

1. 組織を選択
2. 開始日と終了日を設定（最大1年）
3. 「データ取得」ボタンをクリックしてGitHubからデータを取得
4. メンバーを選択して活動データを表示

## データの保存

取得したデータは`backend/data/member-activities.json`に保存され、次回以降はローカルデータを使用します。

## 注意事項

- GitHub APIのレート制限に注意してください
- 大量のデータを取得する場合は時間がかかる場合があります
- プライベートリポジトリにアクセスする場合は、適切な権限を持つGitHubトークンが必要です 