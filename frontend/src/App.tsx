import React, { useState, useEffect } from 'react';
import moment from 'moment';
import { ActivityChart } from './components/ActivityChart';
import { MemberSelector } from './components/MemberSelector';
import { RateLimitDisplay } from './components/RateLimitDisplay';
import { api } from './services/api';
import { Organization, MemberActivity } from './types';
import './App.css';

interface WeeklyData {
  weekKey: string;
  weekStart: string;
  weekEnd: string;
  lastUpdated: string;
}

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
  
  // 週単位データ関連のstate
  const [weeklyData, setWeeklyData] = useState<{ [key: string]: WeeklyData[] }>({});
  const [selectedWeekStart, setSelectedWeekStart] = useState<string>('');
  const [selectedWeekEnd, setSelectedWeekEnd] = useState<string>('');
  const [isFetchingWeekly, setIsFetchingWeekly] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [confirmDialogData, setConfirmDialogData] = useState<{ orgName: string, weekStart: string, weekEnd: string } | null>(null);

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

  // 組織が読み込まれた後に週単位データを読み込み
  useEffect(() => {
    if (organizations.length > 0) {
      loadWeeklyData();
    }
  }, [organizations]);

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

  // 週単位データを読み込み
  const loadWeeklyData = async () => {
    try {
      const weeklyDataMap: { [key: string]: WeeklyData[] } = {};
      
      for (const org of organizations) {
        try {
          const data = await api.getWeeklyData(org.name);
          weeklyDataMap[org.name] = data.fetchedWeeks || [];
        } catch (error) {
          console.error(`Error loading weekly data for ${org.name}:`, error);
          weeklyDataMap[org.name] = [];
        }
      }
      
      setWeeklyData(weeklyDataMap);
    } catch (error) {
      console.error('Error loading weekly data:', error);
    }
  };

  // 週の開始日と終了日を計算
  const getWeekRange = (date: string) => {
    const start = moment(date).startOf('week').format('YYYY-MM-DD');
    const end = moment(date).endOf('week').format('YYYY-MM-DD');
    return { start, end };
  };

  // 週単位データを取得
  const handleFetchWeeklyData = async (orgName: string, weekStart: string, weekEnd: string, forceUpdate: boolean = false) => {
    setIsFetchingWeekly(true);
    try {
      await api.fetchWeeklyData(orgName, weekStart, weekEnd, testMode, forceUpdate);
      await loadWeeklyData();
      await loadActivities();
      await loadOrganizationStats();
      alert(`週単位データの取得が完了しました (${testMode ? 'テストモード' : '本番モード'})`);
    } catch (error: any) {
      if (error.message === 'Week data already exists') {
        // 既に取得済みの場合は確認ダイアログを表示
        setConfirmDialogData({ orgName, weekStart, weekEnd });
        setShowConfirmDialog(true);
      } else {
        console.error('Error fetching weekly data:', error);
        alert('週単位データの取得に失敗しました');
      }
    } finally {
      setIsFetchingWeekly(false);
    }
  };

  // 確認ダイアログで強制更新を実行
  const handleForceUpdate = async () => {
    if (!confirmDialogData) return;
    
    setShowConfirmDialog(false);
    setIsFetchingWeekly(true);
    try {
      await api.fetchWeeklyData(
        confirmDialogData.orgName, 
        confirmDialogData.weekStart, 
        confirmDialogData.weekEnd, 
        testMode, 
        true
      );
      await loadWeeklyData();
      await loadActivities();
      await loadOrganizationStats();
      alert(`週単位データの強制更新が完了しました (${testMode ? 'テストモード' : '本番モード'})`);
    } catch (error) {
      console.error('Error force updating weekly data:', error);
      alert('週単位データの強制更新に失敗しました');
    } finally {
      setIsFetchingWeekly(false);
      setConfirmDialogData(null);
    }
  };

  // 週単位データを削除
  const handleDeleteWeeklyData = async (orgName: string, weekStart: string) => {
    if (!confirm(`週 ${weekStart} のデータを削除しますか？`)) {
      return;
    }
    
    try {
      await api.deleteWeeklyData(orgName, weekStart);
      await loadWeeklyData();
      await loadActivities();
      await loadOrganizationStats();
      alert('週単位データを削除しました');
    } catch (error) {
      console.error('Error deleting weekly data:', error);
      alert('週単位データの削除に失敗しました');
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

        {/* 週単位データ取得 */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">週単位データ取得</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                週の開始日
              </label>
              <input
                type="date"
                value={selectedWeekStart}
                onChange={(e) => {
                  setSelectedWeekStart(e.target.value);
                  if (e.target.value) {
                    const { start, end } = getWeekRange(e.target.value);
                    setSelectedWeekStart(start);
                    setSelectedWeekEnd(end);
                  }
                }}
                className="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                週の終了日
              </label>
              <input
                type="date"
                value={selectedWeekEnd}
                onChange={(e) => setSelectedWeekEnd(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                readOnly
              />
            </div>

            <div className="flex items-end">
              <button
                onClick={() => {
                  if (selectedWeekStart && selectedWeekEnd) {
                    organizations.forEach(org => {
                      handleFetchWeeklyData(org.name, selectedWeekStart, selectedWeekEnd);
                    });
                  } else {
                    alert('週の開始日を選択してください');
                  }
                }}
                disabled={isFetchingWeekly || !selectedWeekStart || !selectedWeekEnd}
                className={`w-full py-3 px-6 rounded-md transition-colors ${
                  testMode 
                    ? 'bg-orange-600 hover:bg-orange-700 text-white' 
                    : 'bg-green-600 hover:bg-green-700 text-white'
                } disabled:bg-gray-400 disabled:cursor-not-allowed`}
              >
                {isFetchingWeekly ? '取得中...' : `${testMode ? 'テスト' : ''}週単位データ取得`}
              </button>
            </div>
          </div>

          {/* 取得済み週一覧 */}
          <div className="mb-6">
            <h3 className="text-lg font-medium text-gray-900 mb-3">取得済み週一覧</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {organizations.map((org) => {
                const orgWeeks = weeklyData[org.name] || [];
                return (
                  <div key={org.name} className="border rounded-lg p-4">
                    <h4 className="font-semibold text-gray-900 mb-2">{org.displayName}</h4>
                    {orgWeeks.length === 0 ? (
                      <p className="text-sm text-gray-500">取得済みの週はありません</p>
                    ) : (
                      <div className="space-y-2">
                        {orgWeeks.map((week) => (
                          <div key={week.weekKey} className="flex items-center justify-between text-sm">
                            <div>
                              <div className="font-medium">{week.weekKey}</div>
                              <div className="text-gray-500">
                                {moment(week.weekStart).format('M/D')} - {moment(week.weekEnd).format('M/D')}
                              </div>
                            </div>
                            <div className="flex space-x-2">
                              <button
                                onClick={() => handleFetchWeeklyData(org.name, week.weekStart, week.weekEnd, true)}
                                className="text-blue-600 hover:text-blue-800 text-xs"
                                title="再取得"
                              >
                                再取得
                              </button>
                              <button
                                onClick={() => handleDeleteWeeklyData(org.name, week.weekStart)}
                                className="text-red-600 hover:text-red-800 text-xs"
                                title="削除"
                              >
                                削除
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
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

        {/* 確認ダイアログ */}
        {showConfirmDialog && confirmDialogData && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">確認</h3>
              <p className="text-gray-700 mb-6">
                週 {confirmDialogData.weekStart} のデータは既に取得済みです。
                再度取得しますか？
              </p>
              <div className="flex space-x-4">
                <button
                  onClick={() => setShowConfirmDialog(false)}
                  className="flex-1 py-2 px-4 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                >
                  キャンセル
                </button>
                <button
                  onClick={handleForceUpdate}
                  className="flex-1 py-2 px-4 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  再取得
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App; 