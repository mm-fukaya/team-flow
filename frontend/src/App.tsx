import React, { useState, useEffect } from 'react';
import moment from 'moment';
import { ActivityChart } from './components/ActivityChart';
import { MemberSelector } from './components/MemberSelector';
import { RateLimitDisplay } from './components/RateLimitDisplay';
import { MemberActivityTable } from './components/MemberActivityTable';
import { api } from './services/api';
import { Organization, MemberActivity } from './types';

interface WeeklyData {
  weekKey: string;
  weekStart: string;
  weekEnd: string;
  lastUpdated: string;
}

function App() {
  // 基本設定
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [isFetching, setIsFetching] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string>('');
  
  // データ関連のstate
  const [activities, setActivities] = useState<MemberActivity[]>([]);
  const [organizationStats, setOrganizationStats] = useState<{ [key: string]: { count: number, lastUpdated: string | null } }>({});
  const [selectedMember, setSelectedMember] = useState<string>('');
  
  // 週単位データ関連のstate
  const [weeklyData, setWeeklyData] = useState<{ [key: string]: WeeklyData[] }>({});
  const [selectedWeekStart, setSelectedWeekStart] = useState<string>('');
  const [selectedWeekEnd, setSelectedWeekEnd] = useState<string>('');
  const [isFetchingWeekly, setIsFetchingWeekly] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [confirmDialogData, setConfirmDialogData] = useState<{ orgName: string, weekStart: string, weekEnd: string } | null>(null);
  
  // 月毎データ関連のstate
  const [monthlyData, setMonthlyData] = useState<{ [key: string]: { monthKey: string, monthStart: string, monthEnd: string, lastUpdated: string }[] }>({});
  const [fetchMonth, setFetchMonth] = useState<string>('');
  const [isFetchingMonthly, setIsFetchingMonthly] = useState(false);
  const [showMonthlyConfirmDialog, setShowMonthlyConfirmDialog] = useState(false);
  const [monthlyConfirmDialogData, setMonthlyConfirmDialogData] = useState<{ orgName: string, monthStart: string, monthEnd: string } | null>(null);
  
  // 表示期間関連のstate
  const [displayStartMonth, setDisplayStartMonth] = useState<string>('');
  const [displayEndMonth, setDisplayEndMonth] = useState<string>('');
  const [showPeriodSummary, setShowPeriodSummary] = useState(false);

  useEffect(() => {
    loadOrganizations();
    loadActivities();
    loadOrganizationStats();
    loadMonthlyData();
  }, []);



  // 組織が読み込まれた後にデータを読み込み
  useEffect(() => {
    if (organizations.length > 0) {
      loadActivities();
      loadOrganizationStats();
      loadMonthlyData();
    }
  }, [organizations]);

  // 表示期間が変更されたときにデータを再読み込み
  useEffect(() => {
    loadDisplayPeriodData();
  }, [displayStartMonth, displayEndMonth]);

  const loadOrganizations = async () => {
    try {
      const orgs = await api.getOrganizations();
              setOrganizations(orgs);
    } catch (error) {
      console.error('Error loading organizations:', error);
    }
  };

  const loadActivities = async () => {
    try {
      const data = await api.getActivities();
      console.log('Debug: Loaded activities data:', data);
      setActivities(data.activities);
      if (data.lastUpdated) {
        setLastUpdated(data.lastUpdated);
      }
      setOrganizationStats(data.organizations || {});
    } catch (error) {
      console.error('Error loading activities:', error);
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
      await api.fetchWeeklyData(orgName, weekStart, weekEnd, forceUpdate);
      await loadWeeklyData();
      await loadActivities();
      await loadOrganizationStats();
      alert(`週単位データの取得が完了しました`);
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
        true
      );
      await loadWeeklyData();
      await loadActivities();
      await loadOrganizationStats();
      alert(`週単位データの強制更新が完了しました`);
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
    if (!window.confirm(`週 ${weekStart} のデータを削除しますか？`)) {
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

  // 月毎データを読み込み
  const loadMonthlyData = async () => {
    try {
      const monthlyDataMap: { [key: string]: { monthKey: string, monthStart: string, monthEnd: string, lastUpdated: string }[] } = {};
      
      for (const org of organizations) {
        try {
          const data = await api.getMonthlyData(org.name);
          monthlyDataMap[org.name] = data.fetchedMonths || [];
        } catch (error) {
          console.error(`Error loading monthly data for ${org.name}:`, error);
          monthlyDataMap[org.name] = [];
        }
      }
      
      setMonthlyData(monthlyDataMap);
    } catch (error) {
      console.error('Error loading monthly data:', error);
    }
  };

  // 月毎データを取得
  const handleFetchMonthlyData = async (orgName: string, monthStart: string, monthEnd: string, forceUpdate: boolean = false) => {
    // 既存データのチェック
    if (!forceUpdate) {
      const existingData = monthlyData[orgName] || [];
      const monthKey = moment(monthStart).format('YYYY-MM');
      const isAlreadyFetched = existingData.some(month => month.monthKey === monthKey);
      
      if (isAlreadyFetched) {
        // 既に取得済みの場合は確認ダイアログを表示
        setMonthlyConfirmDialogData({ orgName, monthStart, monthEnd });
        setShowMonthlyConfirmDialog(true);
        return;
      }
    }

    setIsFetchingMonthly(true);
    try {
      await api.fetchMonthlyData(orgName, monthStart, monthEnd, forceUpdate);
      await loadMonthlyData();
      alert(`月毎データの取得が完了しました`);
    } catch (error: any) {
      console.error('Error fetching monthly data:', error);
      alert('月毎データの取得に失敗しました');
    } finally {
      setIsFetchingMonthly(false);
    }
  };

  // 月毎確認ダイアログで強制更新を実行
  const handleMonthlyForceUpdate = async () => {
    if (!monthlyConfirmDialogData) return;
    
    setShowMonthlyConfirmDialog(false);
    setIsFetchingMonthly(true);
    try {
      await api.fetchMonthlyData(
        monthlyConfirmDialogData.orgName, 
        monthlyConfirmDialogData.monthStart, 
        monthlyConfirmDialogData.monthEnd, 
        true
      );
      await loadMonthlyData();
      alert(`月毎データの強制更新が完了しました`);
    } catch (error) {
      console.error('Error force updating monthly data:', error);
      alert('月毎データの強制更新に失敗しました');
    } finally {
      setIsFetchingMonthly(false);
      setMonthlyConfirmDialogData(null);
    }
  };

  // 月毎データを削除
  const handleDeleteMonthlyData = async (orgName: string, monthStart: string) => {
    if (!window.confirm(`月 ${monthStart} のデータを削除しますか？`)) {
      return;
    }
    
    try {
      await api.deleteMonthlyData(orgName, monthStart);
      await loadMonthlyData();
      alert('月毎データを削除しました');
    } catch (error) {
      console.error('Error deleting monthly data:', error);
      alert('月毎データの削除に失敗しました');
    }
  };



  // 表示期間のデータを読み込み
  const loadDisplayPeriodData = async () => {
    if (!displayStartMonth || !displayEndMonth) return;
    
    try {
      console.log('Loading display period data:', { displayStartMonth, displayEndMonth });
      const data = await api.getMonthlyActivities(displayStartMonth, displayEndMonth);
      console.log('Received data:', data);
      setActivities(data.activities);
      setOrganizationStats(data.organizations);
      setLastUpdated(new Date().toISOString());
      setShowPeriodSummary(true); // 期間サマリーを表示
      console.log('Set showPeriodSummary to true');
    } catch (error) {
      console.error('Error loading display period data:', error);
    }
  };

  const handleFetchAllOrganizations = async () => {
    if (!selectedWeekStart || !selectedWeekEnd) {
      alert('開始日と終了日を選択してください');
      return;
    }

    setIsFetchingWeekly(true);
    try {
      for (const org of organizations) {
        await handleFetchWeeklyData(org.name, selectedWeekStart, selectedWeekEnd);
      }
      alert('週単位データの取得が完了しました');
    } catch (error) {
      console.error('Error fetching weekly data for all organizations:', error);
      alert('週単位データの取得に失敗しました');
    } finally {
      setIsFetchingWeekly(false);
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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-4xl font-bold text-gray-900 mb-8 text-center">
          GitStatus - GitHub活動データ
        </h1>

        <RateLimitDisplay />

        {/* 組織統計表示 */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
          <h2 className="text-2xl font-semibold text-gray-900 mb-6">組織別統計</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {organizations.map((org) => {
              const stats = organizationStats[org.name] || { count: 0, lastUpdated: null };
              return (
                <div key={org.name} className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                  <h3 className="font-semibold text-gray-900 mb-3 text-lg">{org.displayName}</h3>
                  <div className="text-sm text-gray-600 space-y-1">
                    <div className="flex justify-between">
                      <span>メンバー数:</span>
                      <span className="font-semibold text-blue-600">{stats.count.toLocaleString()}人</span>
                    </div>
                    {stats.lastUpdated && (
                      <div className="flex justify-between">
                        <span>更新:</span>
                        <span className="text-gray-500">{moment(stats.lastUpdated).format('M/D H:mm')}</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg p-4">
              <h3 className="font-semibold text-gray-900 mb-3 text-lg">合計</h3>
              <div className="text-sm text-gray-600 space-y-1">
                <div className="flex justify-between">
                  <span>総活動数:</span>
                  <span className="font-semibold text-green-600">{totalActivities.toLocaleString()}件</span>
                </div>
                {lastUpdated && (
                  <div className="flex justify-between">
                    <span>最終更新:</span>
                    <span className="text-gray-500">{moment(lastUpdated).format('M/D H:mm')}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* データ取得設定 */}
        <div className="mb-8">
          <h2 className="text-2xl font-semibold mb-6">データ取得設定</h2>
          
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h3 className="text-xl font-medium mb-4">月毎データ取得</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-700">取得する月</label>
                <input
                  type="month"
                  value={fetchMonth}
                  onChange={(e) => setFetchMonth(e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div className="flex items-end">
                <button
                  onClick={() => {
                    if (fetchMonth) {
                      const monthStart = moment(fetchMonth).startOf('month').format('YYYY-MM-DD');
                      const monthEnd = moment(fetchMonth).endOf('month').format('YYYY-MM-DD');
                      
                      // 各組織に対して個別にチェックして取得
                      organizations.forEach(org => {
                        handleFetchMonthlyData(org.name, monthStart, monthEnd);
                      });
                    }
                  }}
                  disabled={!fetchMonth || isFetchingMonthly}
                  className="w-full bg-gradient-to-r from-blue-500 to-blue-600 text-white py-3 px-6 rounded-lg hover:from-blue-600 hover:to-blue-700 disabled:from-gray-400 disabled:to-gray-500 transition-all duration-200 font-medium"
                >
                  {isFetchingMonthly ? (
                    <span className="flex items-center justify-center">
                      <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      取得中...
                    </span>
                  ) : (
                    '月毎データ取得（全組織）'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* 取得済みデータ表示 */}
        <div className="mb-8">
          <h2 className="text-2xl font-semibold mb-6">取得済みデータ</h2>
          
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h3 className="text-xl font-medium mb-4">月毎データ</h3>
            {Object.entries(monthlyData).map(([orgName, months]) => (
              <div key={orgName} className="mb-6 last:mb-0">
                <h4 className="font-semibold text-gray-800 mb-3 text-lg border-b border-gray-200 pb-2">{orgName}</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {months.map((month) => (
                    <div key={month.monthKey} className="flex items-center justify-between bg-gradient-to-r from-gray-50 to-gray-100 p-3 rounded-lg border border-gray-200 hover:shadow-md transition-shadow">
                      <div className="flex-1">
                        <div className="font-medium text-gray-900">{month.monthKey}</div>
                        <div className="text-xs text-gray-500 mt-1">
                          最終更新: {moment(month.lastUpdated).format('YYYY-MM-DD HH:mm')}
                        </div>
                      </div>
                      <button
                        onClick={() => handleDeleteMonthlyData(orgName, month.monthStart)}
                        className="ml-3 text-red-500 hover:text-red-700 text-sm bg-white px-2 py-1 rounded border border-red-200 hover:bg-red-50 transition-colors"
                        title="削除"
                      >
                        削除
                      </button>
                    </div>
                  ))}
                  {months.length === 0 && (
                    <div className="col-span-full text-center py-8 text-gray-500">
                      <svg className="mx-auto h-12 w-12 text-gray-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      取得済みの月毎データがありません
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 表示期間設定 */}
        <div className="mb-8">
          <h2 className="text-2xl font-semibold mb-6">表示期間設定</h2>
          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-700">開始月</label>
                <input
                  type="month"
                  value={displayStartMonth}
                  onChange={(e) => setDisplayStartMonth(e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-700">終了月</label>
                <input
                  type="month"
                  value={displayEndMonth}
                  onChange={(e) => setDisplayEndMonth(e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
              </div>
              <div className="flex items-end">
                <button
                  onClick={loadDisplayPeriodData}
                  disabled={!displayStartMonth || !displayEndMonth}
                  className="w-full bg-gradient-to-r from-green-500 to-green-600 text-white py-3 px-6 rounded-lg hover:from-green-600 hover:to-green-700 disabled:from-gray-400 disabled:to-gray-500 transition-all duration-200 font-medium"
                >
                  期間データ読み込み
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* 最終更新日時 */}
        {lastUpdated && (
          <div className="mb-8">
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="text-lg font-medium mb-2 text-gray-900">最終更新日時</h3>
              <p className="text-gray-600 text-lg">
                データ最終更新: {moment(lastUpdated).format('YYYY年M月D日 H:mm:ss')}
              </p>
            </div>
          </div>
        )}



        {/* 表示設定 */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
          <h2 className="text-2xl font-semibold text-gray-900 mb-6">全組織メンバー選択</h2>
          <MemberSelector
            selectedOrg=""
            selectedMember={selectedMember}
            onMemberSelect={setSelectedMember}
            allOrganizations={true}
          />
        </div>

        {/* 全メンバー活動サマリー */}
        {(() => {
          const shouldShow = showPeriodSummary && displayStartMonth && displayEndMonth && activities.length > 0;
          console.log('Checking period summary conditions:', {
            showPeriodSummary,
            displayStartMonth,
            displayEndMonth,
            activitiesLength: activities.length,
            shouldShow
          });
          return shouldShow;
        })() && (
          <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-6">
              全メンバー活動サマリー ({moment(displayStartMonth).format('YYYY年M月')} - {moment(displayEndMonth).format('YYYY年M月')})
            </h2>
            <MemberActivityTable
              activities={activities}
              startDate={displayStartMonth}
              endDate={displayEndMonth}
            />
          </div>
        )}

        {/* デバッグ情報 */}
        {showPeriodSummary && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-8">
            <h3 className="text-lg font-medium text-yellow-800 mb-2">デバッグ情報</h3>
            <div className="text-sm text-yellow-700 space-y-1">
              <div>showPeriodSummary: {showPeriodSummary.toString()}</div>
              <div>displayStartMonth: {displayStartMonth || '未設定'}</div>
              <div>displayEndMonth: {displayEndMonth || '未設定'}</div>
              <div>activities.length: {activities.length}</div>
              <div>条件満たす: {(showPeriodSummary && displayStartMonth && displayEndMonth && activities.length > 0).toString()}</div>
            </div>
          </div>
        )}

        {selectedMemberActivity && displayStartMonth && displayEndMonth ? (
          <div className="bg-white rounded-xl shadow-lg p-6">
            <ActivityChart
              memberActivity={selectedMemberActivity}
              startDate={displayStartMonth}
              endDate={displayEndMonth}
            />
            
            {/* 組織別詳細情報 */}
            {selectedMember && (() => {
              const memberActivities = activities.filter(a => a.login === selectedMember);
              if (memberActivities.length > 1) {
                return (
                  <div className="mt-8">
                    <h3 className="text-xl font-semibold text-gray-900 mb-4">組織別詳細</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {memberActivities.map((activity, index) => {
                        const totalIssues = Object.values(activity.activities).reduce((sum, data) => sum + data.issues, 0);
                        const totalPRs = Object.values(activity.activities).reduce((sum, data) => sum + data.pullRequests, 0);
                        const totalCommits = Object.values(activity.activities).reduce((sum, data) => sum + data.commits, 0);
                        const totalReviews = Object.values(activity.activities).reduce((sum, data) => sum + data.reviews, 0);
                        
                        return (
                          <div key={index} className="border border-gray-200 rounded-lg p-4 bg-gradient-to-r from-gray-50 to-gray-100">
                            <h4 className="font-semibold text-gray-900 mb-3">
                              {activity.organizationDisplayName || activity.organization || '不明の組織'}
                            </h4>
                            <div className="grid grid-cols-2 gap-3 text-sm">
                              <div className="flex justify-between">
                                <span>イシュー:</span>
                                <span className="font-medium">{totalIssues}</span>
                              </div>
                              <div className="flex justify-between">
                                <span>プルリク:</span>
                                <span className="font-medium">{totalPRs}</span>
                              </div>
                              <div className="flex justify-between">
                                <span>コミット:</span>
                                <span className="font-medium">{totalCommits}</span>
                              </div>
                              <div className="flex justify-between">
                                <span>レビュー:</span>
                                <span className="font-medium">{totalReviews}</span>
                              </div>
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
          <div className="bg-white rounded-xl shadow-lg p-6 text-center">
            <div className="text-gray-500 text-lg">選択されたメンバーのデータが見つかりません</div>
          </div>
        ) : null}

        {/* 確認ダイアログ */}
        {showConfirmDialog && confirmDialogData && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded-lg max-w-md w-full mx-4">
              <h3 className="text-lg font-semibold mb-4">週単位データ再取得確認</h3>
              <p className="mb-4">
                {confirmDialogData.orgName} の {confirmDialogData.weekStart} - {confirmDialogData.weekEnd} のデータは既に取得済みです。
                再取得しますか？
              </p>
              <div className="flex space-x-4">
                <button
                  onClick={() => {
                    setShowConfirmDialog(false);
                    setConfirmDialogData(null);
                  }}
                  className="flex-1 bg-gray-500 text-white py-2 px-4 rounded hover:bg-gray-600"
                >
                  キャンセル
                </button>
                <button
                  onClick={handleForceUpdate}
                  className="flex-1 bg-blue-500 text-white py-2 px-4 rounded hover:bg-blue-600"
                >
                  再取得
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 月毎確認ダイアログ */}
        {showMonthlyConfirmDialog && monthlyConfirmDialogData && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded-lg max-w-md w-full mx-4">
              <h3 className="text-lg font-semibold mb-4">月毎データ再取得確認</h3>
              <p className="mb-4">
                {monthlyConfirmDialogData.orgName} の {monthlyConfirmDialogData.monthStart} - {monthlyConfirmDialogData.monthEnd} のデータは既に取得済みです。
                再取得しますか？
              </p>
              <div className="flex space-x-4">
                <button
                  onClick={() => {
                    setShowMonthlyConfirmDialog(false);
                    setMonthlyConfirmDialogData(null);
                  }}
                  className="flex-1 bg-gray-500 text-white py-2 px-4 rounded hover:bg-gray-600"
                >
                  キャンセル
                </button>
                <button
                  onClick={handleMonthlyForceUpdate}
                  className="flex-1 bg-blue-500 text-white py-2 px-4 rounded hover:bg-blue-600"
                >
                  再取得
                </button>
              </div>
            </div>
          </div>
        )}

        {/* メンバー活動サマリー */}
      </div>
    </div>
  );
}

export default App; 