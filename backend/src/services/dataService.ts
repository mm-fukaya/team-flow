import fs from 'fs';
import path from 'path';
import { MemberActivity } from '../types';

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