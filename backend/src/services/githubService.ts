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
import { graphql } from '@octokit/graphql';

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
  private graphqlClient: any;

  constructor(token: string) {
    this.token = token;
    this.graphqlClient = graphql.defaults({
      headers: {
        authorization: `token ${this.token}`,
      },
    });
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

  /**
   * GraphQLでPR数・レビュー数を一括取得
   */
  async getPullRequestsAndReviewsGraphQL(orgName: string, dateRange: DateRange) {
    // 1年分の月リストを作成
    const months: string[] = [];
    let current = moment(dateRange.startDate).startOf('month');
    const end = moment(dateRange.endDate).endOf('month');
    while (current.isSameOrBefore(end)) {
      months.push(current.format('YYYY-MM'));
      current.add(1, 'month');
    }

    // 組織のリポジトリとメンバーをGraphQLで取得
    const query = `
      query($org: String!, $repoFirst: Int!, $prFirst: Int!, $reviewFirst: Int!) {
        organization(login: $org) {
          repositories(first: $repoFirst, orderBy: {field: UPDATED_AT, direction: DESC}) {
            nodes {
              name
              pullRequests(first: $prFirst, orderBy: {field: CREATED_AT, direction: DESC}) {
                nodes {
                  number
                  createdAt
                  author { login }
                  reviews(first: $reviewFirst) {
                    nodes {
                      author { login }
                      submittedAt
                    }
                  }
                }
              }
            }
          }
          membersWithRole(first: 100) {
            nodes {
              login
              name
              avatarUrl
            }
          }
        }
      }
    `;
    const variables = {
      org: orgName,
      repoFirst: 50, // 取得するリポジトリ数
      prFirst: 100,  // 各リポジトリのPR数
      reviewFirst: 50 // 各PRのレビュー数
    };
    const res = await this.graphqlClient(query, variables);

    // 月ごと・メンバーごとに集計
    const memberMap: {[login: string]: {name?: string, avatar_url: string, activities: any}} = {};
    for (const member of res.organization.membersWithRole.nodes) {
      memberMap[member.login] = {
        name: member.name,
        avatar_url: member.avatarUrl,
        activities: {}
      };
    }
    for (const repo of res.organization.repositories.nodes) {
      for (const pr of repo.pullRequests.nodes) {
        const prMonth = moment(pr.createdAt).format('YYYY-MM');
        if (memberMap[pr.author?.login]) {
          if (!memberMap[pr.author.login].activities[prMonth]) {
            memberMap[pr.author.login].activities[prMonth] = { issues: 0, pullRequests: 0, commits: 0, reviews: 0 };
          }
          memberMap[pr.author.login].activities[prMonth].pullRequests++;
        }
        for (const review of pr.reviews.nodes) {
          const reviewMonth = moment(review.submittedAt).format('YYYY-MM');
          if (memberMap[review.author?.login]) {
            if (!memberMap[review.author.login].activities[reviewMonth]) {
              memberMap[review.author.login].activities[reviewMonth] = { issues: 0, pullRequests: 0, commits: 0, reviews: 0 };
            }
            memberMap[review.author.login].activities[reviewMonth].reviews++;
          }
        }
      }
    }
    // MemberActivity[]形式に変換
    return Object.entries(memberMap).map(([login, v]) => ({ login, ...v }));
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
    const pullRequests = await this.getPullRequestsAndReviewsGraphQL(orgName, dateRange);
    
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
      const memberPRs = pullRequests.filter(pr => pr.login === member.login);
      memberPRs.forEach(pr => {
        const yearMonth = moment(pr.activities[Object.keys(pr.activities)[0]]).format('YYYY-MM');
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