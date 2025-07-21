import axios from 'axios';
import { GitHubUser, MemberActivity, Organization } from '../types';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

export const api = {
  // 組織一覧を取得
  getOrganizations: async (): Promise<Organization[]> => {
    const response = await axios.get(`${API_BASE_URL}/organizations`);
    return response.data;
  },

  // メンバー一覧を取得
  getMembers: async (orgName: string): Promise<GitHubUser[]> => {
    const response = await axios.get(`${API_BASE_URL}/members?org=${orgName}`);
    return response.data;
  },

  // 保存された活動データを取得（全組織合算）
  getActivities: async (): Promise<{ 
    activities: MemberActivity[]; 
    lastUpdated: string | null;
    organizations: { [key: string]: { count: number, lastUpdated: string | null } }
  }> => {
    const response = await axios.get(`${API_BASE_URL}/activities`);
    return response.data;
  },

  // 特定組織の活動データを取得
  getOrganizationActivities: async (orgName: string): Promise<{ 
    activities: MemberActivity[]; 
    lastUpdated: string | null;
    organization: string;
  }> => {
    const response = await axios.get(`${API_BASE_URL}/activities/${orgName}`);
    return response.data;
  },

  // データを取得して保存（組織ごと）
  fetchData: async (orgName: string, startDate: string, endDate: string): Promise<any> => {
    console.log(`APIリクエスト: 組織=${orgName}, 開始日=${startDate}, 終了日=${endDate}`);
    const response = await axios.post(`${API_BASE_URL}/fetch-data`, {
      orgName,
      startDate,
      endDate
    });
    return response.data;
  },

  // 特定メンバーのデータを取得（テスト用）
  fetchMemberData: async (orgName: string, startDate: string, endDate: string, memberLogin: string = 'mm-kado'): Promise<any> => {
    console.log(`APIリクエスト: メンバー=${memberLogin}, 組織=${orgName}, 開始日=${startDate}, 終了日=${endDate}`);
    const response = await axios.post(`${API_BASE_URL}/fetch-member-data`, {
      orgName,
      startDate,
      endDate,
      memberLogin
    });
    return response.data;
  },

  // mm-kadoのデータを全ての組織から取得
  fetchMmKadoAllOrgs: async (startDate: string, endDate: string, memberLogin: string = 'mm-kado'): Promise<any> => {
    console.log(`APIリクエスト: メンバー=${memberLogin}, 全組織, 開始日=${startDate}, 終了日=${endDate}`);
    const response = await axios.post(`${API_BASE_URL}/fetch-mm-kado-all-orgs`, {
      startDate,
      endDate,
      memberLogin
    });
    return response.data;
  },

  // 全組織のデータを一括取得
  fetchAllOrganizations: async (startDate: string, endDate: string): Promise<any> => {
    console.log(`APIリクエスト: 全組織, 開始日=${startDate}, 終了日=${endDate}`);
    const response = await axios.post(`${API_BASE_URL}/fetch-all-organizations`, {
      startDate,
      endDate
    });
    return response.data;
  },

  // 組織ごとの統計情報を取得
  getOrganizationStats: async (): Promise<{
    organizations: { [key: string]: { count: number, lastUpdated: string | null } };
    lastUpdated: string | null;
    totalActivities: number;
  }> => {
    const response = await axios.get(`${API_BASE_URL}/organizations/stats`);
    return response.data;
  },

  // レートリミット情報を取得
  getRateLimit: async (): Promise<{ rateLimitInfo: any }> => {
    const response = await axios.get(`${API_BASE_URL}/rate-limit`);
    return response.data;
  },

  // 月毎データを取得
  async getMonthlyData(orgName: string) {
    const response = await axios.get(`${API_BASE_URL}/monthly-data/${orgName}`);
    return response.data;
  },

  // 月毎データを取得して保存
  async fetchMonthlyData(orgName: string, monthStart: string, monthEnd: string, forceUpdate: boolean = false) {
    const response = await axios.post(`${API_BASE_URL}/fetch-monthly-data`, {
      orgName,
      monthStart,
      monthEnd,
      forceUpdate
    });
    
    return response.data;
  },

  // 月毎データを削除
  async deleteMonthlyData(orgName: string, monthStart: string) {
    const response = await axios.delete(`${API_BASE_URL}/monthly-data/${orgName}/${monthStart}`);
    
    return response.data;
  },

  // 指定期間の月毎データを統合して取得
  async getMonthlyActivities(startMonth: string, endMonth: string) {
    const response = await axios.get(`${API_BASE_URL}/monthly-activities`, {
      params: { startMonth, endMonth }
    });
    return response.data;
  },

  // 週単位データを取得
  async getWeeklyData(orgName: string) {
    const response = await axios.get(`${API_BASE_URL}/weekly-data/${orgName}`);
    return response.data;
  },

  // 週単位データを取得して保存
  async fetchWeeklyData(orgName: string, weekStart: string, weekEnd: string, forceUpdate: boolean = false) {
    const response = await axios.post(`${API_BASE_URL}/fetch-weekly-data`, {
      orgName,
      weekStart,
      weekEnd,
      forceUpdate
    });
    
    return response.data;
  },

  // 週単位データを削除
  async deleteWeeklyData(orgName: string, weekStart: string) {
    const response = await axios.delete(`${API_BASE_URL}/weekly-data/${orgName}/${weekStart}`);
    
    return response.data;
  },

  // 全組織の週単位データを統合して取得
  async getWeeklyActivities() {
    const response = await axios.get(`${API_BASE_URL}/weekly-activities`);
    return response.data;
  },

  // 自然言語クエリを実行
  async processNaturalLanguageQuery(query: string) {
    const response = await axios.post(`${API_BASE_URL}/query`, { query });
    return response.data;
  }
}; 