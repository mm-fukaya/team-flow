# ChatGPTでGit Status MCPサーバーを使用する方法

## 概要

このガイドでは、ChatGPTでGit Status MCPサーバーを使用して、GitHub組織のメンバー活動データを自然言語で検索・分析する方法を説明します。

## 前提条件

1. **GitHub Personal Access Token**
   - GitHubでPersonal Access Tokenを作成
   - 必要な権限: `repo`, `read:org`
   - [GitHub Token作成方法](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/creating-a-personal-access-token)

2. **Node.js環境**
   - Node.js 16以上がインストール済み

3. **ChatGPT Plus**
   - MCP対応版のChatGPT Plusアカウント

## セットアップ手順

### 1. プロジェクトの準備

```bash
# プロジェクトディレクトリに移動
cd /Users/ma_fukaya/temp/Cursor/GitStatus

# 依存関係をインストール
cd backend
npm install

# 環境変数を設定
cp env.example .env
# .envファイルを編集してGitHub Tokenを設定
```

### 2. 環境変数の設定

`.env`ファイルを作成または編集：

```env
GITHUB_TOKEN=your_github_personal_access_token_here
PORT=3001
```

### 3. データの準備

```bash
# サーバーを起動
npm run build
npm start

# 別のターミナルでデータを取得（例：2024年1月のデータ）
curl -X POST http://localhost:3001/api/fetch-all-organizations \
  -H "Content-Type: application/json" \
  -d '{
    "startDate": "2024-01-01",
    "endDate": "2024-01-31"
  }'
```

### 4. MCPサーバーの動作確認

```bash
# サーバー情報を確認
curl http://localhost:3001/mcp/server/info

# 利用可能なツールを確認
curl http://localhost:3001/mcp/tools/list

# テストクエリを実行
curl -X POST http://localhost:3001/mcp/tools/call \
  -H "Content-Type: application/json" \
  -d '{
    "name": "query_member_activities",
    "arguments": {
      "query": "mm-kadoの活動を表示して"
    }
  }'
```

## ChatGPTでの設定

### 方法1: ChatGPT Plus（推奨）

1. **ChatGPT Plusにログイン**
   - [ChatGPT Plus](https://chat.openai.com/)にアクセス
   - MCP対応版を使用

2. **MCPサーバーを追加**
   - 設定画面で「MCP Servers」を選択
   - 「Add Server」をクリック

3. **サーバー設定**
   ```
   Server Name: git-status-server
   Server URL: http://localhost:3001/mcp
   ```

4. **接続テスト**
   - 設定完了後、ChatGPTで以下を試してください：
   ```
   "mm-kadoの活動を表示して"
   ```

### 方法2: ローカルMCPクライアント

1. **Claude Desktopをインストール**
   - [Claude Desktop](https://claude.ai/download)をダウンロード
   - インストールして起動

2. **設定ファイルを編集**
   - 設定ファイルに以下を追加：

```json
{
  "mcpServers": {
    "git-status-server": {
      "command": "node",
      "args": ["dist/index.js"],
      "env": {
        "PORT": "3001",
        "GITHUB_TOKEN": "your-github-token"
      },
      "cwd": "/Users/ma_fukaya/temp/Cursor/GitStatus/backend"
    }
  }
}
```

## 使用例

### 基本的な質問

```
- "mm-kadoの活動を表示して"
- "最も活動したメンバー上位10人を教えて"
- "Macromill組織の統計情報を取得して"
```

### 詳細な分析

```
- "issueを最も作成したメンバーは誰？"
- "pull requestのレビューを最も行ったメンバーは？"
- "commit数でトップ5のメンバーを表示して"
- "Macromill Mint組織で最も活躍しているメンバーは？"
```

### 比較分析

```
- "mm-kadoと他のメンバーの活動を比較して"
- "MacromillとMacromill Mintの活動を比較して"
- "issue作成数とPR作成数の相関を分析して"
```

## 利用可能なツール詳細

### 1. query_member_activities
**自然言語でメンバー活動を検索**

**パラメータ:**
- `query` (必須): 自然言語クエリ

**使用例:**
```json
{
  "name": "query_member_activities",
  "arguments": {
    "query": "mm-kadoの活動を表示して"
  }
}
```

### 2. get_member_activities
**指定したメンバーの活動データを取得**

**パラメータ:**
- `memberLogin` (必須): メンバーのログイン名
- `organization` (オプション): 組織名

**使用例:**
```json
{
  "name": "get_member_activities",
  "arguments": {
    "memberLogin": "mm-kado",
    "organization": "macromill"
  }
}
```

### 3. get_organization_stats
**組織の統計情報を取得**

**パラメータ:**
- `organization` (オプション): 組織名

**使用例:**
```json
{
  "name": "get_organization_stats",
  "arguments": {
    "organization": "macromill"
  }
}
```

### 4. get_top_contributors
**トップコントリビューターを取得**

**パラメータ:**
- `activityType` (必須): 活動タイプ（issues, pullRequests, commits, reviews, total）
- `limit` (オプション): 取得件数（デフォルト: 10）
- `organization` (オプション): 組織名

**使用例:**
```json
{
  "name": "get_top_contributors",
  "arguments": {
    "activityType": "issues",
    "limit": 5,
    "organization": "macromill"
  }
}
```

## 利用可能なリソース

### 1. git-status://activities/all
**全メンバーの活動データ（JSON形式）**

### 2. git-status://activities/macromill
**Macromill組織のメンバー活動データ**

### 3. git-status://activities/macromill-mint
**Macromill Mint組織のメンバー活動データ**

### 4. git-status://stats/organizations
**組織別統計情報**

## トラブルシューティング

### よくある問題と解決方法

#### 1. GitHub Token エラー
**症状:** "GitHub API rate limit exceeded" または "Unauthorized"

**解決方法:**
```bash
# GitHub Tokenを確認
echo $GITHUB_TOKEN

# .envファイルを確認
cat .env

# Tokenの権限を確認（GitHub設定画面で）
# 必要な権限: repo, read:org
```

#### 2. データが見つからない
**症状:** "データが見つかりませんでした"

**解決方法:**
```bash
# データを取得
curl -X POST http://localhost:3001/api/fetch-all-organizations \
  -H "Content-Type: application/json" \
  -d '{
    "startDate": "2024-01-01",
    "endDate": "2024-01-31"
  }'

# データの存在を確認
curl http://localhost:3001/api/activities
```

#### 3. MCP接続エラー
**症状:** "Connection refused" または "Server not found"

**解決方法:**
```bash
# サーバーが起動しているか確認
ps aux | grep node

# ポート3001が利用可能か確認
lsof -i :3001

# サーバーを再起動
npm start
```

#### 4. ChatGPTでMCPサーバーが認識されない
**症状:** ChatGPTでツールが利用できない

**解決方法:**
1. ChatGPT PlusのMCP対応版を使用しているか確認
2. サーバーURLが正しいか確認（`http://localhost:3001/mcp`）
3. ファイアウォール設定を確認
4. ブラウザのCORS設定を確認

### ログの確認

```bash
# サーバーログを確認
tail -f backend/logs/server.log

# エラーログを確認
tail -f backend/logs/error.log

# リアルタイムでログを確認
npm start 2>&1 | tee server.log
```

## 高度な使用方法

### カスタムクエリの作成

```bash
# 複雑なクエリをテスト
curl -X POST http://localhost:3001/mcp/tools/call \
  -H "Content-Type: application/json" \
  -d '{
    "name": "query_member_activities",
    "arguments": {
      "query": "Macromill組織でissueを最も作成したメンバー上位3人を表示して"
    }
  }'
```

### データの定期更新

```bash
# cronジョブでデータを定期更新
# crontab -e で以下を追加
0 2 * * 1 cd /Users/ma_fukaya/temp/Cursor/GitStatus/backend && npm run fetch-weekly-data
```

### パフォーマンス最適化

```bash
# データベースの最適化
npm run optimize-data

# キャッシュのクリア
npm run clear-cache
```

## セキュリティ考慮事項

1. **GitHub Tokenの管理**
   - Tokenを環境変数で管理
   - 不要な権限を削除
   - 定期的にTokenを更新

2. **ネットワークセキュリティ**
   - ローカルホストでのみアクセス可能
   - ファイアウォールでポート3001を保護

3. **データプライバシー**
   - 個人情報を含むデータの取り扱いに注意
   - 必要に応じてデータを匿名化

## サポート

問題が発生した場合は、以下を確認してください：

1. **ログファイル**の確認
2. **GitHub Token**の権限確認
3. **ネットワーク接続**の確認
4. **ChatGPT Plus**のMCP対応状況確認

詳細なドキュメントは `backend/MCP_README.md` を参照してください。 