import React, { useState, useEffect } from 'react';
import { Organization, MemberActivity } from './types';
import { api } from './services/api';
import { MemberSelector } from './components/MemberSelector';
import { ActivityChart } from './components/ActivityChart';
import { RateLimitDisplay } from './components/RateLimitDisplay';
import moment from 'moment';

function App() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [selectedMember, setSelectedMember] = useState<string | null>(null);
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [activities, setActivities] = useState<MemberActivity[]>([]);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  const [testMode, setTestMode] = useState(false);
  const [organizationStats, setOrganizationStats] = useState<{ [key: string]: { count: number, lastUpdated: string | null } }>({});

  useEffect(() => {
    loadOrganizations();
    loadActivities();
    loadOrganizationStats();
  }, []);

  useEffect(() => {
    // デフォルトで3ヶ月前から今日までを設定
    const today = moment();
    const threeMonthsAgo = moment().subtract(3, 'months');
    setStartDate(threeMonthsAgo.format('YYYY-MM-DD'));
    setEndDate(today.format('YYYY-MM-DD'));
  }, []);

  const loadOrganizations = async () => {
    try {
      const orgs = await api.getOrganizations();
              setOrganizations(orgs);
    } catch (error) {
      console.error('Error loading organizations:', error);
    }
  };

  const loadActivities = async () => {
    setIsLoading(true);
    try {
      const data = await api.getActivities();
      console.log('Debug: Loaded activities data:', data);
      setActivities(data.activities);
      setLastUpdated(data.lastUpdated);
      setOrganizationStats(data.organizations || {});
    } catch (error) {
      console.error('Error loading activities:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadOrganizationStats = async () => {
    try {
      const stats = await api.getOrganizationStats();
      setOrganizationStats(stats.organizations);
    } catch (error) {
      console.error('Error loading organization stats:', error);
    }
  };

  const handleFetchAllOrganizations = async () => {
    if (!startDate || !endDate) {
      alert('開始日、終了日を選択してください');
      return;
    }

    setIsFetching(true);
    try {
      const result = await api.fetchAllOrganizations(startDate, endDate, testMode);
      await loadActivities();
      await loadOrganizationStats();
      alert(`全組織のデータ取得が完了しました (${testMode ? 'テストモード' : '本番モード'})\n総取得数: ${result.totalCount}件`);
    } catch (error) {
      console.error('Error fetching all organizations data:', error);
      alert('全組織のデータ取得に失敗しました');
    } finally {
      setIsFetching(false);
    }
  };

  // 組織の合算データを処理
  const getCombinedMemberActivity = (memberLogin: string): MemberActivity | null => {
    const memberActivities = activities.filter(a => a.login === memberLogin);
    
    console.log(`Debug: Found ${memberActivities.length} activities for ${memberLogin}`);
    memberActivities.forEach((activity, index) => {
      console.log(`Debug: Activity ${index + 1}:`, {
        organization: activity.organization,
        organizationDisplayName: activity.organizationDisplayName,
        activities: activity.activities
      });
    });
    
    if (memberActivities.length === 0) {
      return null;
    }

    // 複数の組織のデータを合算
    const combinedActivities: { [yearMonth: string]: { issues: number; pullRequests: number; commits: number; reviews: number } } = {};
    
    memberActivities.forEach(activity => {
      console.log(`Debug: Processing activity for organization: ${activity.organization}`);
      Object.entries(activity.activities).forEach(([yearMonth, data]) => {
        if (!combinedActivities[yearMonth]) {
          combinedActivities[yearMonth] = { issues: 0, pullRequests: 0, commits: 0, reviews: 0 };
        }
        const before = { ...combinedActivities[yearMonth] };
        combinedActivities[yearMonth].issues += data.issues;
        combinedActivities[yearMonth].pullRequests += data.pullRequests;
        combinedActivities[yearMonth].commits += data.commits;
        combinedActivities[yearMonth].reviews += data.reviews;
        console.log(`Debug: ${yearMonth} - ${activity.organization}:`, {
          before,
          adding: data,
          after: combinedActivities[yearMonth]
        });
      });
    });

    console.log('Debug: Final combined activities:', combinedActivities);

    // 最初のメンバー情報をベースにして合算データを作成
    const firstActivity = memberActivities[0];
    return {
      login: firstActivity.login,
      name: firstActivity.name,
      avatar_url: firstActivity.avatar_url,
      organization: memberActivities.length > 1 ? 'multiple' : firstActivity.organization,
      organizationDisplayName: memberActivities.length > 1 ? '複数組織' : firstActivity.organizationDisplayName,
      activities: combinedActivities
    };
  };

  const selectedMemberActivity = getCombinedMemberActivity(selectedMember || '');

  const totalActivities = Object.values(organizationStats).reduce((sum, stat) => sum + stat.count, 0);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-8 text-center">
          Git Status - GitHub活動データ
        </h1>

        <RateLimitDisplay />

        {/* 組織統計表示 */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">組織別統計</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {organizations.map((org) => {
              const stats = organizationStats[org.name] || { count: 0, lastUpdated: null };
              return (
                <div key={org.name} className="border rounded-lg p-4">
                  <h3 className="font-semibold text-gray-900 mb-2">{org.displayName}</h3>
                  <div className="text-sm text-gray-600">
                    <div>活動数: {stats.count.toLocaleString()}件</div>
                    {stats.lastUpdated && (
                      <div>更新: {moment(stats.lastUpdated).format('M/D H:mm')}</div>
                    )}
                  </div>
                </div>
              );
            })}
            <div className="border rounded-lg p-4 bg-blue-50">
              <h3 className="font-semibold text-gray-900 mb-2">合計</h3>
              <div className="text-sm text-gray-600">
                <div>総活動数: {totalActivities.toLocaleString()}件</div>
                {lastUpdated && (
                  <div>最終更新: {moment(lastUpdated).format('M/D H:mm')}</div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">設定</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                開始日
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                max={endDate}
                className="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                終了日
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                min={startDate}
                max={moment().format('YYYY-MM-DD')}
                className="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex items-end space-x-2">
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="testMode"
                  checked={testMode}
                  onChange={(e) => setTestMode(e.target.checked)}
                  className="mr-2"
                />
                <label htmlFor="testMode" className="text-sm text-gray-700">
                  テストモード
                </label>
              </div>
            </div>
          </div>

          <div className="flex space-x-4 mb-4">
            <button
              onClick={handleFetchAllOrganizations}
              disabled={isFetching || !startDate || !endDate}
              className={`py-3 px-6 rounded-md transition-colors ${
                testMode 
                  ? 'bg-orange-600 hover:bg-orange-700 text-white' 
                  : 'bg-blue-600 hover:bg-blue-700 text-white'
              } disabled:bg-gray-400 disabled:cursor-not-allowed`}
            >
              {isFetching ? 'データ取得中...' : `${testMode ? 'テスト' : ''}データ取得（全組織）`}
            </button>
          </div>

          {lastUpdated && (
            <div className="text-sm text-gray-600">
              最終更新: {moment(lastUpdated).format('YYYY年M月D日 H:mm')}
            </div>
          )}
        </div>

        {/* 表示設定 */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">全組織メンバー選択</h2>
          <MemberSelector
            selectedOrg=""
            selectedMember={selectedMember}
            onMemberSelect={setSelectedMember}
            allOrganizations={true}
          />
        </div>

        {isLoading ? (
          <div className="bg-white rounded-lg shadow-md p-6 text-center">
            <div className="text-gray-500">データを読み込み中...</div>
          </div>
        ) : selectedMemberActivity && startDate && endDate ? (
          <div className="bg-white rounded-lg shadow-md p-6">
            <ActivityChart
              memberActivity={selectedMemberActivity}
              startDate={startDate}
              endDate={endDate}
            />
            
            {/* 組織別詳細情報 */}
            {selectedMember && (() => {
              const memberActivities = activities.filter(a => a.login === selectedMember);
              if (memberActivities.length > 1) {
                return (
                  <div className="mt-8">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">組織別詳細</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {memberActivities.map((activity, index) => {
                        const totalIssues = Object.values(activity.activities).reduce((sum, data) => sum + data.issues, 0);
                        const totalPRs = Object.values(activity.activities).reduce((sum, data) => sum + data.pullRequests, 0);
                        const totalCommits = Object.values(activity.activities).reduce((sum, data) => sum + data.commits, 0);
                        const totalReviews = Object.values(activity.activities).reduce((sum, data) => sum + data.reviews, 0);
                        
                        return (
                          <div key={index} className="border rounded-lg p-4">
                            <h4 className="font-semibold text-gray-900 mb-2">
                              {activity.organizationDisplayName || activity.organization || '不明の組織'}
                            </h4>
                            <div className="grid grid-cols-2 gap-2 text-sm">
                              <div>イシュー: {totalIssues}</div>
                              <div>プルリク: {totalPRs}</div>
                              <div>コミット: {totalCommits}</div>
                              <div>レビュー: {totalReviews}</div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              }
              return null;
            })()}
          </div>
        ) : selectedMember ? (
          <div className="bg-white rounded-lg shadow-md p-6 text-center">
            <div className="text-gray-500">選択されたメンバーのデータが見つかりません</div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default App; 