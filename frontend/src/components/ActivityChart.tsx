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
        text: `${memberActivity.name || memberActivity.login}の活動データ`,
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

  return (
    <div style={{ width: '100%', height: '400px' }}>
      <Bar data={chartData} options={options} />
    </div>
  );
}; 