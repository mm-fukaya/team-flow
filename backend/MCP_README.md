# Git Status MCP Server

このMCPサーバーは、GitHub組織のメンバー活動データを自然言語で検索・分析できるツールを提供します。

## 機能

### 利用可能なツール

1. **query_member_activities** - 自然言語でメンバー活動を検索
   - 例: "mm-kadoの活動を表示して"
   - 例: "最も活動したメンバー上位5人"

2. **get_member_activities** - 指定したメンバーの活動データを取得
   - パラメータ: memberLogin, organization（オプション）

3. **get_organization_stats** - 組織の統計情報を取得
   - パラメータ: organization（オプション）

4. **get_top_contributors** - トップコントリビューターを取得
   - パラメータ: activityType, limit, organization（オプション）

### 利用可能なリソース

1. **git-status://activities/all** - 全メンバーの活動データ
2. **git-status://activities/macromill** - Macromill組織の活動データ
3. **git-status://activities/macromill-mint** - Macromill Mint組織の活動データ
4. **git-status://stats/organizations** - 組織別統計情報

## ChatGPTでの使用方法

### 1. MCPサーバーの起動

```bash
cd backend
npm run build
npm start
```

### 2. ChatGPTでの設定

ChatGPTでMCPサーバーを使用するには、以下の設定が必要です：

#### 方法1: ChatGPT Plus（MCP対応版）
1. ChatGPT Plusにログイン
2. 設定でMCPサーバーを追加
3. サーバーURL: `http://localhost:3001/mcp`
4. サーバー名: `git-status-server`

#### 方法2: ローカルMCPクライアント
1. MCPクライアント（例: Claude Desktop）をインストール
2. 設定ファイルに以下を追加：

```json
{
  "mcpServers": {
    "git-status-server": {
      "command": "node",
      "args": ["dist/index.js"],
      "env": {
        "PORT": "3001",
        "GITHUB_TOKEN": "your-github-token"
      }
    }
  }
}
```

### 3. 使用例

ChatGPTで以下のような質問ができます：

```
- "mm-kadoの活動を表示して"
- "最も活動したメンバー上位10人を教えて"
- "Macromill組織の統計情報を取得して"
- "issueを最も作成したメンバーは誰？"
- "pull requestのレビューを最も行ったメンバーは？"
```

## API エンドポイント

### MCPプロトコル準拠エンドポイント

- `POST /mcp` - 統合MCPエンドポイント
- `GET /mcp/server/info` - サーバー情報
- `GET /mcp/tools/list` - ツール一覧
- `POST /mcp/tools/call` - ツール実行
- `GET /mcp/resources/list` - リソース一覧
- `POST /mcp/resources/read` - リソース読み取り

### 従来のREST API

- `POST /api/query` - 自然言語クエリ
- `GET /api/activities` - 全活動データ
- `GET /api/members` - メンバー一覧

## 環境変数

- `GITHUB_TOKEN` - GitHub Personal Access Token
- `PORT` - サーバーポート（デフォルト: 3001）

## データ形式

### メンバー活動データ

```json
{
  "login": "mm-kado",
  "name": "Kado Masaki",
  "organization": "macromill",
  "organizationDisplayName": "Macromill",
  "activities": {
    "2024-01": {
      "issues": 5,
      "pullRequests": 3,
      "commits": 12,
      "reviews": 8
    }
  }
}
```

### 統計情報

```json
{
  "memberCount": 25,
  "totalIssues": 150,
  "totalPRs": 80,
  "totalCommits": 300,
  "totalReviews": 120,
  "totalActivities": 650,
  "averageIssues": 6.0,
  "averagePRs": 3.2,
  "averageCommits": 12.0,
  "averageReviews": 4.8
}
```

## トラブルシューティング

### よくある問題

1. **GitHub Token エラー**
   - GitHub Personal Access Tokenが正しく設定されているか確認
   - Tokenに適切な権限（repo, read:org）があるか確認

2. **データが見つからない**
   - 先にデータ取得APIを実行してデータを準備
   - 組織名が正しいか確認（macromill, macromill-mint）

3. **MCP接続エラー**
   - サーバーが起動しているか確認
   - ポート3001が利用可能か確認
   - ファイアウォール設定を確認

### ログ確認

```bash
# サーバーログを確認
tail -f backend/logs/server.log

# エラーログを確認
tail -f backend/logs/error.log
```

## 開発者向け情報

### アーキテクチャ

- **MCPサーバー**: `src/mcpServer.ts`
- **データサービス**: `src/services/dataService.ts`
- **自然言語クエリ**: `src/services/naturalLanguageQueryService.ts`
- **GitHub API**: `src/services/githubService.ts`

### 拡張方法

1. 新しいツールを追加: `mcpServer.ts`の`getTools()`メソッドを編集
2. 新しいリソースを追加: `mcpServer.ts`の`getResources()`メソッドを編集
3. 自然言語クエリを拡張: `naturalLanguageQueryService.ts`を編集

### テスト

```bash
# 単体テスト
npm test

# MCPサーバーテスト
curl -X POST http://localhost:3001/mcp/tools/call \
  -H "Content-Type: application/json" \
  -d '{"name": "query_member_activities", "arguments": {"query": "mm-kadoの活動を表示して"}}'
``` 