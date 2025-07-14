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

  // 保存された活動データを取得
  getActivities: async (): Promise<{ activities: MemberActivity[]; lastUpdated: string | null }> => {
    const response = await axios.get(`${API_BASE_URL}/activities`);
    return response.data;
  },

  // データを取得して保存
  fetchData: async (orgName: string, startDate: string, endDate: string, testMode: boolean = false): Promise<any> => {
    const response = await axios.post(`${API_BASE_URL}/fetch-data`, {
      orgName,
      startDate,
      endDate,
      testMode
    });
    return response.data;
  },

  // レートリミット情報を取得
  getRateLimit: async (): Promise<{ rateLimitInfo: any }> => {
    const response = await axios.get(`${API_BASE_URL}/rate-limit`);
    return response.data;
  }
}; 