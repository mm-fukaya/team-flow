import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { GitHubService } from './services/githubService';
import { DataService } from './services/dataService';
import { Organization, DateRange } from './types';

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

const githubService = new GitHubService(process.env.GITHUB_TOKEN || '');
const dataService = new DataService();

// 組織設定を読み込み
const organizations: Organization[] = require('../../config/organizations.json').organizations;

// メンバー一覧を取得
app.get('/api/members', async (req, res) => {
  try {
    const orgName = req.query.org as string;
    if (!orgName) {
      return res.status(400).json({ error: 'Organization name is required' });
    }

    // まず保存されたデータからメンバー一覧を取得
    const savedActivities = dataService.loadOrganizationActivities(orgName);
    if (savedActivities && savedActivities.length > 0) {
      // 保存されたデータからメンバー一覧を作成
      const members = savedActivities.map(activity => ({
        id: 0, // MemberActivityにはidがないため、デフォルト値を設定
        login: activity.login,
        name: activity.name,
        avatar_url: activity.avatar_url
      }));
      
      // 重複を除去
      const uniqueMembers = members.filter((member, index, self) => 
        index === self.findIndex(m => m.login === member.login)
      );
      
      console.log(`Found ${uniqueMembers.length} members from saved data for ${orgName}`);
      return res.json(uniqueMembers);
    }

    // 保存されたデータがない場合はGitHub APIから取得
    console.log(`No saved data found for ${orgName}, fetching from GitHub API`);
    const members = await githubService.getOrganizationMembers(orgName);
    res.json(members);
  } catch (error) {
    console.error('Error fetching members:', error);
    res.status(500).json({ error: 'Failed to fetch members' });
  }
});

// 保存されたデータを取得（全組織合算）
app.get('/api/activities', (req, res) => {
  try {
    const { activities, organizations: orgStats } = dataService.loadAllOrganizationsActivities();
    const lastUpdated = dataService.getAllOrganizationsLastUpdated();
    
    res.json({ 
      activities, 
      lastUpdated,
      organizations: orgStats
    });
  } catch (error) {
    console.error('Error loading activities:', error);
    res.status(500).json({ error: 'Failed to load activities' });
  }
});

// 特定組織のデータを取得
app.get('/api/activities/:orgName', (req, res) => {
  try {
    const { orgName } = req.params;
    const activities = dataService.loadOrganizationActivities(orgName);
    const lastUpdated = dataService.getOrganizationLastUpdated(orgName);
    
    if (!activities) {
      return res.json({ activities: [], lastUpdated: null, organization: orgName });
    }

    res.json({ 
      activities, 
      lastUpdated,
      organization: orgName
    });
  } catch (error) {
    console.error('Error loading organization activities:', error);
    res.status(500).json({ error: 'Failed to load organization activities' });
  }
});

// データを取得して保存（組織ごと）
app.post('/api/fetch-data', async (req, res) => {
  try {
    const { orgName, startDate, endDate } = req.body;

    if (!orgName || !startDate || !endDate) {
      return res.status(400).json({ 
        error: 'Organization name, start date, and end date are required' 
      });
    }

    const dateRange: DateRange = { startDate, endDate };
    
    console.log(`Fetching data for ${orgName} from ${startDate} to ${endDate}`);
    
    const activities = await githubService.getAllMemberActivities(orgName, dateRange);
    dataService.saveOrganizationActivities(orgName, activities);

    res.json({ 
      message: `Data fetched and saved successfully for ${orgName}`,
      count: activities.length,
      lastUpdated: new Date().toISOString(),
      organization: orgName
    });
  } catch (error) {
    console.error('Error fetching data:', error);
    res.status(500).json({ error: 'Failed to fetch data' });
  }
});

// 特定メンバーのデータを取得（テスト用）
app.post('/api/fetch-member-data', async (req, res) => {
  try {
    const { orgName, startDate, endDate, memberLogin = 'mm-kado' } = req.body;

    if (!orgName || !startDate || !endDate) {
      return res.status(400).json({ 
        error: 'Organization name, start date, and end date are required' 
      });
    }

    const dateRange: DateRange = { startDate, endDate };
    
    console.log(`Fetching data for member ${memberLogin} in ${orgName} from ${startDate} to ${endDate}`);
    
    const activities = await githubService.getAllMemberActivities(orgName, dateRange, memberLogin);
    dataService.saveOrganizationActivities(orgName, activities);

    res.json({ 
      message: `Data fetched and saved successfully for member ${memberLogin} in ${orgName}`,
      count: activities.length,
      lastUpdated: new Date().toISOString(),
      organization: orgName,
      memberLogin
    });
  } catch (error) {
    console.error('Error fetching member data:', error);
    res.status(500).json({ error: 'Failed to fetch member data' });
  }
});

// mm-kadoのデータを全ての組織から取得
app.post('/api/fetch-mm-kado-all-orgs', async (req, res) => {
  try {
    const { startDate, endDate, memberLogin = 'mm-kado' } = req.body;

    if (!startDate || !endDate) {
      return res.status(400).json({ 
        error: 'Start date and end date are required' 
      });
    }

    const dateRange: DateRange = { startDate, endDate };
    const results: { [key: string]: { count: number, success: boolean, error?: string } } = {};
    const allActivities: any[] = [];
    
    console.log(`Fetching data for member ${memberLogin} from all organizations from ${startDate} to ${endDate}`);
    
    for (const org of organizations) {
      try {
        console.log(`Fetching data for member ${memberLogin} in organization: ${org.name}`);
        const activities = await githubService.getAllMemberActivities(org.name, dateRange, memberLogin);
        
        if (activities.length > 0) {
          // 組織情報を追加
          activities.forEach(activity => {
            activity.organization = org.name;
            activity.organizationDisplayName = org.displayName;
          });
          
          allActivities.push(...activities);
          results[org.name] = {
            count: activities.length,
            success: true
          };
          
          console.log(`Successfully fetched ${activities.length} activities for ${memberLogin} in ${org.name}`);
        } else {
          results[org.name] = {
            count: 0,
            success: true
          };
          console.log(`No activities found for ${memberLogin} in ${org.name}`);
        }
      } catch (error) {
        console.error(`Error fetching data for ${memberLogin} in ${org.name}:`, error);
        results[org.name] = {
          count: 0,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    }

    // 全組織のデータを統合して保存
    if (allActivities.length > 0) {
      dataService.saveOrganizationActivities('all-organizations', allActivities);
    }

    const totalCount = allActivities.length;

    res.json({ 
      message: `Data fetched for member ${memberLogin} from all organizations`,
      totalCount,
      lastUpdated: new Date().toISOString(),
      memberLogin,
      results
    });
  } catch (error) {
    console.error('Error fetching member data from all organizations:', error);
    res.status(500).json({ error: 'Failed to fetch member data from all organizations' });
  }
});

// 全組織のデータを一括取得
app.post('/api/fetch-all-organizations', async (req, res) => {
  try {
    const { startDate, endDate } = req.body;

    if (!startDate || !endDate) {
      return res.status(400).json({ 
        error: 'Start date and end date are required' 
      });
    }

    const dateRange: DateRange = { startDate, endDate };
    const results: { [key: string]: { count: number, success: boolean, error?: string } } = {};
    
    console.log(`Fetching data for all organizations from ${startDate} to ${endDate}`);
    
    for (const org of organizations) {
      try {
        console.log(`Fetching data for organization: ${org.name}`);
        const activities = await githubService.getAllMemberActivities(org.name, dateRange);
        dataService.saveOrganizationActivities(org.name, activities);
        
        results[org.name] = {
          count: activities.length,
          success: true
        };
        
        console.log(`Successfully fetched ${activities.length} activities for ${org.name}`);
      } catch (error) {
        console.error(`Error fetching data for ${org.name}:`, error);
        results[org.name] = {
          count: 0,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    }

    const totalCount = Object.values(results).reduce((sum, result) => sum + result.count, 0);

    res.json({ 
      message: `Data fetched for all organizations`,
      totalCount,
      lastUpdated: new Date().toISOString(),
      results
    });
  } catch (error) {
    console.error('Error fetching all organizations data:', error);
    res.status(500).json({ error: 'Failed to fetch all organizations data' });
  }
});

// 組織一覧を取得
app.get('/api/organizations', (req, res) => {
  res.json(organizations);
});

// 組織ごとのデータ統計を取得
app.get('/api/organizations/stats', (req, res) => {
  try {
    const { organizations: orgStats } = dataService.loadAllOrganizationsActivities();
    const lastUpdated = dataService.getAllOrganizationsLastUpdated();
    
    res.json({ 
      organizations: orgStats,
      lastUpdated,
      totalActivities: Object.values(orgStats).reduce((sum, stat) => sum + stat.count, 0)
    });
  } catch (error) {
    console.error('Error loading organization stats:', error);
    res.status(500).json({ error: 'Failed to load organization stats' });
  }
});

// レートリミット情報を取得
app.get('/api/rate-limit', async (req, res) => {
  try {
    const rateLimitInfo = await githubService.fetchRateLimitInfo();
    res.json({ rateLimitInfo });
  } catch (error) {
    console.error('Error fetching rate limit info:', error);
    res.status(500).json({ error: 'Failed to fetch rate limit info' });
  }
});

// 週単位データ取得のAPIエンドポイントを追加
app.get('/api/weekly-data/:orgName', (req, res) => {
  try {
    const { orgName } = req.params;
    const fetchedWeeks = dataService.getFetchedWeeks(orgName);
    
    res.json({ 
      organization: orgName,
      fetchedWeeks,
      totalWeeks: fetchedWeeks.length
    });
  } catch (error) {
    console.error('Error loading weekly data:', error);
    res.status(500).json({ error: 'Failed to load weekly data' });
  }
});

// 週単位データを取得して保存
app.post('/api/fetch-weekly-data', async (req, res) => {
  try {
    const { orgName, weekStart, weekEnd, forceUpdate = false } = req.body;

    if (!orgName || !weekStart || !weekEnd) {
      return res.status(400).json({ 
        error: 'Organization name, week start, and week end are required' 
      });
    }

    // 既に取得済みの週かチェック
    const isAlreadyFetched = dataService.isWeekFetched(orgName, weekStart);
    if (isAlreadyFetched && !forceUpdate) {
      return res.status(409).json({ 
        error: 'Week data already exists',
        weekStart,
        weekEnd,
        alreadyFetched: true
      });
    }

    const dateRange: DateRange = { startDate: weekStart, endDate: weekEnd };
    
    console.log(`Fetching weekly data for ${orgName} from ${weekStart} to ${weekEnd} (forceUpdate: ${forceUpdate})`);
    
    const activities = await githubService.getAllMemberActivities(orgName, dateRange);
    dataService.saveWeeklyActivities(orgName, weekStart, weekEnd, activities);

    res.json({ 
      message: `Weekly data fetched and saved successfully for ${orgName}`,
      count: activities.length,
      lastUpdated: new Date().toISOString(),
      organization: orgName,
      weekStart,
      weekEnd,
      forceUpdate
    });
  } catch (error) {
    console.error('Error fetching weekly data:', error);
    res.status(500).json({ error: 'Failed to fetch weekly data' });
  }
});

// 週単位データを削除
app.delete('/api/weekly-data/:orgName/:weekStart', (req, res) => {
  try {
    const { orgName, weekStart } = req.params;
    
    const deleted = dataService.deleteWeeklyActivities(orgName, weekStart);
    
    if (deleted) {
      res.json({ 
        message: `Weekly data deleted successfully for ${orgName} week ${weekStart}`,
        organization: orgName,
        weekStart
      });
    } else {
      res.status(404).json({ 
        error: 'Weekly data not found',
        organization: orgName,
        weekStart
      });
    }
  } catch (error) {
    console.error('Error deleting weekly data:', error);
    res.status(500).json({ error: 'Failed to delete weekly data' });
  }
});

// 全組織の週単位データを統合して取得
app.get('/api/weekly-activities', (req, res) => {
  try {
    const { activities, organizations: orgStats } = dataService.loadAllOrganizationsWeeklyActivities();
    
    res.json({ 
      activities, 
      organizations: orgStats
    });
  } catch (error) {
    console.error('Error loading weekly activities:', error);
    res.status(500).json({ error: 'Failed to load weekly activities' });
  }
});

// 月毎データ取得のAPIエンドポイントを追加
app.get('/api/monthly-data/:orgName', (req, res) => {
  try {
    const { orgName } = req.params;
    const fetchedMonths = dataService.getFetchedMonths(orgName);
    
    res.json({ 
      organization: orgName,
      fetchedMonths,
      totalMonths: fetchedMonths.length
    });
  } catch (error) {
    console.error('Error loading monthly data:', error);
    res.status(500).json({ error: 'Failed to load monthly data' });
  }
});

// 月毎データを取得して保存
app.post('/api/fetch-monthly-data', async (req, res) => {
  try {
    const { orgName, monthStart, monthEnd, forceUpdate = false } = req.body;

    if (!orgName || !monthStart || !monthEnd) {
      return res.status(400).json({ 
        error: 'Organization name, month start, and month end are required' 
      });
    }

    // 既に取得済みの月かチェック
    const isAlreadyFetched = dataService.isMonthFetched(orgName, monthStart);
    if (isAlreadyFetched && !forceUpdate) {
      return res.status(409).json({ 
        error: 'Month data already exists',
        monthStart,
        monthEnd,
        alreadyFetched: true
      });
    }

    const dateRange: DateRange = { startDate: monthStart, endDate: monthEnd };
    
    console.log(`Fetching monthly data for ${orgName} from ${monthStart} to ${monthEnd} (forceUpdate: ${forceUpdate})`);
    
    const activities = await githubService.getAllMemberActivities(orgName, dateRange);
    dataService.saveMonthlyActivities(orgName, monthStart, monthEnd, activities);

    res.json({ 
      message: `Monthly data fetched and saved successfully for ${orgName}`,
      count: activities.length,
      lastUpdated: new Date().toISOString(),
      organization: orgName,
      monthStart,
      monthEnd,
      forceUpdate
    });
  } catch (error) {
    console.error('Error fetching monthly data:', error);
    res.status(500).json({ error: 'Failed to fetch monthly data' });
  }
});

// 月毎データを削除
app.delete('/api/monthly-data/:orgName/:monthStart', (req, res) => {
  try {
    const { orgName, monthStart } = req.params;
    
    const deleted = dataService.deleteMonthlyActivities(orgName, monthStart);
    
    if (deleted) {
      res.json({ 
        message: `Monthly data deleted successfully for ${orgName} month ${monthStart}`,
        organization: orgName,
        monthStart
      });
    } else {
      res.status(404).json({ 
        error: 'Monthly data not found',
        organization: orgName,
        monthStart
      });
    }
  } catch (error) {
    console.error('Error deleting monthly data:', error);
    res.status(500).json({ error: 'Failed to delete monthly data' });
  }
});

// 指定期間の月毎データを統合して取得
app.get('/api/monthly-activities', (req, res) => {
  try {
    const { startMonth, endMonth } = req.query;
    
    console.log('API /monthly-activities called with:', { startMonth, endMonth });
    
    if (!startMonth || !endMonth) {
      return res.status(400).json({ 
        error: 'Start month and end month are required' 
      });
    }

    const { activities, organizations: orgStats } = dataService.loadAllOrganizationsMonthlyActivities(startMonth as string, endMonth as string);
    
    console.log('API /monthly-activities result:', { 
      activitiesCount: activities.length, 
      organizations: Object.keys(orgStats),
      startMonth,
      endMonth
    });
    
    res.json({ 
      activities, 
      organizations: orgStats,
      startMonth,
      endMonth
    });
  } catch (error) {
    console.error('Error loading monthly activities:', error);
    res.status(500).json({ error: 'Failed to load monthly activities' });
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
}); 