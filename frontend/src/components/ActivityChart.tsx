import React from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';
import { MemberActivity } from '../types';
import moment from 'moment';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

interface ActivityChartProps {
  memberActivity: MemberActivity;
  startDate: string;
  endDate: string;
}

export const ActivityChart: React.FC<ActivityChartProps> = ({
  memberActivity,
  startDate,
  endDate
}) => {
  // 日付範囲内の月を生成
  const generateMonths = (start: string, end: string): string[] => {
    const months: string[] = [];
    let current = moment(start).startOf('month');
    const endMoment = moment(end).endOf('month');

    while (current.isSameOrBefore(endMoment)) {
      months.push(current.format('YYYY-MM'));
      current.add(1, 'month');
    }

    return months;
  };

  const months = generateMonths(startDate, endDate);

  // 組織情報を表示用に整形
  const getOrganizationDisplay = () => {
    if (memberActivity.organization === 'multiple') {
      return '複数組織';
    }
    return memberActivity.organizationDisplayName || memberActivity.organization || '不明';
  };

  const chartData = {
    labels: months.map(month => moment(month).format('YYYY年M月')),
    datasets: [
      {
        label: 'イシュー作成数',
        data: months.map(month => memberActivity.activities[month]?.issues || 0),
        backgroundColor: 'rgba(255, 99, 132, 0.8)',
        borderColor: 'rgba(255, 99, 132, 1)',
        borderWidth: 1,
      },
      {
        label: 'プルリク作成数',
        data: months.map(month => memberActivity.activities[month]?.pullRequests || 0),
        backgroundColor: 'rgba(54, 162, 235, 0.8)',
        borderColor: 'rgba(54, 162, 235, 1)',
        borderWidth: 1,
      },
      {
        label: 'コミット数',
        data: months.map(month => memberActivity.activities[month]?.commits || 0),
        backgroundColor: 'rgba(255, 206, 86, 0.8)',
        borderColor: 'rgba(255, 206, 86, 1)',
        borderWidth: 1,
      },
      {
        label: 'レビュー数',
        data: months.map(month => memberActivity.activities[month]?.reviews || 0),
        backgroundColor: 'rgba(75, 192, 192, 0.8)',
        borderColor: 'rgba(75, 192, 192, 1)',
        borderWidth: 1,
      },
    ],
  };

  const options = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top' as const,
      },
      title: {
        display: true,
        text: `${memberActivity.name || memberActivity.login}の活動データ (${getOrganizationDisplay()})`,
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          stepSize: 1,
        },
      },
    },
  };

  // 合計値を計算
  const totalIssues = Object.values(memberActivity.activities).reduce((sum, data) => sum + data.issues, 0);
  const totalPRs = Object.values(memberActivity.activities).reduce((sum, data) => sum + data.pullRequests, 0);
  const totalCommits = Object.values(memberActivity.activities).reduce((sum, data) => sum + data.commits, 0);
  const totalReviews = Object.values(memberActivity.activities).reduce((sum, data) => sum + data.reviews, 0);

  return (
    <div>
      {/* 統計情報 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-red-600">{totalIssues}</div>
          <div className="text-sm text-red-700">イシュー作成</div>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-blue-600">{totalPRs}</div>
          <div className="text-sm text-blue-700">プルリク作成</div>
        </div>
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-yellow-600">{totalCommits}</div>
          <div className="text-sm text-yellow-700">コミット</div>
        </div>
        <div className="bg-teal-50 border border-teal-200 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-teal-600">{totalReviews}</div>
          <div className="text-sm text-teal-700">レビュー</div>
        </div>
      </div>

      {/* グラフ */}
    <div style={{ width: '100%', height: '400px' }}>
      <Bar data={chartData} options={options} />
      </div>
    </div>
  );
}; 