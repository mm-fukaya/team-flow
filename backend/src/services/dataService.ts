import fs from 'fs';
import path from 'path';
import moment from 'moment';
import { MemberActivity } from '../types';

export interface WeekData {
  weekStart: string; // YYYY-MM-DD形式
  weekEnd: string;   // YYYY-MM-DD形式
  lastUpdated: string;
  activities: MemberActivity[];
}

export interface WeeklyDataFile {
  organization: string;
  weeks: { [weekKey: string]: WeekData };
  lastUpdated: string;
}

export class DataService {
  private dataDir = path.join(__dirname, '../../data');
  private dataFile = path.join(this.dataDir, 'member-activities.json');

  constructor() {
    this.ensureDataDirectory();
  }

  private ensureDataDirectory() {
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }
  }

  // 週のキーを生成（YYYY-WW形式）
  private getWeekKey(date: string): string {
    return moment(date).format('YYYY-WW');
  }

  // 週の開始日と終了日を取得
  private getWeekRange(date: string): { start: string, end: string } {
    const start = moment(date).startOf('week').format('YYYY-MM-DD');
    const end = moment(date).endOf('week').format('YYYY-MM-DD');
    return { start, end };
  }

  // 週単位データファイルのパスを取得
  private getWeeklyDataFile(orgName: string): string {
    return path.join(this.dataDir, `${orgName}-weekly-activities.json`);
  }

  // 週単位データを保存
  saveWeeklyActivities(orgName: string, weekStart: string, weekEnd: string, activities: MemberActivity[]): void {
    try {
      const weekKey = this.getWeekKey(weekStart);
      const filePath = this.getWeeklyDataFile(orgName);
      
      let weeklyData: WeeklyDataFile;
      if (fs.existsSync(filePath)) {
        weeklyData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      } else {
        weeklyData = {
          organization: orgName,
          weeks: {},
          lastUpdated: new Date().toISOString()
        };
      }

      weeklyData.weeks[weekKey] = {
        weekStart,
        weekEnd,
        lastUpdated: new Date().toISOString(),
        activities
      };
      weeklyData.lastUpdated = new Date().toISOString();

      fs.writeFileSync(filePath, JSON.stringify(weeklyData, null, 2));
      console.log(`Saved ${activities.length} activities for ${orgName} week ${weekKey} (${weekStart} - ${weekEnd})`);
    } catch (error) {
      console.error(`Error saving weekly activities for ${orgName}:`, error);
      throw error;
    }
  }

  // 週単位データを読み込み
  loadWeeklyActivities(orgName: string, weekStart: string): MemberActivity[] | null {
    try {
      const weekKey = this.getWeekKey(weekStart);
      const filePath = this.getWeeklyDataFile(orgName);
      
      if (!fs.existsSync(filePath)) {
        return null;
      }

      const weeklyData: WeeklyDataFile = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      const weekData = weeklyData.weeks[weekKey];
      
      return weekData ? weekData.activities : null;
    } catch (error) {
      console.error(`Error loading weekly activities for ${orgName}:`, error);
      return null;
    }
  }

  // 取得済みの週一覧を取得
  getFetchedWeeks(orgName: string): { weekKey: string, weekStart: string, weekEnd: string, lastUpdated: string }[] {
    try {
      const filePath = this.getWeeklyDataFile(orgName);
      
      if (!fs.existsSync(filePath)) {
        return [];
      }

      const weeklyData: WeeklyDataFile = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      const weeks = Object.entries(weeklyData.weeks).map(([weekKey, weekData]) => ({
        weekKey,
        weekStart: weekData.weekStart,
        weekEnd: weekData.weekEnd,
        lastUpdated: weekData.lastUpdated
      }));

      // 週の開始日でソート
      return weeks.sort((a, b) => a.weekStart.localeCompare(b.weekStart));
    } catch (error) {
      console.error(`Error getting fetched weeks for ${orgName}:`, error);
      return [];
    }
  }

  // 特定の週が取得済みかチェック
  isWeekFetched(orgName: string, weekStart: string): boolean {
    try {
      const weekKey = this.getWeekKey(weekStart);
      const filePath = this.getWeeklyDataFile(orgName);
      
      if (!fs.existsSync(filePath)) {
        return false;
      }

      const weeklyData: WeeklyDataFile = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      return !!weeklyData.weeks[weekKey];
    } catch (error) {
      console.error(`Error checking if week is fetched for ${orgName}:`, error);
      return false;
    }
  }

  // 週単位データを削除
  deleteWeeklyActivities(orgName: string, weekStart: string): boolean {
    try {
      const weekKey = this.getWeekKey(weekStart);
      const filePath = this.getWeeklyDataFile(orgName);
      
      if (!fs.existsSync(filePath)) {
        return false;
      }

      const weeklyData: WeeklyDataFile = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      
      if (weeklyData.weeks[weekKey]) {
        delete weeklyData.weeks[weekKey];
        weeklyData.lastUpdated = new Date().toISOString();
        fs.writeFileSync(filePath, JSON.stringify(weeklyData, null, 2));
        console.log(`Deleted weekly activities for ${orgName} week ${weekKey}`);
        return true;
      }

      return false;
    } catch (error) {
      console.error(`Error deleting weekly activities for ${orgName}:`, error);
      return false;
    }
  }

  // 全組織の週単位データを統合して取得
  loadAllOrganizationsWeeklyActivities(): { activities: MemberActivity[], organizations: { [key: string]: { count: number, lastUpdated: string | null, fetchedWeeks: string[] } } } {
    try {
      const organizations = require('../../../config/organizations.json').organizations;
      const allActivities: MemberActivity[] = [];
      const orgStats: { [key: string]: { count: number, lastUpdated: string | null, fetchedWeeks: string[] } } = {};

      for (const org of organizations) {
        const fetchedWeeks = this.getFetchedWeeks(org.name);
        let totalCount = 0;
        let latestUpdate: string | null = null;

        // 各週のデータを統合
        for (const week of fetchedWeeks) {
          const weekActivities = this.loadWeeklyActivities(org.name, week.weekStart);
          if (weekActivities) {
            allActivities.push(...weekActivities);
            totalCount += weekActivities.length;
            
            if (!latestUpdate || week.lastUpdated > latestUpdate) {
              latestUpdate = week.lastUpdated;
            }
          }
        }

        orgStats[org.name] = {
          count: totalCount,
          lastUpdated: latestUpdate,
          fetchedWeeks: fetchedWeeks.map(w => w.weekKey)
        };
      }

      return { activities: allActivities, organizations: orgStats };
    } catch (error) {
      console.error('Error loading all organizations weekly activities:', error);
      return { activities: [], organizations: {} };
    }
  }

  // 組織ごとのデータファイルパスを取得
  private getOrganizationDataFile(orgName: string): string {
    return path.join(this.dataDir, `${orgName}-activities.json`);
  }

  // 組織ごとのデータを保存
  saveOrganizationActivities(orgName: string, activities: MemberActivity[]): void {
    try {
      const data = {
        organization: orgName,
        lastUpdated: new Date().toISOString(),
        activities
      };
      const filePath = this.getOrganizationDataFile(orgName);
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
      console.log(`Saved ${activities.length} activities for organization: ${orgName}`);
    } catch (error) {
      console.error(`Error saving activities for ${orgName}:`, error);
      throw error;
    }
  }

  // 組織ごとのデータを読み込み
  loadOrganizationActivities(orgName: string): MemberActivity[] | null {
    try {
      const filePath = this.getOrganizationDataFile(orgName);
      if (!fs.existsSync(filePath)) {
        return null;
      }
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      
      // 新しい形式（macromill-activities.json形式）に対応
      if (data.activities && Array.isArray(data.activities)) {
        // 各メンバーのデータをMemberActivity形式に変換
        return data.activities.map((member: any) => ({
          login: member.login,
          name: member.name,
          avatar_url: member.avatar_url,
          organization: data.organization,
          organizationDisplayName: data.organization === 'macromill' ? 'Macromill' : data.organization,
          activities: member.activities || {}
        }));
      }
      
      // 旧形式（MemberActivity[]形式）に対応
      return data.activities || null;
    } catch (error) {
      console.error(`Error loading activities for ${orgName}:`, error);
      return null;
    }
  }

  // 組織ごとの最終更新時刻を取得
  getOrganizationLastUpdated(orgName: string): string | null {
    try {
      const filePath = this.getOrganizationDataFile(orgName);
      if (!fs.existsSync(filePath)) {
        return null;
      }
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      return data.lastUpdated || null;
    } catch (error) {
      console.error(`Error getting last updated for ${orgName}:`, error);
      return null;
    }
  }

  // 全組織のデータを合算して取得
  loadAllOrganizationsActivities(): { activities: MemberActivity[], organizations: { [key: string]: { count: number, lastUpdated: string | null } } } {
    try {
      const organizations = require('../../../config/organizations.json').organizations;
      const allActivities: MemberActivity[] = [];
      const orgStats: { [key: string]: { count: number, lastUpdated: string | null } } = {};

      // 個別の組織ファイルから読み込み（優先）
      for (const org of organizations) {
        const orgActivities = this.loadOrganizationActivities(org.name);
        const lastUpdated = this.getOrganizationLastUpdated(org.name);
        
        if (orgActivities) {
          allActivities.push(...orgActivities);
          orgStats[org.name] = {
            count: orgActivities.length,
            lastUpdated
          };
        } else {
          orgStats[org.name] = {
            count: 0,
            lastUpdated: null
          };
        }
      }

      // 個別ファイルからデータが取得できた場合は、それを返す
      if (allActivities.length > 0) {
        console.log('Using individual organization files with', allActivities.length, 'activities');
        return { activities: allActivities, organizations: orgStats };
      }

      // 個別ファイルからデータが取得できない場合は、all-organizationsファイルを確認
      const allOrgsFilePath = path.join(this.dataDir, 'all-organizations-activities.json');
      if (fs.existsSync(allOrgsFilePath)) {
        try {
          const allOrgsData = JSON.parse(fs.readFileSync(allOrgsFilePath, 'utf8'));
          if (allOrgsData.activities && Array.isArray(allOrgsData.activities)) {
            // all-organizationsファイルのデータを使用
            allActivities.push(...allOrgsData.activities);
            
            // 組織ごとの統計を計算
            const memberCounts: { [key: string]: number } = {};
            allOrgsData.activities.forEach((activity: MemberActivity) => {
              if (activity.organization) {
                memberCounts[activity.organization] = (memberCounts[activity.organization] || 0) + 1;
              }
            });
            
            // 組織統計を設定
            for (const org of organizations) {
              orgStats[org.name] = {
                count: memberCounts[org.name] || 0,
                lastUpdated: allOrgsData.lastUpdated || null
              };
            }
            
            console.log('Using all-organizations data with', allActivities.length, 'activities');
            return { activities: allActivities, organizations: orgStats };
          }
        } catch (error) {
          console.error('Error reading all-organizations file:', error);
        }
      }

      return { activities: allActivities, organizations: orgStats };
    } catch (error) {
      console.error('Error loading all organizations activities:', error);
      return { activities: [], organizations: {} };
    }
  }

  // 全組織の最終更新時刻を取得
  getAllOrganizationsLastUpdated(): string | null {
    try {
      const organizations = require('../../../config/organizations.json').organizations;
      let latestUpdate: string | null = null;

      for (const org of organizations) {
        const lastUpdated = this.getOrganizationLastUpdated(org.name);
        if (lastUpdated && (!latestUpdate || lastUpdated > latestUpdate)) {
          latestUpdate = lastUpdated;
        }
      }

      return latestUpdate;
    } catch (error) {
      console.error('Error getting all organizations last updated:', error);
      return null;
    }
  }

  // 組織ごとのデータファイル一覧を取得
  getOrganizationDataFiles(): string[] {
    try {
      if (!fs.existsSync(this.dataDir)) {
        return [];
      }
      
      const files = fs.readdirSync(this.dataDir);
      return files.filter(file => file.endsWith('-activities.json'));
    } catch (error) {
      console.error('Error getting organization data files:', error);
      return [];
    }
  }

  // 旧形式のデータ保存（後方互換性のため）
  saveMemberActivities(activities: MemberActivity[]): void {
    try {
      const data = {
        lastUpdated: new Date().toISOString(),
        activities
      };
      fs.writeFileSync(this.dataFile, JSON.stringify(data, null, 2));
    } catch (error) {
      console.error('Error saving member activities:', error);
      throw error;
    }
  }

  // 旧形式のデータ読み込み（後方互換性のため）
  loadMemberActivities(): MemberActivity[] | null {
    try {
      if (!fs.existsSync(this.dataFile)) {
        return null;
      }
      const data = JSON.parse(fs.readFileSync(this.dataFile, 'utf8'));
      return data.activities || null;
    } catch (error) {
      console.error('Error loading member activities:', error);
      return null;
    }
  }

  // 旧形式の最終更新時刻取得（後方互換性のため）
  getLastUpdated(): string | null {
    try {
      if (!fs.existsSync(this.dataFile)) {
        return null;
      }
      const data = JSON.parse(fs.readFileSync(this.dataFile, 'utf8'));
      return data.lastUpdated || null;
    } catch (error) {
      console.error('Error getting last updated:', error);
      return null;
    }
  }
} 