import React, { useState, useMemo } from 'react';
import { MemberActivity } from '../types';
import moment from 'moment';

interface MemberActivityTableProps {
  activities: MemberActivity[];
  startDate: string;
  endDate: string;
}

type SortField = 'issues' | 'pullRequests' | 'commits' | 'reviews' | 'total';
type SortDirection = 'asc' | 'desc';

interface MemberSummary {
  login: string;
  name: string;
  avatar_url: string;
  totalIssues: number;
  totalPullRequests: number;
  totalCommits: number;
  totalReviews: number;
  monthlyData: { [yearMonth: string]: { issues: number; pullRequests: number; commits: number; reviews: number } };
}

interface PopupState {
  show: boolean;
  member: MemberSummary | null;
  x: number;
  y: number;
}

export const MemberActivityTable: React.FC<MemberActivityTableProps> = ({
  activities,
  startDate,
  endDate
}) => {
  const [sortField, setSortField] = useState<SortField>('total');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [popup, setPopup] = useState<PopupState>({ show: false, member: null, x: 0, y: 0 });
  
  // メンバーごとに全組織のデータを統合（useMemoでメモ化）
  const memberSummaries = useMemo(() => {
    console.log('MemberActivityTable received activities:', activities);
    console.log('Date range:', startDate, 'to', endDate);
    
    const memberMap = new Map<string, MemberSummary>();
    
    activities.forEach(activity => {
      const login = activity.login;
      const existingMember = memberMap.get(login);
      
      const totalIssues = Object.values(activity.activities).reduce((sum, data) => sum + data.issues, 0);
      const totalPullRequests = Object.values(activity.activities).reduce((sum, data) => sum + data.pullRequests, 0);
      const totalCommits = Object.values(activity.activities).reduce((sum, data) => sum + data.commits, 0);
      const totalReviews = Object.values(activity.activities).reduce((sum, data) => sum + data.reviews, 0);

      console.log(`Processing ${activity.login} from ${activity.organization}:`, {
        issues: totalIssues,
        pullRequests: totalPullRequests,
        commits: totalCommits,
        reviews: totalReviews,
        activities: activity.activities
      });

      if (existingMember) {
        // 既存のメンバーのデータに追加
        existingMember.totalIssues += totalIssues;
        existingMember.totalPullRequests += totalPullRequests;
        existingMember.totalCommits += totalCommits;
        existingMember.totalReviews += totalReviews;
        
        // 月毎データを統合
        Object.entries(activity.activities).forEach(([yearMonth, monthData]) => {
          if (!existingMember.monthlyData[yearMonth]) {
            existingMember.monthlyData[yearMonth] = { issues: 0, pullRequests: 0, commits: 0, reviews: 0 };
          }
          existingMember.monthlyData[yearMonth].issues += monthData.issues;
          existingMember.monthlyData[yearMonth].pullRequests += monthData.pullRequests;
          existingMember.monthlyData[yearMonth].commits += monthData.commits;
          existingMember.monthlyData[yearMonth].reviews += monthData.reviews;
        });
        
        console.log(`Updated existing member ${login}:`, {
          issues: existingMember.totalIssues,
          pullRequests: existingMember.totalPullRequests,
          commits: existingMember.totalCommits,
          reviews: existingMember.totalReviews
        });
      } else {
        // 新しいメンバーを追加
        memberMap.set(login, {
          login: activity.login,
          name: activity.name || activity.login,
          avatar_url: activity.avatar_url,
          totalIssues,
          totalPullRequests,
          totalCommits,
          totalReviews,
          monthlyData: { ...activity.activities }
        });
        console.log(`Added new member ${login}:`, {
          issues: totalIssues,
          pullRequests: totalPullRequests,
          commits: totalCommits,
          reviews: totalReviews
        });
      }
    });

    return Array.from(memberMap.values());
  }, [activities, startDate, endDate]);

  // ソート関数
  const sortMembers = (members: MemberSummary[]): MemberSummary[] => {
    return members.sort((a, b) => {
      let aValue: number;
      let bValue: number;
      
      switch (sortField) {
        case 'issues':
          aValue = a.totalIssues;
          bValue = b.totalIssues;
          break;
        case 'pullRequests':
          aValue = a.totalPullRequests;
          bValue = b.totalPullRequests;
          break;
        case 'commits':
          aValue = a.totalCommits;
          bValue = b.totalCommits;
          break;
        case 'reviews':
          aValue = a.totalReviews;
          bValue = b.totalReviews;
          break;
        case 'total':
        default:
          aValue = a.totalIssues + a.totalPullRequests + a.totalCommits + a.totalReviews;
          bValue = b.totalIssues + b.totalPullRequests + b.totalCommits + b.totalReviews;
          break;
      }
      
      if (sortDirection === 'asc') {
        return aValue - bValue;
      } else {
        return bValue - aValue;
      }
    });
  };

  // ソートされたメンバーリスト
  const sortedMembers = useMemo(() => {
    return sortMembers(memberSummaries);
  }, [memberSummaries, sortField, sortDirection]);

  console.log('Final member summaries:', sortedMembers);

  // ソートハンドラー
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  // ソートアイコン
  const getSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return (
        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
        </svg>
      );
    }
    
    if (sortDirection === 'asc') {
      return (
        <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
        </svg>
      );
    } else {
      return (
        <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      );
    }
  };

  // ホバーハンドラー
  const handleMouseEnter = (member: MemberSummary, event: React.MouseEvent) => {
    setPopup({
      show: true,
      member,
      x: event.clientX,
      y: event.clientY
    });
  };

  const handleMouseLeave = () => {
    // ポップアップにマウスが移動した場合は非表示にしない
    setTimeout(() => {
      setPopup(prev => {
        if (!prev.show) {
          return { show: false, member: null, x: 0, y: 0 };
        }
        return prev;
      });
    }, 100);
  };

  const handlePopupMouseEnter = () => {
    // ポップアップにマウスが入った場合は表示を維持
  };

  const handlePopupMouseLeave = () => {
    setPopup({ show: false, member: null, x: 0, y: 0 });
  };

  // 最大値を計算（グラフのスケール用）
  const maxValues = useMemo(() => {
    const maxIssues = Math.max(...sortedMembers.map(m => m.totalIssues), 1);
    const maxPullRequests = Math.max(...sortedMembers.map(m => m.totalPullRequests), 1);
    const maxCommits = Math.max(...sortedMembers.map(m => m.totalCommits), 1);
    const maxReviews = Math.max(...sortedMembers.map(m => m.totalReviews), 1);
    
    return { maxIssues, maxPullRequests, maxCommits, maxReviews };
  }, [sortedMembers]);

  // CSVダウンロード機能
  const downloadCSV = () => {
    // CSVヘッダー
    const headers = ['メンバー名', '年月', '組織', 'イシュー作成数', 'プルリク作成数', 'コミット数', 'レビュー数', '合計'];
    
    // CSVデータを生成
    const csvData: string[] = [];
    
    // 各メンバーの組織別・月毎データを処理
    activities.forEach(activity => {
      Object.entries(activity.activities).forEach(([yearMonth, data]) => {
        const total = data.issues + data.pullRequests + data.commits + data.reviews;
        const row = [
          activity.name || activity.login,
          yearMonth,
          activity.organizationDisplayName || activity.organization || '不明の組織',
          data.issues.toString(),
          data.pullRequests.toString(),
          data.commits.toString(),
          data.reviews.toString(),
          total.toString()
        ];
        csvData.push(row.join(','));
      });
    });
    
    // 名前、組織、日付の順でソート
    csvData.sort((a, b) => {
      const aParts = a.split(',');
      const bParts = b.split(',');
      
      const aName = aParts[0];
      const bName = bParts[0];
      const aOrg = aParts[2];
      const bOrg = bParts[2];
      const aDate = aParts[1];
      const bDate = bParts[1];
      
      // まず名前でソート
      const nameCompare = aName.localeCompare(bName);
      if (nameCompare !== 0) {
        return nameCompare;
      }
      
      // 名前が同じ場合は組織でソート
      const orgCompare = aOrg.localeCompare(bOrg);
      if (orgCompare !== 0) {
        return orgCompare;
      }
      
      // 組織も同じ場合は日付でソート（新しい日付順）
      return bDate.localeCompare(aDate);
    });
    
    // CSVファイルを生成
    const csvContent = [headers.join(','), ...csvData].join('\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    // ファイル名を生成（期間を含む）
    const fileName = `member_activities_${startDate}_${endDate}.csv`;
    
    link.setAttribute('href', url);
    link.setAttribute('download', fileName);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-xl font-semibold text-gray-900">
          全メンバー活動サマリー ({startDate} 〜 {endDate})
        </h3>
        <button
          onClick={downloadCSV}
          className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition-colors flex items-center space-x-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <span>CSVダウンロード</span>
        </button>
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left py-3 px-4 font-semibold text-gray-900 min-w-[200px]">
                メンバー
              </th>
              <th 
                className="text-center py-3 px-4 font-semibold text-gray-900 min-w-[150px] cursor-pointer hover:bg-gray-50 transition-colors"
                onClick={() => handleSort('issues')}
              >
                <div className="flex items-center justify-center space-x-1">
                  <span>イシュー作成数</span>
                  {getSortIcon('issues')}
                </div>
              </th>
              <th 
                className="text-center py-3 px-4 font-semibold text-gray-900 min-w-[150px] cursor-pointer hover:bg-gray-50 transition-colors"
                onClick={() => handleSort('pullRequests')}
              >
                <div className="flex items-center justify-center space-x-1">
                  <span>プルリク作成数</span>
                  {getSortIcon('pullRequests')}
                </div>
              </th>
              <th 
                className="text-center py-3 px-4 font-semibold text-gray-900 min-w-[150px] cursor-pointer hover:bg-gray-50 transition-colors"
                onClick={() => handleSort('commits')}
              >
                <div className="flex items-center justify-center space-x-1">
                  <span>コミット数</span>
                  {getSortIcon('commits')}
                </div>
              </th>
              <th 
                className="text-center py-3 px-4 font-semibold text-gray-900 min-w-[150px] cursor-pointer hover:bg-gray-50 transition-colors"
                onClick={() => handleSort('reviews')}
              >
                <div className="flex items-center justify-center space-x-1">
                  <span>レビュー数</span>
                  {getSortIcon('reviews')}
                </div>
              </th>
              <th 
                className="text-center py-3 px-4 font-semibold text-gray-900 min-w-[100px] cursor-pointer hover:bg-gray-50 transition-colors"
                onClick={() => handleSort('total')}
              >
                <div className="flex items-center justify-center space-x-1">
                  <span>合計</span>
                  {getSortIcon('total')}
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedMembers.map((member, index) => (
              <tr key={member.login} className={`border-b border-gray-100 ${index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}`}>
                <td className="py-3 px-4">
                  <div 
                    className="flex items-center space-x-3 cursor-pointer"
                    onMouseEnter={(e) => handleMouseEnter(member, e)}
                    onMouseLeave={handleMouseLeave}
                  >
                    <img
                      src={member.avatar_url}
                      alt={member.name}
                      className="w-8 h-8 rounded-full"
                    />
                    <div>
                      <div className="font-medium text-gray-900 hover:text-blue-600 transition-colors">{member.name}</div>
                      <div className="text-sm text-gray-500">@{member.login}</div>
                    </div>
                  </div>
                </td>
                
                {/* イシュー作成数 */}
                <td className="py-3 px-4">
                                      <div className="flex items-center space-x-2">
                      <div className="flex-1 bg-gray-200 rounded-full h-6">
                        <div
                          className="bg-red-500 h-6 rounded-full transition-all duration-300"
                          style={{ width: `${(member.totalIssues / maxValues.maxIssues) * 100}%` }}
                        />
                      </div>
                      <span className="text-sm font-medium text-gray-900 min-w-[2rem] text-right">
                        {member.totalIssues}
                      </span>
                    </div>
                </td>
                
                {/* プルリク作成数 */}
                <td className="py-3 px-4">
                                      <div className="flex items-center space-x-2">
                      <div className="flex-1 bg-gray-200 rounded-full h-6">
                        <div
                          className="bg-blue-500 h-6 rounded-full transition-all duration-300"
                          style={{ width: `${(member.totalPullRequests / maxValues.maxPullRequests) * 100}%` }}
                        />
                      </div>
                      <span className="text-sm font-medium text-gray-900 min-w-[2rem] text-right">
                        {member.totalPullRequests}
                      </span>
                    </div>
                </td>
                
                {/* コミット数 */}
                <td className="py-3 px-4">
                                      <div className="flex items-center space-x-2">
                      <div className="flex-1 bg-gray-200 rounded-full h-6">
                        <div
                          className="bg-green-500 h-6 rounded-full transition-all duration-300"
                          style={{ width: `${(member.totalCommits / maxValues.maxCommits) * 100}%` }}
                        />
                      </div>
                      <span className="text-sm font-medium text-gray-900 min-w-[2rem] text-right">
                        {member.totalCommits}
                      </span>
                    </div>
                </td>
                
                {/* レビュー数 */}
                <td className="py-3 px-4">
                                      <div className="flex items-center space-x-2">
                      <div className="flex-1 bg-gray-200 rounded-full h-6">
                        <div
                          className="bg-purple-500 h-6 rounded-full transition-all duration-300"
                          style={{ width: `${(member.totalReviews / maxValues.maxReviews) * 100}%` }}
                        />
                      </div>
                      <span className="text-sm font-medium text-gray-900 min-w-[2rem] text-right">
                        {member.totalReviews}
                      </span>
                    </div>
                </td>
                
                {/* 合計 */}
                <td className="py-3 px-4 text-center">
                  <span className="font-semibold text-gray-900">
                    {member.totalIssues + member.totalPullRequests + member.totalCommits + member.totalReviews}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      {/* 凡例 */}
      <div className="mt-6 pt-4 border-t border-gray-200">
        <h4 className="text-sm font-medium text-gray-900 mb-3">凡例</h4>
        <div className="flex flex-wrap gap-4 text-sm">
          <div className="flex items-center space-x-2">
            <div className="w-4 h-4 bg-red-500 rounded"></div>
            <span>イシュー作成数</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-4 h-4 bg-blue-500 rounded"></div>
            <span>プルリク作成数</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-4 h-4 bg-green-500 rounded"></div>
            <span>コミット数</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-4 h-4 bg-purple-500 rounded"></div>
            <span>レビュー数</span>
          </div>
        </div>
      </div>
      
      {/* 月毎データポップアップ */}
      {popup.show && popup.member && (
        <div 
          className="fixed z-50 bg-white border border-gray-200 rounded-lg shadow-lg p-4 min-w-[600px] max-w-[800px]"
          style={{ 
            left: popup.x + 10, 
            top: popup.y - 10,
            transform: 'translateY(-100%)'
          }}
          onMouseEnter={handlePopupMouseEnter}
          onMouseLeave={handlePopupMouseLeave}
        >
          <div className="mb-3">
            <h4 className="font-semibold text-gray-900 text-sm mb-1">{popup.member.name}</h4>
            <p className="text-xs text-gray-500">月毎活動詳細</p>
          </div>
          
          <div className="max-h-64 overflow-y-auto">
            <div className="grid grid-cols-1 gap-2">
              {Object.entries(popup.member.monthlyData)
                .sort(([a], [b]) => b.localeCompare(a)) // 新しい月順でソート
                .map(([yearMonth, data]) => (
                  <div key={yearMonth} className="border border-gray-200 rounded p-3 hover:bg-gray-50 transition-colors">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium text-gray-700">{yearMonth}</span>
                      <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                        合計: {data.issues + data.pullRequests + data.commits + data.reviews}
                      </span>
                    </div>
                    <div className="grid grid-cols-4 gap-4 text-sm">
                      <div className="text-center">
                        <div className="text-red-600 font-semibold text-lg">{data.issues}</div>
                        <div className="text-gray-500 text-xs">イシュー</div>
                      </div>
                      <div className="text-center">
                        <div className="text-blue-600 font-semibold text-lg">{data.pullRequests}</div>
                        <div className="text-gray-500 text-xs">PR</div>
                      </div>
                      <div className="text-center">
                        <div className="text-green-600 font-semibold text-lg">{data.commits}</div>
                        <div className="text-gray-500 text-xs">コミット</div>
                      </div>
                      <div className="text-center">
                        <div className="text-purple-600 font-semibold text-lg">{data.reviews}</div>
                        <div className="text-gray-500 text-xs">レビュー</div>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </div>
          
          {Object.keys(popup.member.monthlyData).length === 0 && (
            <div className="text-center text-gray-500 text-sm py-8">
              月毎データがありません
            </div>
          )}
        </div>
      )}
    </div>
  );
}; 