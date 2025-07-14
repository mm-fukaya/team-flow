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

// 保存されたデータを取得
app.get('/api/activities', (req, res) => {
  try {
    const activities = dataService.loadMemberActivities();
    const lastUpdated = dataService.getLastUpdated();
    
    if (!activities) {
      return res.json({ activities: [], lastUpdated: null });
    }

    res.json({ activities, lastUpdated });
  } catch (error) {
    console.error('Error loading activities:', error);
    res.status(500).json({ error: 'Failed to load activities' });
  }
});

// データを取得して保存
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
    dataService.saveMemberActivities(activities);

    res.json({ 
      message: 'Data fetched and saved successfully',
      count: activities.length,
      lastUpdated: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching data:', error);
    res.status(500).json({ error: 'Failed to fetch data' });
  }
});

// 組織一覧を取得
app.get('/api/organizations', (req, res) => {
  res.json(organizations);
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
}); 