import React, { useState, useEffect } from 'react';
import moment from 'moment';
import { ActivityChart } from './components/ActivityChart';
import { MemberSelector } from './components/MemberSelector';
import { RateLimitDisplay } from './components/RateLimitDisplay';
import { MemberActivityTable } from './components/MemberActivityTable';
import { api } from './services/api';
import { Organization, MemberActivity } from './types';

interface RateLimitInfo {
  limit: number;
  remaining: number;
  reset: number;
}

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
  
  // レートリミット関連のstate
  const [showRateLimitDialog, setShowRateLimitDialog] = useState(false);
  const [rateLimitInfo, setRateLimitInfo] = useState<RateLimitInfo | null>(null);

  useEffect(() => {
    loadOrganizations();
    loadActivities();
    loadMonthlyData();
  }, []);



  // 組織が読み込まれた後にデータを読み込み
  useEffect(() => {
    if (organizations.length > 0) {
      loadActivities();
      loadMonthlyData();
    }
  }, [organizations]);

  // 表示期間が変更されたときにデータを再読み込み
  useEffect(() => {
    loadDisplayPeriodData();
  }, [displayStartMonth, displayEndMonth]);

  // レートリミット情報を取得
  const fetchRateLimitInfo = async (): Promise<RateLimitInfo | null> => {
    try {
      const data = await api.getRateLimit();
      return data.rateLimitInfo;
    } catch (error) {
      console.error('Error fetching rate limit:', error);
      return null;
    }
  };

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
    } catch (error) {
      console.error('Error loading activities:', error);
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
    // レートリミットチェック
    const rateLimit = await fetchRateLimitInfo();
    if (rateLimit && rateLimit.remaining <= 2000) {
      setRateLimitInfo(rateLimit);
      setShowRateLimitDialog(true);
      return;
    }

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
    
    // レートリミットチェック
    const rateLimit = await fetchRateLimitInfo();
    if (rateLimit && rateLimit.remaining <= 2000) {
      setRateLimitInfo(rateLimit);
      setShowRateLimitDialog(true);
      setShowMonthlyConfirmDialog(false);
      return;
    }
    
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



  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-4xl font-bold text-gray-900 mb-8 text-center">
          GitStatus - GitHub活動データ
        </h1>





        {/* データ管理 */}
        <div className="mb-8">
          <h2 className="text-2xl font-semibold mb-6">データ管理</h2>
          
          <div className="bg-white rounded-xl shadow-lg p-6">
            {/* データ取得設定 */}
            <div className="mb-8">
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

            {/* GitHub API レートリミット */}
            <div className="mb-8">
              <RateLimitDisplay />
            </div>

            {/* 取得済みデータ表示 */}
            <div>
              <h3 className="text-xl font-medium mb-4">取得済みデータ</h3>
              <div className="max-h-96 overflow-y-auto border border-gray-200 rounded-lg">
                {Object.entries(monthlyData).map(([orgName, months]) => (
                  <div key={orgName} className="border-b border-gray-200 last:border-b-0">
                    <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
                      <h4 className="font-semibold text-gray-800 text-sm">{orgName}</h4>
                    </div>
                    {months.length > 0 ? (
                      <div className="divide-y divide-gray-100">
                        {months.map((month) => (
                          <div key={month.monthKey} className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors">
                            <div className="flex items-center space-x-4 flex-1">
                              <span className="font-medium text-gray-900 min-w-[80px]">{month.monthKey}</span>
                              <span className="text-sm text-gray-500">
                                最終更新: {moment(month.lastUpdated).format('YYYY-MM-DD HH:mm')}
                              </span>
                            </div>
                            <button
                              onClick={() => handleDeleteMonthlyData(orgName, month.monthStart)}
                              className="text-red-500 hover:text-red-700 text-sm bg-white px-2 py-1 rounded border border-red-200 hover:bg-red-50 transition-colors"
                              title="削除"
                            >
                              削除
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="px-4 py-8 text-center text-gray-500">
                        <svg className="mx-auto h-8 w-8 text-gray-400 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <span className="text-sm">取得済みの月毎データがありません</span>
                      </div>
                    )}
                  </div>
                ))}
                {Object.keys(monthlyData).length === 0 && (
                  <div className="px-4 py-8 text-center text-gray-500">
                    <svg className="mx-auto h-8 w-8 text-gray-400 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <span className="text-sm">組織データがありません</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* 表示期間設定 */}
        <div className="mb-8">
          <h2 className="text-2xl font-semibold mb-6">表示期間設定</h2>
          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
            </div>
          </div>
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
            <MemberActivityTable
              activities={activities}
              startDate={displayStartMonth}
              endDate={displayEndMonth}
            />
          </div>
        )}





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

        {/* レートリミット警告ダイアログ */}
        {showRateLimitDialog && rateLimitInfo && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded-lg max-w-md w-full mx-4">
              <div className="flex items-center mb-4">
                <svg className="w-6 h-6 text-red-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
                <h3 className="text-lg font-semibold text-red-600">GitHub API レートリミット警告</h3>
              </div>
              <div className="mb-4">
                <p className="text-gray-700 mb-3">
                  データの取得に失敗する可能性があるため、処理を中断しました。
                </p>
                <div className="bg-gray-50 p-3 rounded-lg">
                  <div className="space-y-2 text-sm">
                    <div>
                      <span className="text-gray-600">現在の使用状況:</span>
                      <span className="ml-2 font-medium text-red-600">
                        {rateLimitInfo.remaining.toLocaleString()} / {rateLimitInfo.limit.toLocaleString()}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-600">リセット時刻:</span>
                      <span className="ml-2 font-medium">
                        {moment.unix(rateLimitInfo.reset).format('YYYY年M月D日 H:mm:ss')}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-600">リセットまで:</span>
                      <span className="ml-2 font-medium">
                        {moment.unix(rateLimitInfo.reset).fromNow()}
                      </span>
                    </div>
                  </div>
                </div>
                <p className="text-sm text-gray-600 mt-3">
                  レートリミットが回復するまでお待ちください。
                </p>
              </div>
              <div className="flex justify-end">
                <button
                  onClick={() => {
                    setShowRateLimitDialog(false);
                    setRateLimitInfo(null);
                  }}
                  className="bg-blue-500 text-white py-2 px-4 rounded hover:bg-blue-600 transition-colors"
                >
                  了解
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