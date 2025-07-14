import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import moment from 'moment';

interface RateLimitInfo {
  limit: number;
  remaining: number;
  reset: number;
}

export const RateLimitDisplay: React.FC = () => {
  const [rateLimitInfo, setRateLimitInfo] = useState<RateLimitInfo | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchRateLimit = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await api.getRateLimit();
      setRateLimitInfo(data.rateLimitInfo);
    } catch (err) {
      setError('レートリミット情報の取得に失敗しました');
      console.error('Error fetching rate limit:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRateLimit();
    // 5分ごとに更新
    const interval = setInterval(fetchRateLimit, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-4 mb-4">
        <div className="text-sm text-gray-500">レートリミット情報を読み込み中...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow-md p-4 mb-4">
        <div className="text-sm text-red-500">{error}</div>
        <button
          onClick={fetchRateLimit}
          className="mt-2 text-sm text-blue-600 hover:text-blue-800"
        >
          再試行
        </button>
      </div>
    );
  }

  if (!rateLimitInfo) {
    return (
      <div className="bg-white rounded-lg shadow-md p-4 mb-4">
        <div className="text-sm text-gray-500">レートリミット情報が利用できません</div>
      </div>
    );
  }

  const { limit, remaining, reset } = rateLimitInfo;
  const used = limit - remaining;
  const percentage = (used / limit) * 100;
  const resetTime = moment.unix(reset).format('YYYY年M月D日 H:mm:ss');
  const timeUntilReset = moment.unix(reset).fromNow();

  // 残りリクエスト数に応じて色を決定
  const getStatusColor = () => {
    if (remaining <= limit * 0.1) return 'text-red-600'; // 10%以下
    if (remaining <= limit * 0.3) return 'text-yellow-600'; // 30%以下
    return 'text-green-600'; // それ以外
  };

  const getProgressColor = () => {
    if (percentage >= 90) return 'bg-red-500'; // 90%以上
    if (percentage >= 70) return 'bg-yellow-500'; // 70%以上
    return 'bg-green-500'; // それ以外
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-4 mb-4">
      <h3 className="text-lg font-semibold text-gray-900 mb-3">
        GitHub API レートリミット
      </h3>
      
      <div className="space-y-3">
        {/* プログレスバー */}
        <div>
          <div className="flex justify-between text-sm text-gray-600 mb-1">
            <span>使用状況</span>
            <span className={getStatusColor()}>
              {remaining} / {limit} リクエスト残り
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all duration-300 ${getProgressColor()}`}
              style={{ width: `${percentage}%` }}
            ></div>
          </div>
        </div>

        {/* 詳細情報 */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-600">使用済み:</span>
            <span className="ml-2 font-medium">{used.toLocaleString()}</span>
          </div>
          <div>
            <span className="text-gray-600">残り:</span>
            <span className={`ml-2 font-medium ${getStatusColor()}`}>
              {remaining.toLocaleString()}
            </span>
          </div>
          <div>
            <span className="text-gray-600">リセット時刻:</span>
            <span className="ml-2 font-medium">{resetTime}</span>
          </div>
          <div>
            <span className="text-gray-600">リセットまで:</span>
            <span className="ml-2 font-medium">{timeUntilReset}</span>
          </div>
        </div>

        {/* 更新ボタン */}
        <div className="pt-2">
          <button
            onClick={fetchRateLimit}
            className="text-sm text-blue-600 hover:text-blue-800 transition-colors"
          >
            更新
          </button>
        </div>
      </div>
    </div>
  );
}; 