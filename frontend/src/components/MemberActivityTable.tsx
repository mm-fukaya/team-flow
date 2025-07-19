import React from 'react';
import { MemberActivity } from '../types';

interface MemberActivityTableProps {
  activities: MemberActivity[];
  startDate: string;
  endDate: string;
}

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
  console.log('MemberActivityTable received activities:', activities);
  console.log('Date range:', startDate, 'to', endDate);
  
  // メンバーごとの合計を計算
  const memberSummaries: MemberSummary[] = activities.map(activity => {
    const totalIssues = Object.values(activity.activities).reduce((sum, data) => sum + data.issues, 0);
    const totalPullRequests = Object.values(activity.activities).reduce((sum, data) => sum + data.pullRequests, 0);
    const totalCommits = Object.values(activity.activities).reduce((sum, data) => sum + data.commits, 0);
    const totalReviews = Object.values(activity.activities).reduce((sum, data) => sum + data.reviews, 0);

    console.log(`Member ${activity.login} totals:`, {
      issues: totalIssues,
      pullRequests: totalPullRequests,
      commits: totalCommits,
      reviews: totalReviews,
      activities: activity.activities
    });

    return {
      login: activity.login,
      name: activity.name || activity.login,
      avatar_url: activity.avatar_url,
      totalIssues,
      totalPullRequests,
      totalCommits,
      totalReviews
    };
  });

  // 合計値でソート（降順）
  const sortedMembers = memberSummaries.sort((a, b) => {
    const totalA = a.totalIssues + a.totalPullRequests + a.totalCommits + a.totalReviews;
    const totalB = b.totalIssues + b.totalPullRequests + b.totalCommits + b.totalReviews;
    return totalB - totalA;
  });

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
              <th className="text-center py-3 px-4 font-semibold text-gray-900 min-w-[150px]">
                イシュー作成数
              </th>
              <th className="text-center py-3 px-4 font-semibold text-gray-900 min-w-[150px]">
                プルリク作成数
              </th>
              <th className="text-center py-3 px-4 font-semibold text-gray-900 min-w-[150px]">
                コミット数
              </th>
              <th className="text-center py-3 px-4 font-semibold text-gray-900 min-w-[150px]">
                レビュー数
              </th>
              <th className="text-center py-3 px-4 font-semibold text-gray-900 min-w-[100px]">
                合計
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