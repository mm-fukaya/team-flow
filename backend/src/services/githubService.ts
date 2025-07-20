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
  private requestDelay = 1000; // 1秒間隔（レート制限を回避）
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
      let allRepos: any[] = [];
      let page = 1;
      let hasMore = true;
      const perPage = 100;

      // ページネーションで全リポジトリを取得
      while (hasMore && page <= 10) { // 最大10ページ（1000個のリポジトリ）
        const repos = await this.makeRequest<any[]>(`${this.baseURL}/orgs/${orgName}/repos`, {
          per_page: perPage,
          page: page,
          sort: 'updated', // 更新日順で取得
          direction: 'desc'
        });
        
        allRepos.push(...repos);
        
        // 次のページがあるかチェック
        hasMore = repos.length === perPage;
        page++;
      }

      console.log(`リポジトリ取得: ${allRepos.length}個のリポジトリを取得`);
      return allRepos;
    } catch (error) {
      console.error(`Error fetching repositories for ${orgName}:`, error);
      throw error;
    }
  }

  async getIssues(orgName: string, dateRange: DateRange, targetMember?: string): Promise<GitHubIssue[]> {
    const issues: GitHubIssue[] = [];
    const repos = await this.getRepositories(orgName);

    console.log(`イシュー取得: ${repos.length}個のリポジトリから、各5000個ずつ（最大50ページ）`);
    if (targetMember) {
      console.log(`特定メンバー指定: ${targetMember}`);
    }
    console.log(`期間: ${dateRange.startDate} から ${dateRange.endDate}`);
    console.log(`フィルタリング期間: ${moment(dateRange.startDate).startOf('day').format('YYYY-MM-DD HH:mm:ss')} から ${moment(dateRange.endDate).endOf('day').format('YYYY-MM-DD HH:mm:ss')}`);

    // 並列処理でリクエスト数を削減（最大10つずつ）
    const batchSize = 10;
    for (let i = 0; i < repos.length; i += batchSize) {
      const batch = repos.slice(i, i + batchSize);
      const promises = batch.map(async (repo) => {
        try {
          let allRepoIssues: GitHubIssue[] = [];
          let page = 1;
          let hasMore = true;

          // 特定メンバーが指定されている場合は、そのメンバーのイシューのみを取得
          const params: any = {
            state: 'all',
            since: dateRange.startDate,
            per_page: 100,
            page: page
          };
          
          if (targetMember) {
            params.creator = targetMember;
          }

          // ページネーションで全データを取得
          while (hasMore && page <= 50) { // 最大50ページ
            const repoIssues = await this.makeRequest<GitHubIssue[]>(`${this.baseURL}/repos/${orgName}/${repo.name}/issues`, params);
            
            allRepoIssues.push(...repoIssues);
            
            // 次のページがあるかチェック
            hasMore = repoIssues.length === 100;
            page++;
            params.page = page;
          }
          
          // 期間内のイシューのみをフィルタリング
          const filteredIssues = allRepoIssues.filter(issue => {
            const issueDate = moment(issue.created_at);
            const startDate = moment(dateRange.startDate).startOf('day');
            const endDate = moment(dateRange.endDate).endOf('day');
            return issueDate.isBetween(startDate, endDate, 'day', '[]');
          });
          
          console.log(`${repo.name}: ${allRepoIssues.length}個取得、${filteredIssues.length}個が期間内`);
          return filteredIssues;
        } catch (error: any) {
          console.error(`Error fetching issues for ${repo.name}:`, error);
          if (error.response?.status === 404) {
            console.log(`Repository ${repo.name} not found, skipping...`);
          }
          return [];
        }
      });

      const results = await Promise.all(promises);
      results.forEach(result => issues.push(...result));
    }

    console.log(`総イシュー数: ${issues.length}個`);
    return issues;
  }

  /**
   * GraphQLでPR数・レビュー数を一括取得（テストモード対応）
   */
  async getPullRequestsAndReviewsGraphQL(orgName: string, dateRange: DateRange, targetMember?: string) {
    // 1年分の月リストを作成
    const months: string[] = [];
    let current = moment(dateRange.startDate).startOf('month');
    const end = moment(dateRange.endDate).endOf('month');
    while (current.isSameOrBefore(end)) {
      months.push(current.format('YYYY-MM'));
      current.add(1, 'month');
    }

    // 制限を設定（全データ取得）
    const repoLimit = 100;   // 100個のリポジトリを一度に取得
    const prLimit = 1000;    // 各リポジトリから1000個のPRを一度に取得
    const reviewLimit = 1000; // 各PRから1000個のレビューを一度に取得

    console.log(`GraphQL取得設定: リポジトリ=${repoLimit}個/回, PR=${prLimit}個/回, レビュー=${reviewLimit}個/回 (ページネーション対応)`);
    if (targetMember) {
      console.log(`特定メンバー指定: ${targetMember}`);
    }
    console.log(`フィルタリング期間: ${moment(dateRange.startDate).startOf('day').format('YYYY-MM-DD HH:mm:ss')} から ${moment(dateRange.endDate).endOf('day').format('YYYY-MM-DD HH:mm:ss')}`);

    // ページネーション対応のGraphQLクエリ
    const query = `
      query($org: String!, $repoFirst: Int!, $repoAfter: String, $prFirst: Int!, $prAfter: String, $reviewFirst: Int!, $reviewAfter: String) {
        organization(login: $org) {
          repositories(first: $repoFirst, after: $repoAfter, orderBy: {field: UPDATED_AT, direction: DESC}) {
            pageInfo {
              hasNextPage
              endCursor
            }
            nodes {
              name
              pullRequests(first: $prFirst, after: $prAfter, orderBy: {field: UPDATED_AT, direction: DESC}) {
                pageInfo {
                  hasNextPage
                  endCursor
                }
                nodes {
                  number
                  createdAt
                  author { login }
                  reviews(first: $reviewFirst, after: $reviewAfter, orderBy: {field: CREATED_AT, direction: DESC}) {
                    pageInfo {
                      hasNextPage
                      endCursor
                    }
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

    // 月ごと・メンバーごとに集計
    const memberMap: {[login: string]: {name?: string, avatar_url: string, activities: any}} = {};
    
    // 全メンバーを対象とする
    const allMembers = await this.getOrganizationMembers(orgName);
    for (const member of allMembers) {
      memberMap[member.login] = {
        name: member.name,
        avatar_url: member.avatar_url,
        activities: {}
      };
    }
    
    let totalPRs = 0;
    let totalReviews = 0;
    let totalRepos = 0;
    let repoCursor: string | null = null;
    let hasMoreRepos = true;
    let repoPageCount = 0;
    const maxRepoPages = 100; // 最大100ページ（10000個のリポジトリ）

    console.log('=== リポジトリ取得開始 ===');

    // リポジトリのページネーション（制限なしで全リポジトリを取得）
    while (hasMoreRepos && repoPageCount < maxRepoPages) {
      const variables: any = {
        org: orgName,
        repoFirst: repoLimit,
        repoAfter: repoCursor,
        prFirst: prLimit,
        prAfter: null,
        reviewFirst: reviewLimit,
        reviewAfter: null
      };

      let res;
      let retryCount = 0;
      const maxRetries = 3;
      
      while (retryCount < maxRetries) {
        try {
          res = await this.graphqlClient(query, variables);
          break;
        } catch (error: any) {
          retryCount++;
          console.log(`GraphQL request failed (attempt ${retryCount}/${maxRetries}):`, error.message);
          
          if (retryCount >= maxRetries) {
            throw error;
          }
          
          // 指数バックオフで待機
          const waitTime = Math.pow(2, retryCount) * 1000;
          console.log(`Waiting ${waitTime}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }
      }

      if (!res?.organization?.repositories) {
        console.log('No repositories found or GraphQL error');
        break;
      }

      const repos = res.organization.repositories.nodes;
      const repoPageInfo: any = res.organization.repositories.pageInfo;
      
      totalRepos += repos.length;
      repoPageCount++;
      console.log(`リポジトリページ ${repoPageCount}: ${repos.length}個取得 (累計: ${totalRepos}個)`);

      // 各リポジトリのPRを処理
      for (const repo of repos) {
        if (!repo.pullRequests) continue;

        let prCursor: string | null = null;
        let hasMorePRs = true;
        let prPageCount = 0;
        let repoPRCount = 0;
        const maxPRPages = 50; // 最大50ページ（5000個のPR）

        console.log(`  ${repo.name}: PR取得開始`);

        // PRのページネーション（制限なしで全PRを取得）
        while (hasMorePRs && prPageCount < maxPRPages) {
          const prVariables: any = {
            org: orgName,
            repoFirst: 1,
            repoAfter: null,
            prFirst: prLimit,
            prAfter: prCursor,
            reviewFirst: reviewLimit,
            reviewAfter: null
          };

          let prRes;
          try {
            prRes = await this.graphqlClient(query, prVariables);
          } catch (error: any) {
            console.log(`PR GraphQL request failed for ${repo.name}:`, error.message);
            break;
          }

          if (!prRes?.organization?.repositories?.nodes?.[0]?.pullRequests) {
            break;
          }

          const prs = prRes.organization.repositories.nodes[0].pullRequests.nodes;
          const prPageInfo: any = prRes.organization.repositories.nodes[0].pullRequests.pageInfo;

          repoPRCount += prs.length;
          prPageCount++;
          console.log(`    PRページ ${prPageCount}: ${prs.length}個取得 (累計: ${repoPRCount}個)`);

          // 各PRのレビューを処理
          for (const pr of prs) {
            const prDate = moment(pr.createdAt);
            // 期間内のPRのみをカウント
            const startDate = moment(dateRange.startDate).startOf('day');
            const endDate = moment(dateRange.endDate).endOf('day');
            
            if (prDate.isBetween(startDate, endDate, 'day', '[]')) {
              const prMonth = prDate.format('YYYY-MM');
              
              // 特定メンバーが指定されている場合は、そのメンバーのPRのみをカウント
              if (targetMember) {
                if (pr.author?.login === targetMember && memberMap[targetMember]) {
                  if (!memberMap[targetMember].activities[prMonth]) {
                    memberMap[targetMember].activities[prMonth] = { issues: 0, pullRequests: 0, commits: 0, reviews: 0 };
                  }
                  memberMap[targetMember].activities[prMonth].pullRequests++;
                  totalPRs++;
                }
              } else {
                if (memberMap[pr.author?.login]) {
                  if (!memberMap[pr.author.login].activities[prMonth]) {
                    memberMap[pr.author.login].activities[prMonth] = { issues: 0, pullRequests: 0, commits: 0, reviews: 0 };
                  }
                  memberMap[pr.author.login].activities[prMonth].pullRequests++;
                  totalPRs++;
                }
              }
            }

            // レビューの処理
            if (pr.reviews) {
              let reviewCursor: string | null = null;
              let hasMoreReviews = true;
                      let reviewPageCount = 0;
        let prReviewCount = 0;
        const maxReviewPages = 20; // 最大20ページ（2000個のレビュー）

              // レビューのページネーション（制限なしで全レビューを取得）
              while (hasMoreReviews && reviewPageCount < maxReviewPages) {
                const reviewVariables: any = {
                  org: orgName,
                  repoFirst: 1,
                  repoAfter: null,
                  prFirst: 1,
                  prAfter: null,
                  reviewFirst: reviewLimit,
                  reviewAfter: reviewCursor
                };

                let reviewRes;
                try {
                  reviewRes = await this.graphqlClient(query, reviewVariables);
                } catch (error: any) {
                  console.log(`Review GraphQL request failed for PR #${pr.number}:`, error.message);
                  break;
                }

                if (!reviewRes?.organization?.repositories?.nodes?.[0]?.pullRequests?.nodes?.[0]?.reviews) {
                  break;
                }

                const reviews = reviewRes.organization.repositories.nodes[0].pullRequests.nodes[0].reviews.nodes;
                const reviewPageInfo: any = reviewRes.organization.repositories.nodes[0].pullRequests.nodes[0].reviews.pageInfo;

                prReviewCount += reviews.length;
                reviewPageCount++;

                for (const review of reviews) {
                  const reviewDate = moment(review.submittedAt);
                  // 期間内のレビューのみをカウント
                  if (reviewDate.isBetween(startDate, endDate, 'day', '[]')) {
                    const reviewMonth = reviewDate.format('YYYY-MM');
                    
                    // 特定メンバーが指定されている場合は、そのメンバーのレビューのみをカウント
                    if (targetMember) {
                      if (review.author?.login === targetMember && memberMap[targetMember]) {
                        if (!memberMap[targetMember].activities[reviewMonth]) {
                          memberMap[targetMember].activities[reviewMonth] = { issues: 0, pullRequests: 0, commits: 0, reviews: 0 };
                        }
                        memberMap[targetMember].activities[reviewMonth].reviews++;
                        totalReviews++;
                      }
                    } else {
                      if (memberMap[review.author?.login]) {
                        if (!memberMap[review.author.login].activities[reviewMonth]) {
                          memberMap[review.author.login].activities[reviewMonth] = { issues: 0, pullRequests: 0, commits: 0, reviews: 0 };
                        }
                        memberMap[review.author.login].activities[reviewMonth].reviews++;
                        totalReviews++;
                      }
                    }
                  }
                }

                hasMoreReviews = reviewPageInfo.hasNextPage;
                reviewCursor = reviewPageInfo.endCursor;

                // レート制限を避けるため少し待機
                await new Promise(resolve => setTimeout(resolve, 100));
              }

              if (prReviewCount > 0) {
                console.log(`      PR #${pr.number}: レビュー ${prReviewCount}個取得 (${reviewPageCount}ページ)`);
              }
            }
          }

          hasMorePRs = prPageInfo.hasNextPage;
          prCursor = prPageInfo.endCursor;

          // レート制限を避けるため少し待機
          await new Promise(resolve => setTimeout(resolve, 100));
        }

        console.log(`  ${repo.name}: PR ${repoPRCount}個取得完了 (${prPageCount}ページ)`);
      }

      hasMoreRepos = repoPageInfo.hasNextPage;
      repoCursor = repoPageInfo.endCursor;

      // レート制限を避けるため少し待機
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    
    console.log('=== 取得完了 ===');
    console.log(`総リポジトリ数: ${totalRepos}個 (${repoPageCount}ページ)`);
    console.log(`総PR数: ${totalPRs}個`);
    console.log(`総レビュー数: ${totalReviews}個`);
    
    // MemberActivity[]形式に変換
    return Object.entries(memberMap).map(([login, v]) => ({ login, ...v }));
  }

  /**
   * REST APIでPR数を取得（GraphQLのフォールバック）
   */
  async getPullRequestsREST(orgName: string, dateRange: DateRange, targetMember?: string): Promise<any[]> {
    const pullRequests: any[] = [];
    const repos = await this.getRepositories(orgName);

    // テストモードの場合は最新の3個のリポジトリのみ使用
    const targetRepos = repos; // 制限なしで全リポジトリを取得
    const perPage = 100;

    console.log(`REST API PR取得: ${targetRepos.length}個のリポジトリから、各${perPage}個ずつ (ページネーション対応)`);
    if (targetMember) {
      console.log(`特定メンバー指定: ${targetMember}`);
    }

    let totalRepos = 0;
    let totalPRs = 0;

    // 並列処理でリクエスト数を削減（最大10つずつ）
    const batchSize = 10;
    for (let i = 0; i < targetRepos.length; i += batchSize) {
      const batch = targetRepos.slice(i, i + batchSize);
      const promises = batch.map(async (repo) => {
        try {
          let allRepoPRs: any[] = [];
          let page = 1;
          let hasMore = true;
          let repoPRCount = 0;
          const maxPages = 50; // 最大50ページ（5000個のPR）

          // 特定メンバーが指定されている場合は、そのメンバーのPRのみを取得
          const params: any = {
            state: 'all',
            per_page: perPage,
            page: page
          };
          
          if (targetMember) {
            params.author = targetMember;
          }

          console.log(`  ${repo.name}: PR取得開始`);

          // ページネーションで全データを取得
          while (hasMore && page <= maxPages) {
            const repoPRs = await this.makeRequest<any[]>(`${this.baseURL}/repos/${orgName}/${repo.name}/pulls`, params);
            
            allRepoPRs.push(...repoPRs);
            repoPRCount += repoPRs.length;
            
            console.log(`    ${repo.name}: PRページ ${page}: ${repoPRs.length}個取得 (累計: ${repoPRCount}個)`);
            
            // 次のページがあるかチェック
            hasMore = repoPRs.length === perPage;
            page++;
            params.page = page;

            // レート制限を避けるため少し待機
            await new Promise(resolve => setTimeout(resolve, 100));
          }
          
          // 期間内のPRのみをフィルタリング
          const filteredPRs = allRepoPRs.filter(pr => {
            const prDate = moment(pr.created_at);
            const startDate = moment(dateRange.startDate).startOf('day');
            const endDate = moment(dateRange.endDate).endOf('day');
            return prDate.isBetween(startDate, endDate, 'day', '[]');
          });
          
          console.log(`  ${repo.name}: ${allRepoPRs.length}個取得、${filteredPRs.length}個が期間内 (${page - 1}ページ)`);
          return filteredPRs;
        } catch (error: any) {
          console.error(`Error fetching PRs for ${repo.name}:`, error);
          if (error.response?.status === 404) {
            console.log(`Repository ${repo.name} not found, skipping...`);
          }
          return [];
        }
      });

      const results = await Promise.all(promises);
      results.forEach(result => pullRequests.push(...result));
      
      totalRepos += batch.length;
      totalPRs += pullRequests.length;
      console.log(`バッチ処理完了: ${totalRepos}/${targetRepos.length} リポジトリ (累計PR: ${totalPRs}個)`);
    }

    console.log(`REST API取得完了: 総PR数: ${pullRequests.length}個`);
    return pullRequests;
  }

  async getCommits(orgName: string, dateRange: DateRange, targetMember?: string): Promise<GitHubCommit[]> {
    const commits: GitHubCommit[] = [];
    const repos = await this.getRepositories(orgName);

    // テストモードの場合は最新の3個のリポジトリのみ使用
    const targetRepos = repos; // 制限なしで全リポジトリを取得
    const perPage = 100; // テスト時は各リポジトリから10個のコミットのみ

    console.log(`コミット取得: ${targetRepos.length}個のリポジトリから、各${perPage}個ずつ (最大100ページ、10000個まで)`);
    if (targetMember) {
      console.log(`特定メンバー指定: ${targetMember}`);
    }

    let totalRepos = 0;
    let totalCommits = 0;

    // 並列処理でリクエスト数を削減（最大10つずつ）
    const batchSize = 10;
    for (let i = 0; i < targetRepos.length; i += batchSize) {
      const batch = targetRepos.slice(i, i + batchSize);
      const promises = batch.map(async (repo) => {
        try {
          let allRepoCommits: GitHubCommit[] = [];
          let page = 1;
          let hasMore = true;
          let repoCommitCount = 0;
          const maxPages = 100; // 最大100ページ（10000個のコミット）

          // 特定メンバーが指定されている場合は、そのメンバーのコミットのみを取得
          const params: any = {
            since: dateRange.startDate,
            until: dateRange.endDate,
            per_page: perPage,
            page: page
          };
          
          if (targetMember) {
            params.author = targetMember;
          }

          console.log(`  ${repo.name}: コミット取得開始`);

          // ページネーションで全データを取得
          while (hasMore && page <= maxPages) {
            const repoCommits = await this.makeRequest<GitHubCommit[]>(`${this.baseURL}/repos/${orgName}/${repo.name}/commits`, params);
            
            allRepoCommits.push(...repoCommits);
            repoCommitCount += repoCommits.length;
            
            console.log(`    ${repo.name}: コミットページ ${page}: ${repoCommits.length}個取得 (累計: ${repoCommitCount}個)`);
            
            // 次のページがあるかチェック
            hasMore = repoCommits.length === perPage;
            page++;
            params.page = page;

            // レート制限を避けるため少し待機
            await new Promise(resolve => setTimeout(resolve, 100));
          }
          
          // 期間内のコミットのみをフィルタリング
          const filteredCommits = allRepoCommits.filter(commit => {
            const commitDate = moment(commit.commit.author.date);
            const startDate = moment(dateRange.startDate).startOf('day');
            const endDate = moment(dateRange.endDate).endOf('day');
            return commitDate.isBetween(startDate, endDate, 'day', '[]');
          });
          
          console.log(`  ${repo.name}: ${allRepoCommits.length}個取得、${filteredCommits.length}個が期間内 (${page - 1}ページ)`);
          return filteredCommits;
        } catch (error: any) {
          console.error(`Error fetching commits for ${repo.name}:`, error);
          if (error.response?.status === 404) {
            console.log(`Repository ${repo.name} not found, skipping...`);
          }
          return [];
        }
      });

      const results = await Promise.all(promises);
      results.forEach(result => commits.push(...result));
      
      totalRepos += batch.length;
      totalCommits += commits.length;
      console.log(`バッチ処理完了: ${totalRepos}/${targetRepos.length} リポジトリ (累計コミット: ${totalCommits}個)`);
    }

    console.log(`コミット取得完了: 総コミット数: ${commits.length}個`);
    return commits;
  }

  async getReviews(orgName: string, pullRequests: any[], dateRange: DateRange): Promise<GitHubReview[]> {
    const reviews: GitHubReview[] = [];

    console.log(`レビュー取得開始: ${pullRequests.length}個のPRからレビューを取得 (最大50ページ、5000個まで)`);

    let totalPRs = 0;
    let totalReviews = 0;

    const batchSize = 10;
    for (let i = 0; i < pullRequests.length; i += batchSize) {
      const batch = pullRequests.slice(i, i + batchSize);
      const promises = batch.map(async (pr) => {
        const repoName = pr.base?.repo?.name;
        if (!repoName) return [] as GitHubReview[];
        try {
          let page = 1;
          let hasMore = true;
          const prReviews: GitHubReview[] = [];
          let prReviewCount = 0;
          const maxPages = 50; // 最大50ページ（5000個のレビュー）

          console.log(`  PR #${pr.number} (${repoName}): レビュー取得開始`);

          while (hasMore && page <= maxPages) {
            const data = await this.makeRequest<GitHubReview[]>(`${this.baseURL}/repos/${orgName}/${repoName}/pulls/${pr.number}/reviews`, {
              per_page: 100,
              page
            });
            
            prReviews.push(...data);
            prReviewCount += data.length;
            
            console.log(`    PR #${pr.number}: レビューページ ${page}: ${data.length}個取得 (累計: ${prReviewCount}個)`);
            
            hasMore = data.length === 100;
            page++;

            // レート制限を避けるため少し待機
            await new Promise(resolve => setTimeout(resolve, 100));
          }

          const filteredReviews = prReviews.filter((review: GitHubReview) => {
            const submittedAt = moment(review.submitted_at);
            return submittedAt.isBetween(dateRange.startDate, dateRange.endDate, 'day', '[]');
          });

          console.log(`  PR #${pr.number}: ${prReviewCount}個取得、${filteredReviews.length}個が期間内 (${page - 1}ページ)`);
          return filteredReviews;
        } catch (error) {
          console.error(`Error fetching reviews for ${repoName} PR #${pr.number}:`, error);
          return [];
        }
      });

      const results = await Promise.all(promises);
      results.forEach(result => reviews.push(...result));
      
      totalPRs += batch.length;
      totalReviews += reviews.length;
      console.log(`バッチ処理完了: ${totalPRs}/${pullRequests.length} PR (累計レビュー: ${totalReviews}個)`);
    }

    console.log(`レビュー取得完了: 総レビュー数: ${reviews.length}個`);
    return reviews;
  }

  async getAllMemberActivities(orgName: string, dateRange: DateRange, targetMember?: string): Promise<MemberActivity[]> {
    console.log(`=== データ取得開始 (本番モード) ===`);
    if (targetMember) {
      console.log(`特定メンバー指定: ${targetMember}`);
    }
    
    console.log('Fetching organization members...');
    const members = await this.getOrganizationMembers(orgName);
    
    // 特定のメンバーが指定されている場合、そのメンバーのみを対象とする
    const targetMembers = targetMember 
      ? members.filter(member => member.login === targetMember)
      : members;
    
    if (targetMember && targetMembers.length === 0) {
      console.log(`指定されたメンバー ${targetMember} が見つかりません`);
      return [];
    }
    
    console.log('Fetching issues...');
    const issues = await this.getIssues(orgName, dateRange, targetMember);
    
    console.log('Fetching pull requests and reviews...');
    let pullRequests: any[] = [];
    try {
      // まずGraphQLで試行
      pullRequests = await this.getPullRequestsAndReviewsGraphQL(orgName, dateRange, targetMember);
      console.log('GraphQL取得成功');
    } catch (error: any) {
      console.log('GraphQL取得失敗、REST APIにフォールバック:', error.message);
      // GraphQLが失敗した場合、REST APIでPRを取得
      const prs = await this.getPullRequestsREST(orgName, dateRange, targetMember);
      const reviews = await this.getReviews(orgName, prs, dateRange);
      
      // REST APIの結果をGraphQLと同じ形式に変換
      pullRequests = targetMembers.map(member => ({
        login: member.login,
        name: member.name,
        avatar_url: member.avatar_url,
        activities: {}
      }));
      
      // PRを月別に集計
      prs.forEach(pr => {
        const prDate = moment(pr.created_at);
        const prMonth = prDate.format('YYYY-MM');
        const member = pullRequests.find(m => m.login === pr.user?.login);
        if (member) {
          if (!member.activities[prMonth]) {
            member.activities[prMonth] = { issues: 0, pullRequests: 0, commits: 0, reviews: 0 };
          }
          member.activities[prMonth].pullRequests++;
        }
      });
      
      // レビューを月別に集計
      reviews.forEach(review => {
        const reviewDate = moment(review.submitted_at);
        const reviewMonth = reviewDate.format('YYYY-MM');
        const member = pullRequests.find(m => m.login === review.user?.login);
        if (member) {
          if (!member.activities[reviewMonth]) {
            member.activities[reviewMonth] = { issues: 0, pullRequests: 0, commits: 0, reviews: 0 };
          }
          member.activities[reviewMonth].reviews++;
        }
      });
    }
    
    console.log('Fetching commits...');
    const commits = await this.getCommits(orgName, dateRange, targetMember);
    
    // レビューはGraphQLで既に取得済みのため、ここでの処理を削除
    console.log('Processing member activities...');
    const memberActivities: MemberActivity[] = [];

    for (const member of targetMembers) {
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
        // 各月のアクティビティを集計
        Object.entries(pr.activities).forEach(([yearMonth, activity]) => {
          if (!activities[yearMonth]) {
            activities[yearMonth] = { issues: 0, pullRequests: 0, commits: 0, reviews: 0 };
          }
          activities[yearMonth].pullRequests += (activity as any).pullRequests || 0;
          activities[yearMonth].reviews += (activity as any).reviews || 0;
        });
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

      // レビューはGraphQLで既に集計済みのため、ここでの処理を削除

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