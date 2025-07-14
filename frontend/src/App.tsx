import React, { useState, useEffect } from 'react';
import { Organization, MemberActivity } from './types';
import { api } from './services/api';
import { MemberSelector } from './components/MemberSelector';
import { ActivityChart } from './components/ActivityChart';
import { RateLimitDisplay } from './components/RateLimitDisplay';
import moment from 'moment';

function App() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [selectedOrg, setSelectedOrg] = useState<string>('');
  const [selectedMember, setSelectedMember] = useState<string | null>(null);
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [activities, setActivities] = useState<MemberActivity[]>([]);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  const [testMode, setTestMode] = useState(false);

  useEffect(() => {
    loadOrganizations();
    loadActivities();
  }, []);

  useEffect(() => {
    // デフォルトで1年前から今日までを設定
    const today = moment();
    const oneYearAgo = moment().subtract(1, 'year');
    setStartDate(oneYearAgo.format('YYYY-MM-DD'));
    setEndDate(today.format('YYYY-MM-DD'));
  }, []);

  const loadOrganizations = async () => {
    try {
      const orgs = await api.getOrganizations();
      setOrganizations(orgs);
      if (orgs.length > 0) {
        setSelectedOrg(orgs[0].name);
      }
    } catch (error) {
      console.error('Error loading organizations:', error);
    }
  };

  const loadActivities = async () => {
    setIsLoading(true);
    try {
      const data = await api.getActivities();
      setActivities(data.activities);
      setLastUpdated(data.lastUpdated);
    } catch (error) {
      console.error('Error loading activities:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFetchData = async () => {
    if (!selectedOrg || !startDate || !endDate) {
      alert('組織、開始日、終了日を選択してください');
      return;
    }

    setIsFetching(true);
    try {
      await api.fetchData(selectedOrg, startDate, endDate, testMode);
      await loadActivities();
      alert(`データの取得が完了しました (${testMode ? 'テストモード' : '本番モード'})`);
    } catch (error) {
      console.error('Error fetching data:', error);
      alert('データの取得に失敗しました');
    } finally {
      setIsFetching(false);
    }
  };

  const selectedMemberActivity = activities.find(a => a.login === selectedMember);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-8 text-center">
          Git Status - GitHub活動データ
        </h1>

        <RateLimitDisplay />

        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">設定</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                組織
              </label>
              <select
                value={selectedOrg}
                onChange={(e) => setSelectedOrg(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">組織を選択</option>
                {organizations.map((org) => (
                  <option key={org.name} value={org.name}>
                    {org.displayName}
                  </option>
                ))}
              </select>
            </div>

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
              <button
                onClick={handleFetchData}
                disabled={isFetching || !selectedOrg || !startDate || !endDate}
                className={`flex-1 py-3 px-4 rounded-md transition-colors ${
                  testMode 
                    ? 'bg-orange-600 hover:bg-orange-700 text-white' 
                    : 'bg-blue-600 hover:bg-blue-700 text-white'
                } disabled:bg-gray-400 disabled:cursor-not-allowed`}
              >
                {isFetching ? 'データ取得中...' : `${testMode ? 'テスト' : ''}データ取得`}
              </button>
            </div>
          </div>

          {lastUpdated && (
            <div className="text-sm text-gray-600">
              最終更新: {moment(lastUpdated).format('YYYY年M月D日 H:mm')}
            </div>
          )}
        </div>

        {selectedOrg && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-8">
            <MemberSelector
              selectedOrg={selectedOrg}
              selectedMember={selectedMember}
              onMemberSelect={setSelectedMember}
            />
          </div>
        )}

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