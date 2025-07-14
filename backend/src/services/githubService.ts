import axios from 'axios';
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

export class GitHubService {
  private token: string;
  private baseURL = 'https://api.github.com';

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

  async getOrganizationMembers(orgName: string): Promise<GitHubUser[]> {
    try {
      const response = await axios.get(`${this.baseURL}/orgs/${orgName}/members`, {
        headers: this.getHeaders(),
        params: { per_page: 100 }
      });
      return response.data;
    } catch (error) {
      console.error(`Error fetching members for ${orgName}:`, error);
      throw error;
    }
  }

  async getRepositories(orgName: string): Promise<any[]> {
    try {
      const response = await axios.get(`${this.baseURL}/orgs/${orgName}/repos`, {
        headers: this.getHeaders(),
        params: { per_page: 100 }
      });
      return response.data;
    } catch (error) {
      console.error(`Error fetching repositories for ${orgName}:`, error);
      throw error;
    }
  }

  async getIssues(orgName: string, dateRange: DateRange): Promise<GitHubIssue[]> {
    const issues: GitHubIssue[] = [];
    const repos = await this.getRepositories(orgName);

    for (const repo of repos) {
      try {
        const response = await axios.get(`${this.baseURL}/repos/${orgName}/${repo.name}/issues`, {
          headers: this.getHeaders(),
          params: {
            state: 'all',
            since: dateRange.startDate,
            per_page: 100
          }
        });
        issues.push(...response.data);
      } catch (error) {
        console.error(`Error fetching issues for ${repo.name}:`, error);
      }
    }

    return issues;
  }

  async getPullRequests(orgName: string, dateRange: DateRange): Promise<GitHubPullRequest[]> {
    const pullRequests: GitHubPullRequest[] = [];
    const repos = await this.getRepositories(orgName);

    for (const repo of repos) {
      try {
        const response = await axios.get(`${this.baseURL}/repos/${orgName}/${repo.name}/pulls`, {
          headers: this.getHeaders(),
          params: {
            state: 'all',
            per_page: 100
          }
        });
        
        // 日付範囲でフィルタリング
        const filteredPRs = response.data.filter((pr: GitHubPullRequest) => {
          const createdAt = moment(pr.created_at);
          return createdAt.isBetween(dateRange.startDate, dateRange.endDate, 'day', '[]');
        });
        
        pullRequests.push(...filteredPRs);
      } catch (error) {
        console.error(`Error fetching pull requests for ${repo.name}:`, error);
      }
    }

    return pullRequests;
  }

  async getCommits(orgName: string, dateRange: DateRange): Promise<GitHubCommit[]> {
    const commits: GitHubCommit[] = [];
    const repos = await this.getRepositories(orgName);

    for (const repo of repos) {
      try {
        const response = await axios.get(`${this.baseURL}/repos/${orgName}/${repo.name}/commits`, {
          headers: this.getHeaders(),
          params: {
            since: dateRange.startDate,
            until: dateRange.endDate,
            per_page: 100
          }
        });
        commits.push(...response.data);
      } catch (error) {
        console.error(`Error fetching commits for ${repo.name}:`, error);
      }
    }

    return commits;
  }

  async getReviews(orgName: string, dateRange: DateRange): Promise<GitHubReview[]> {
    const reviews: GitHubReview[] = [];
    const repos = await this.getRepositories(orgName);

    for (const repo of repos) {
      try {
        const response = await axios.get(`${this.baseURL}/repos/${orgName}/${repo.name}/pulls/reviews`, {
          headers: this.getHeaders(),
          params: {
            per_page: 100
          }
        });
        
        // 日付範囲でフィルタリング
        const filteredReviews = response.data.filter((review: GitHubReview) => {
          const submittedAt = moment(review.submitted_at);
          return submittedAt.isBetween(dateRange.startDate, dateRange.endDate, 'day', '[]');
        });
        
        reviews.push(...filteredReviews);
      } catch (error) {
        console.error(`Error fetching reviews for ${repo.name}:`, error);
      }
    }

    return reviews;
  }

  async getAllMemberActivities(orgName: string, dateRange: DateRange): Promise<MemberActivity[]> {
    const members = await this.getOrganizationMembers(orgName);
    const issues = await this.getIssues(orgName, dateRange);
    const pullRequests = await this.getPullRequests(orgName, dateRange);
    const commits = await this.getCommits(orgName, dateRange);
    const reviews = await this.getReviews(orgName, dateRange);

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

    return memberActivities;
  }
} 