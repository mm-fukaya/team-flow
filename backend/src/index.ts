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
    const { orgName, startDate, endDate, testMode = false, targetMember } = req.body;

    if (!orgName || !startDate || !endDate) {
      return res.status(400).json({ 
        error: 'Organization name, start date, and end date are required' 
      });
    }

    const dateRange: DateRange = { startDate, endDate };
    
    console.log(`Fetching data for ${orgName} from ${startDate} to ${endDate} (testMode: ${testMode})${targetMember ? `, targetMember: ${targetMember}` : ''}`);
    
    const activities = await githubService.getAllMemberActivities(orgName, dateRange, testMode, targetMember);
    dataService.saveOrganizationActivities(orgName, activities);

    res.json({ 
      message: `Data fetched and saved successfully for ${orgName} (${testMode ? 'TEST MODE' : 'PRODUCTION MODE'})${targetMember ? `, targetMember: ${targetMember}` : ''}`,
      count: activities.length,
      lastUpdated: new Date().toISOString(),
      organization: orgName,
      testMode,
      targetMember
    });
  } catch (error) {
    console.error('Error fetching data:', error);
    res.status(500).json({ error: 'Failed to fetch data' });
  }
});

// 特定メンバーのデータを取得（テスト用）
app.post('/api/fetch-member-data', async (req, res) => {
  try {
    const { orgName, startDate, endDate, testMode = false, memberLogin = 'mm-kado' } = req.body;

    if (!orgName || !startDate || !endDate) {
      return res.status(400).json({ 
        error: 'Organization name, start date, and end date are required' 
      });
    }

    const dateRange: DateRange = { startDate, endDate };
    
    console.log(`Fetching data for member ${memberLogin} in ${orgName} from ${startDate} to ${endDate} (testMode: ${testMode})`);
    
    const activities = await githubService.getAllMemberActivities(orgName, dateRange, testMode, memberLogin);
    dataService.saveOrganizationActivities(orgName, activities);

    res.json({ 
      message: `Data fetched and saved successfully for member ${memberLogin} in ${orgName} (${testMode ? 'TEST MODE' : 'PRODUCTION MODE'})`,
      count: activities.length,
      lastUpdated: new Date().toISOString(),
      organization: orgName,
      memberLogin,
      testMode
    });
  } catch (error) {
    console.error('Error fetching member data:', error);
    res.status(500).json({ error: 'Failed to fetch member data' });
  }
});

// mm-kadoのデータを全ての組織から取得
app.post('/api/fetch-mm-kado-all-orgs', async (req, res) => {
  try {
    const { startDate, endDate, testMode = false, memberLogin = 'mm-kado' } = req.body;

    if (!startDate || !endDate) {
      return res.status(400).json({ 
        error: 'Start date and end date are required' 
      });
    }

    const dateRange: DateRange = { startDate, endDate };
    const results: { [key: string]: { count: number, success: boolean, error?: string } } = {};
    const allActivities: any[] = [];
    
    console.log(`Fetching data for member ${memberLogin} from all organizations from ${startDate} to ${endDate} (testMode: ${testMode})`);
    
    for (const org of organizations) {
      try {
        console.log(`Fetching data for member ${memberLogin} in organization: ${org.name}`);
        const activities = await githubService.getAllMemberActivities(org.name, dateRange, testMode, memberLogin);
        
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
      message: `Data fetched for member ${memberLogin} from all organizations (${testMode ? 'TEST MODE' : 'PRODUCTION MODE'})`,
      totalCount,
      lastUpdated: new Date().toISOString(),
      memberLogin,
      results,
      testMode
    });
  } catch (error) {
    console.error('Error fetching member data from all organizations:', error);
    res.status(500).json({ error: 'Failed to fetch member data from all organizations' });
  }
});

// 全組織のデータを一括取得
app.post('/api/fetch-all-organizations', async (req, res) => {
  try {
    const { startDate, endDate, testMode = false } = req.body;

    if (!startDate || !endDate) {
      return res.status(400).json({ 
        error: 'Start date and end date are required' 
      });
    }

    const dateRange: DateRange = { startDate, endDate };
    const results: { [key: string]: { count: number, success: boolean, error?: string } } = {};
    
    console.log(`Fetching data for all organizations from ${startDate} to ${endDate} (testMode: ${testMode})`);
    
    for (const org of organizations) {
      try {
        console.log(`Fetching data for organization: ${org.name}`);
        const activities = await githubService.getAllMemberActivities(org.name, dateRange, testMode);
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
      message: `Data fetched for all organizations (${testMode ? 'TEST MODE' : 'PRODUCTION MODE'})`,
      totalCount,
      lastUpdated: new Date().toISOString(),
      results,
      testMode
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
    const rateLimitInfo = githubService.getRateLimitInfo();
    res.json({ rateLimitInfo });
  } catch (error) {
    console.error('Error fetching rate limit info:', error);
    res.status(500).json({ error: 'Failed to fetch rate limit info' });
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
}); 