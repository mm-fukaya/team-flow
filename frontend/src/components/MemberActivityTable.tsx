import React, { useState } from 'react';
import { MemberActivity } from '../types';

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
}

export const MemberActivityTable: React.FC<MemberActivityTableProps> = ({
  activities,
  startDate,
  endDate
}) => {
  const [sortField, setSortField] = useState<SortField>('total');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  
  console.log('MemberActivityTable received activities:', activities);
  console.log('Date range:', startDate, 'to', endDate);
  
  // メンバーごとに全組織のデータを統合
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
        totalReviews
      });
      console.log(`Added new member ${login}:`, {
        issues: totalIssues,
        pullRequests: totalPullRequests,
        commits: totalCommits,
        reviews: totalReviews
      });
    }
  });

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

  // Mapから配列に変換してソート
  const memberSummaries: MemberSummary[] = sortMembers(Array.from(memberMap.values()));

  console.log('Final member summaries:', memberSummaries);

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

  const sortedMembers = memberSummaries;

  // 最大値を計算（グラフのスケール用）
  const maxIssues = Math.max(...sortedMembers.map(m => m.totalIssues), 1);
  const maxPullRequests = Math.max(...sortedMembers.map(m => m.totalPullRequests), 1);
  const maxCommits = Math.max(...sortedMembers.map(m => m.totalCommits), 1);
  const maxReviews = Math.max(...sortedMembers.map(m => m.totalReviews), 1);

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h3 className="text-xl font-semibold text-gray-900 mb-6">
        全メンバー活動サマリー ({startDate} 〜 {endDate})
      </h3>
      
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
                  <div className="flex items-center space-x-3">
                    <img
                      src={member.avatar_url}
                      alt={member.name}
                      className="w-8 h-8 rounded-full"
                    />
                    <div>
                      <div className="font-medium text-gray-900">{member.name}</div>
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
                        style={{ width: `${(member.totalIssues / maxIssues) * 100}%` }}
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
                        style={{ width: `${(member.totalPullRequests / maxPullRequests) * 100}%` }}
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
                        style={{ width: `${(member.totalCommits / maxCommits) * 100}%` }}
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
                        style={{ width: `${(member.totalReviews / maxReviews) * 100}%` }}
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
    </div>
  );
}; 