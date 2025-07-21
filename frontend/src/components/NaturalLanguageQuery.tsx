import React, { useState } from 'react';
import { api } from '../services/api';

interface QueryResult {
  type: 'data' | 'analysis' | 'summary' | 'comparison' | 'trend';
  data: any;
  message: string;
  query: string;
  filters?: {
    members?: string[];
    organizations?: string[];
    dateRange?: { start: string; end: string };
    activityTypes?: string[];
  };
}

interface NaturalLanguageQueryProps {
  onQueryResult?: (result: QueryResult) => void;
}

export const NaturalLanguageQuery: React.FC<NaturalLanguageQueryProps> = ({ onQueryResult }) => {
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<QueryResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // サンプルクエリ
  const sampleQueries = [
    'mm-kadoの活動を表示して',
    '最も活動したメンバー上位5人',
    'macromillとmacromill-mintを比較して',
    'mm-kadoとmm-rayyanの活動を比較して',
    '活動を分析して',
    'イシュー数が多いメンバー上位10人',
    'コミット数でソートして',
    '今月の活動を表示して',
    'レビュー数が100個以上のメンバー'
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await api.processNaturalLanguageQuery(query.trim());
      setResult(response);
      if (onQueryResult) {
        onQueryResult(response);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'クエリの処理中にエラーが発生しました');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSampleQuery = (sampleQuery: string) => {
    setQuery(sampleQuery);
  };

  const renderDataTable = (data: any[]) => {
    if (!data || data.length === 0) {
      return <p className="text-gray-500">データが見つかりませんでした。</p>;
    }

    const columns = Object.keys(data[0]).filter(key => 
      key !== 'avatar_url' && key !== 'organizationDisplayName'
    );

    return (
      <div className="overflow-x-auto">
        <table className="min-w-full bg-white border border-gray-300">
          <thead>
            <tr className="bg-gray-50">
              {columns.map(column => (
                <th key={column} className="px-4 py-2 text-left text-sm font-medium text-gray-700 border-b">
                  {column === 'login' ? 'ログイン' :
                   column === 'name' ? '名前' :
                   column === 'organization' ? '組織' :
                   column === 'issues' ? 'イシュー' :
                   column === 'pullRequests' ? 'プルリク' :
                   column === 'commits' ? 'コミット' :
                   column === 'reviews' ? 'レビュー' :
                   column === 'total' ? '合計' :
                   column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row, index) => (
              <tr key={index} className="hover:bg-gray-50">
                {columns.map(column => (
                  <td key={column} className="px-4 py-2 text-sm border-b">
                    {column === 'organization' ? 
                      (row[column] === 'macromill' ? 'Macromill' : 
                       row[column] === 'macromill-mint' ? 'Macromill Mint' : 
                       row[column]) :
                      row[column]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const renderAnalysisData = (data: any) => {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-blue-50 p-4 rounded-lg">
          <h4 className="font-semibold text-blue-800">メンバー数</h4>
          <p className="text-2xl font-bold text-blue-600">{data.totalMembers}</p>
        </div>
        <div className="bg-green-50 p-4 rounded-lg">
          <h4 className="font-semibold text-green-800">イシュー総数</h4>
          <p className="text-2xl font-bold text-green-600">{data.totalIssues}</p>
        </div>
        <div className="bg-purple-50 p-4 rounded-lg">
          <h4 className="font-semibold text-purple-800">プルリク総数</h4>
          <p className="text-2xl font-bold text-purple-600">{data.totalPRs}</p>
        </div>
        <div className="bg-orange-50 p-4 rounded-lg">
          <h4 className="font-semibold text-orange-800">コミット総数</h4>
          <p className="text-2xl font-bold text-orange-600">{data.totalCommits}</p>
        </div>
        <div className="bg-red-50 p-4 rounded-lg">
          <h4 className="font-semibold text-red-800">レビュー総数</h4>
          <p className="text-2xl font-bold text-red-600">{data.totalReviews}</p>
        </div>
        <div className="bg-indigo-50 p-4 rounded-lg">
          <h4 className="font-semibold text-indigo-800">平均イシュー</h4>
          <p className="text-2xl font-bold text-indigo-600">{data.averageIssues.toFixed(1)}</p>
        </div>
        <div className="bg-pink-50 p-4 rounded-lg">
          <h4 className="font-semibold text-pink-800">平均プルリク</h4>
          <p className="text-2xl font-bold text-pink-600">{data.averagePRs.toFixed(1)}</p>
        </div>
        <div className="bg-yellow-50 p-4 rounded-lg">
          <h4 className="font-semibold text-yellow-800">平均コミット</h4>
          <p className="text-2xl font-bold text-yellow-600">{data.averageCommits.toFixed(1)}</p>
        </div>
      </div>
    );
  };

  const renderComparisonData = (data: any) => {
    // 新しいデータ構造に対応
    const comparison = data.comparison || data;
    const summary = data.summary;
    const insights = data.insights;

    // メンバー比較か組織比較かを判定
    const isMemberComparison = Array.isArray(comparison) && comparison.length > 0 && comparison[0].member;

    return (
      <div className="space-y-6">
        {/* 比較結果 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {Array.isArray(comparison) && comparison.map((item, index) => (
            <div key={index} className="bg-white border border-gray-200 rounded-lg p-6">
              <h3 className="text-lg font-semibold mb-4">
                {isMemberComparison ? item.displayName : (item.organizationDisplayName || item.organization)}
              </h3>
              <div className="space-y-2">
                {isMemberComparison ? (
                  // メンバー比較の場合
                  <>
                    <div className="flex justify-between">
                      <span>組織:</span>
                      <span className="font-semibold">{item.organization}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>イシュー:</span>
                      <span className="font-semibold">{item.issues}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>プルリク:</span>
                      <span className="font-semibold">{item.pullRequests}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>コミット:</span>
                      <span className="font-semibold">{item.commits}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>レビュー:</span>
                      <span className="font-semibold">{item.reviews}</span>
                    </div>
                    <div className="flex justify-between border-t pt-2">
                      <span className="font-semibold">合計:</span>
                      <span className="font-bold text-lg">{item.total}</span>
                    </div>
                  </>
                ) : (
                  // 組織比較の場合
                  <>
                    <div className="flex justify-between">
                      <span>メンバー数:</span>
                      <span className="font-semibold">{item.memberCount}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>イシュー:</span>
                      <span className="font-semibold">{item.issues}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>プルリク:</span>
                      <span className="font-semibold">{item.pullRequests}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>コミット:</span>
                      <span className="font-semibold">{item.commits}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>レビュー:</span>
                      <span className="font-semibold">{item.reviews}</span>
                    </div>
                    <div className="flex justify-between border-t pt-2">
                      <span className="font-semibold">合計:</span>
                      <span className="font-bold text-lg">{item.total}</span>
                    </div>
                    {/* 平均値も表示 */}
                    <div className="border-t pt-2 mt-2">
                      <p className="text-sm text-gray-600 mb-1">1人あたりの平均:</p>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>イシュー: {item.averageIssues?.toFixed(1) || 'N/A'}</div>
                        <div>プルリク: {item.averagePRs?.toFixed(1) || 'N/A'}</div>
                        <div>コミット: {item.averageCommits?.toFixed(1) || 'N/A'}</div>
                        <div>レビュー: {item.averageReviews?.toFixed(1) || 'N/A'}</div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* サマリー情報 */}
        {summary && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="font-semibold text-blue-800 mb-3">全体サマリー</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-gray-600">組織数:</span>
                <span className="font-semibold ml-2">{summary.totalOrganizations}</span>
              </div>
              <div>
                <span className="text-gray-600">総メンバー数:</span>
                <span className="font-semibold ml-2">{summary.totalMembers}</span>
              </div>
              <div>
                <span className="text-gray-600">総活動数:</span>
                <span className="font-semibold ml-2">{summary.totalActivities}</span>
              </div>
              <div>
                <span className="text-gray-600">平均活動数:</span>
                <span className="font-semibold ml-2">
                  {summary.totalMembers > 0 ? (summary.totalActivities / summary.totalMembers).toFixed(1) : 'N/A'}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* インサイト */}
        {insights && insights.length > 0 && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <h4 className="font-semibold text-green-800 mb-3">分析結果</h4>
            <ul className="space-y-2">
              {insights.map((insight: string, index: number) => (
                <li key={index} className="text-sm text-green-700 flex items-start">
                  <span className="text-green-500 mr-2">•</span>
                  {insight}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  };

  const renderResult = () => {
    if (!result) return null;

    return (
      <div className="mt-6 bg-white border border-gray-200 rounded-lg p-6">
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-gray-800">クエリ結果</h3>
          <p className="text-sm text-gray-600 mt-1">"{result.query}"</p>
          <p className="text-sm text-gray-600 mt-1">{result.message}</p>
        </div>

        <div className="mt-4">
          {result.type === 'data' && Array.isArray(result.data) && renderDataTable(result.data)}
          {result.type === 'analysis' && renderAnalysisData(result.data)}
          {result.type === 'comparison' && renderComparisonData(result.data)}
          {result.type === 'summary' && (
            <div className="bg-gray-50 p-4 rounded-lg">
              <pre className="text-sm overflow-x-auto">{JSON.stringify(result.data, null, 2)}</pre>
            </div>
          )}
          {result.type === 'trend' && (
            <div className="bg-gray-50 p-4 rounded-lg">
              <pre className="text-sm overflow-x-auto">{JSON.stringify(result.data, null, 2)}</pre>
            </div>
          )}
        </div>

        {result.filters && (
          <div className="mt-4 p-3 bg-blue-50 rounded-lg">
            <h4 className="font-semibold text-blue-800 mb-2">適用されたフィルター</h4>
            <div className="text-sm text-blue-700">
              {result.filters.members && result.filters.members.length > 0 && (
                <p>メンバー: {result.filters.members.join(', ')}</p>
              )}
              {result.filters.organizations && result.filters.organizations.length > 0 && (
                <p>組織: {result.filters.organizations.join(', ')}</p>
              )}
              {result.filters.dateRange && (
                <p>期間: {result.filters.dateRange.start} 〜 {result.filters.dateRange.end}</p>
              )}
              {result.filters.activityTypes && result.filters.activityTypes.length > 0 && (
                <p>活動タイプ: {result.filters.activityTypes.join(', ')}</p>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-800 mb-2">自然言語クエリ</h2>
        <p className="text-gray-600">
          日本語で自然な文章でデータを検索できます。メンバー名、組織名、活動タイプなどを指定して検索してください。
        </p>
      </div>

      <form onSubmit={handleSubmit} className="mb-6">
        <div className="flex gap-2">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="例: mm-kadoの活動を表示して"
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={isLoading || !query.trim()}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {isLoading ? '検索中...' : '検索'}
          </button>
        </div>
      </form>

      {/* サンプルクエリ */}
      <div className="mb-6">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">サンプルクエリ</h3>
        <div className="flex flex-wrap gap-2">
          {sampleQueries.map((sampleQuery, index) => (
            <button
              key={index}
              onClick={() => handleSampleQuery(sampleQuery)}
              className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded-full hover:bg-gray-200 transition-colors"
            >
              {sampleQuery}
            </button>
          ))}
        </div>
      </div>

      {/* エラー表示 */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-800">{error}</p>
        </div>
      )}

      {/* 結果表示 */}
      {renderResult()}
    </div>
  );
}; 