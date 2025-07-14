import axios, { AxiosResponse } from 'axios';
import moment from 'moment';
import { 
  GitHubUser, 
  GitHubIssue, 
  GitHubPullRequest, 
  GitHubCommit, 
  GitHubReview,
  MemberActivity,
  DateRange 
} from '../types';

interface RateLimitInfo {
  limit: number;
  remaining: number;
  reset: number;
}

export class GitHubService {
  private token: string;
  private baseURL = 'https://api.github.com';
  private rateLimitInfo: RateLimitInfo | null = null;
  private requestDelay = 1000; // 1秒間隔

  constructor(token: string) {
    this.token = token;
  }

  private getHeaders() {
    return {
      'Authorization': `token ${this.token}`,
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'GitStatus-App'
    };
  }

  private updateRateLimitInfo(response: AxiosResponse) {
    const limit = response.headers['x-ratelimit-limit'];
    const remaining = response.headers['x-ratelimit-remaining'];
    const reset = response.headers['x-ratelimit-reset'];

    if (limit && remaining && reset) {
      this.rateLimitInfo = {
        limit: parseInt(limit),
        remaining: parseInt(remaining),
        reset: parseInt(reset)
      };
    }
  }

  private async checkRateLimit(): Promise<void> {
    if (!this.rateLimitInfo) return;

    if (this.rateLimitInfo.remaining <= 10) {
      const now = Math.floor(Date.now() / 1000);
      const waitTime = this.rateLimitInfo.reset - now;
      
      if (waitTime > 0) {
        console.log(`Rate limit approaching. Waiting ${waitTime} seconds...`);
        await new Promise(resolve => setTimeout(resolve, (waitTime + 1) * 1000));
      }
    }
  }

  private async makeRequest<T>(url: string, params?: any): Promise<T> {
    await this.checkRateLimit();

    try {
      const response = await axios.get(url, {
        headers: this.getHeaders(),
        params
      });

      this.updateRateLimitInfo(response);

      // レート制限情報をログ出力
      if (this.rateLimitInfo) {
        console.log(`Rate limit: ${this.rateLimitInfo.remaining}/${this.rateLimitInfo.limit} remaining`);
      }

      // リクエスト間隔を設ける
      await new Promise(resolve => setTimeout(resolve, this.requestDelay));

      return response.data;
    } catch (error: any) {
      if (error.response?.status === 403 && error.response?.headers['x-ratelimit-remaining'] === '0') {
        const resetTime = error.response.headers['x-ratelimit-reset'];
        const waitTime = parseInt(resetTime) - Math.floor(Date.now() / 1000);
        
        console.log(`Rate limit exceeded. Waiting ${waitTime} seconds...`);
        await new Promise(resolve => setTimeout(resolve, (waitTime + 1) * 1000));
        
        // リトライ
        return this.makeRequest<T>(url, params);
      }
      
      throw error;
    }
  }

  async getOrganizationMembers(orgName: string): Promise<GitHubUser[]> {
    try {
      return await this.makeRequest<GitHubUser[]>(`${this.baseURL}/orgs/${orgName}/members`, {
        per_page: 100
      });
    } catch (error) {
      console.error(`Error fetching members for ${orgName}:`, error);
      throw error;
    }
  }

  async getRepositories(orgName: string): Promise<any[]> {
    try {
      return await this.makeRequest<any[]>(`${this.baseURL}/orgs/${orgName}/repos`, {
        per_page: 100
      });
    } catch (error) {
      console.error(`Error fetching repositories for ${orgName}:`, error);
      throw error;
    }
  }

  async getIssues(orgName: string, dateRange: DateRange): Promise<GitHubIssue[]> {
    const issues: GitHubIssue[] = [];
    const repos = await this.getRepositories(orgName);

    // 並列処理でリクエスト数を削減（最大5つずつ）
    const batchSize = 5;
    for (let i = 0; i < repos.length; i += batchSize) {
      const batch = repos.slice(i, i + batchSize);
      const promises = batch.map(async (repo) => {
        try {
          return await this.makeRequest<GitHubIssue[]>(`${this.baseURL}/repos/${orgName}/${repo.name}/issues`, {
            state: 'all',
            since: dateRange.startDate,
            per_page: 100
          });
        } catch (error) {
          console.error(`Error fetching issues for ${repo.name}:`, error);
          return [];
        }
      });

      const results = await Promise.all(promises);
      results.forEach(result => issues.push(...result));
    }

    return issues;
  }

  async getPullRequests(orgName: string, dateRange: DateRange): Promise<GitHubPullRequest[]> {
    const pullRequests: GitHubPullRequest[] = [];
    const repos = await this.getRepositories(orgName);

    // 並列処理でリクエスト数を削減（最大5つずつ）
    const batchSize = 5;
    for (let i = 0; i < repos.length; i += batchSize) {
      const batch = repos.slice(i, i + batchSize);
      const promises = batch.map(async (repo) => {
        try {
          const data = await this.makeRequest<GitHubPullRequest[]>(`${this.baseURL}/repos/${orgName}/${repo.name}/pulls`, {
            state: 'all',
            per_page: 100
          });
          
          // 日付範囲でフィルタリング
          return data.filter((pr: GitHubPullRequest) => {
            const createdAt = moment(pr.created_at);
            return createdAt.isBetween(dateRange.startDate, dateRange.endDate, 'day', '[]');
          });
        } catch (error) {
          console.error(`Error fetching pull requests for ${repo.name}:`, error);
          return [];
        }
      });

      const results = await Promise.all(promises);
      results.forEach(result => pullRequests.push(...result));
    }

    return pullRequests;
  }

  async getCommits(orgName: string, dateRange: DateRange): Promise<GitHubCommit[]> {
    const commits: GitHubCommit[] = [];
    const repos = await this.getRepositories(orgName);

    // 並列処理でリクエスト数を削減（最大5つずつ）
    const batchSize = 5;
    for (let i = 0; i < repos.length; i += batchSize) {
      const batch = repos.slice(i, i + batchSize);
      const promises = batch.map(async (repo) => {
        try {
          return await this.makeRequest<GitHubCommit[]>(`${this.baseURL}/repos/${orgName}/${repo.name}/commits`, {
            since: dateRange.startDate,
            until: dateRange.endDate,
            per_page: 100
          });
        } catch (error) {
          console.error(`Error fetching commits for ${repo.name}:`, error);
          return [];
        }
      });

      const results = await Promise.all(promises);
      results.forEach(result => commits.push(...result));
    }

    return commits;
  }

  async getReviews(orgName: string, dateRange: DateRange): Promise<GitHubReview[]> {
    const reviews: GitHubReview[] = [];
    const repos = await this.getRepositories(orgName);

    // 並列処理でリクエスト数を削減（最大5つずつ）
    const batchSize = 5;
    for (let i = 0; i < repos.length; i += batchSize) {
      const batch = repos.slice(i, i + batchSize);
      const promises = batch.map(async (repo) => {
        try {
          const data = await this.makeRequest<GitHubReview[]>(`${this.baseURL}/repos/${orgName}/${repo.name}/pulls/reviews`, {
            per_page: 100
          });
          
          // 日付範囲でフィルタリング
          return data.filter((review: GitHubReview) => {
            const submittedAt = moment(review.submitted_at);
            return submittedAt.isBetween(dateRange.startDate, dateRange.endDate, 'day', '[]');
          });
        } catch (error) {
          console.error(`Error fetching reviews for ${repo.name}:`, error);
          return [];
        }
      });

      const results = await Promise.all(promises);
      results.forEach(result => reviews.push(...result));
    }

    return reviews;
  }

  async getAllMemberActivities(orgName: string, dateRange: DateRange): Promise<MemberActivity[]> {
    console.log('Fetching organization members...');
    const members = await this.getOrganizationMembers(orgName);
    
    console.log('Fetching issues...');
    const issues = await this.getIssues(orgName, dateRange);
    
    console.log('Fetching pull requests...');
    const pullRequests = await this.getPullRequests(orgName, dateRange);
    
    console.log('Fetching commits...');
    const commits = await this.getCommits(orgName, dateRange);
    
    console.log('Fetching reviews...');
    const reviews = await this.getReviews(orgName, dateRange);

    console.log('Processing member activities...');
    const memberActivities: MemberActivity[] = [];

    for (const member of members) {
      const activities: { [yearMonth: string]: { issues: number; pullRequests: number; commits: number; reviews: number } } = {};

      // イシューを月別に集計
      const memberIssues = issues.filter(issue => issue.user.login === member.login);
      memberIssues.forEach(issue => {
        const yearMonth = moment(issue.created_at).format('YYYY-MM');
        if (!activities[yearMonth]) {
          activities[yearMonth] = { issues: 0, pullRequests: 0, commits: 0, reviews: 0 };
        }
        activities[yearMonth].issues++;
      });

      // プルリクエストを月別に集計
      const memberPRs = pullRequests.filter(pr => pr.user.login === member.login);
      memberPRs.forEach(pr => {
        const yearMonth = moment(pr.created_at).format('YYYY-MM');
        if (!activities[yearMonth]) {
          activities[yearMonth] = { issues: 0, pullRequests: 0, commits: 0, reviews: 0 };
        }
        activities[yearMonth].pullRequests++;
      });

      // コミットを月別に集計
      const memberCommits = commits.filter(commit => 
        commit.author && commit.author.login === member.login
      );
      memberCommits.forEach(commit => {
        const yearMonth = moment(commit.commit.author.date).format('YYYY-MM');
        if (!activities[yearMonth]) {
          activities[yearMonth] = { issues: 0, pullRequests: 0, commits: 0, reviews: 0 };
        }
        activities[yearMonth].commits++;
      });

      // レビューを月別に集計
      const memberReviews = reviews.filter(review => review.user.login === member.login);
      memberReviews.forEach(review => {
        const yearMonth = moment(review.submitted_at).format('YYYY-MM');
        if (!activities[yearMonth]) {
          activities[yearMonth] = { issues: 0, pullRequests: 0, commits: 0, reviews: 0 };
        }
        activities[yearMonth].reviews++;
      });

      memberActivities.push({
        login: member.login,
        name: member.name,
        avatar_url: member.avatar_url,
        activities
      });
    }

    console.log('Member activities processing completed.');
    return memberActivities;
  }

  // レート制限情報を取得
  getRateLimitInfo(): RateLimitInfo | null {
    return this.rateLimitInfo;
  }
} 