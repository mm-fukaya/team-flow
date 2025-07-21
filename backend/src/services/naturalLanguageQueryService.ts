import { MemberActivity } from '../types';
import moment from 'moment';

export interface QueryResult {
  type: 'data' | 'analysis' | 'summary' | 'comparison' | 'trend';
  data: any;
  message: string;
  query: string;
  filters?: {
    members?: string[];
    organizations?: string[];
    dateRange?: { start: string; end: string };
    activityTypes?: string[];
  };
}

export interface ParsedQuery {
  intent: string;
  entities: {
    members?: string[];
    organizations?: string[];
    dateRange?: { start: string; end: string };
    activityTypes?: string[];
    comparison?: string;
    aggregation?: string;
  };
  filters: {
    minValue?: number;
    maxValue?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    limit?: number;
  };
}

export class NaturalLanguageQueryService {
  private activities: MemberActivity[] = [];

  constructor(activities: MemberActivity[]) {
    this.activities = activities;
  }

  async processQuery(query: string): Promise<QueryResult> {
    try {
      console.log(`Processing natural language query: "${query}"`);
      
      const parsedQuery = this.parseQuery(query);
      console.log('Parsed query:', parsedQuery);
      
      const result = await this.executeQuery(parsedQuery, query);
      
      return result;
    } catch (error) {
      console.error('Error processing query:', error);
      return {
        type: 'data',
        data: null,
        message: `クエリの処理中にエラーが発生しました: ${error}`,
        query
      };
    }
  }

  private parseQuery(query: string): ParsedQuery {
    const lowerQuery = query.toLowerCase();
    
    const parsed: ParsedQuery = {
      intent: this.detectIntent(lowerQuery),
      entities: {
        members: this.extractMembers(lowerQuery),
        organizations: this.extractOrganizations(lowerQuery),
        dateRange: this.extractDateRange(lowerQuery),
        activityTypes: this.extractActivityTypes(lowerQuery),
        comparison: this.extractComparison(lowerQuery),
        aggregation: this.extractAggregation(lowerQuery)
      },
      filters: {
        minValue: this.extractMinValue(lowerQuery),
        maxValue: this.extractMaxValue(lowerQuery),
        sortBy: this.extractSortBy(lowerQuery),
        sortOrder: this.extractSortOrder(lowerQuery),
        limit: this.extractLimit(lowerQuery)
      }
    };

    return parsed;
  }

  private detectIntent(query: string): string {
    if (query.includes('比較') || query.includes('vs') || query.includes('対')) {
      return 'comparison';
    }
    if (query.includes('分析') || query.includes('傾向') || query.includes('パターン')) {
      return 'analysis';
    }
    if (query.includes('合計') || query.includes('平均') || query.includes('集計')) {
      return 'aggregation';
    }
    if (query.includes('上位') || query.includes('最も') || query.includes('多い')) {
      return 'ranking';
    }
    if (query.includes('期間') || query.includes('いつ') || query.includes('期間')) {
      return 'timeline';
    }
    return 'data';
  }

  private extractMembers(query: string): string[] {
    const members: string[] = [];
    
    // 既存のメンバーリストから検索
    const allMembers = this.activities.map(a => a.login);
    
    // クエリからメンバー名を検索
    allMembers.forEach(member => {
      if (query.includes(member.toLowerCase()) || 
          query.includes(member.replace('-', ' ').toLowerCase())) {
        members.push(member);
      }
    });

    // 特殊な表現を処理
    if (query.includes('全員') || query.includes('すべて') || query.includes('全体')) {
      return allMembers;
    }

    return members;
  }

  private extractOrganizations(query: string): string[] {
    const organizations: string[] = [];
    
    // 比較クエリの場合は両方の組織を検出
    if (query.includes('比較') || query.includes('vs') || query.includes('対')) {
      if (query.includes('macromill-mint') || query.includes('mint')) {
        organizations.push('macromill-mint');
      }
      if (query.includes('macromill')) {
        organizations.push('macromill');
      }
      // 比較クエリで組織が指定されていない場合は両方を追加
      if (organizations.length === 0) {
        organizations.push('macromill', 'macromill-mint');
      }
    } else {
      // 通常のクエリ
      if (query.includes('macromill-mint') || query.includes('mint')) {
        organizations.push('macromill-mint');
      }
      if (query.includes('macromill') && !query.includes('macromill-mint')) {
        organizations.push('macromill');
      }
    }
    
    if (query.includes('全組織') || query.includes('すべての組織')) {
      organizations.length = 0; // 既存の組織をクリア
      organizations.push('macromill', 'macromill-mint');
    }

    return organizations;
  }

  private extractDateRange(query: string): { start: string; end: string } | undefined {
    const now = moment();
    
    if (query.includes('今月')) {
      return {
        start: now.startOf('month').format('YYYY-MM-DD'),
        end: now.endOf('month').format('YYYY-MM-DD')
      };
    }
    if (query.includes('先月')) {
      return {
        start: now.subtract(1, 'month').startOf('month').format('YYYY-MM-DD'),
        end: now.subtract(1, 'month').endOf('month').format('YYYY-MM-DD')
      };
    }
    if (query.includes('過去1週間') || query.includes('先週')) {
      return {
        start: now.subtract(1, 'week').format('YYYY-MM-DD'),
        end: now.format('YYYY-MM-DD')
      };
    }
    if (query.includes('過去1ヶ月')) {
      return {
        start: now.subtract(1, 'month').format('YYYY-MM-DD'),
        end: now.format('YYYY-MM-DD')
      };
    }
    if (query.includes('過去3ヶ月')) {
      return {
        start: now.subtract(3, 'months').format('YYYY-MM-DD'),
        end: now.format('YYYY-MM-DD')
      };
    }

    return undefined;
  }

  private extractActivityTypes(query: string): string[] {
    const types: string[] = [];
    
    if (query.includes('イシュー') || query.includes('issue')) {
      types.push('issues');
    }
    if (query.includes('プルリク') || query.includes('pr') || query.includes('pull request')) {
      types.push('pullRequests');
    }
    if (query.includes('コミット') || query.includes('commit')) {
      types.push('commits');
    }
    if (query.includes('レビュー') || query.includes('review')) {
      types.push('reviews');
    }

    return types;
  }

  private extractComparison(query: string): string | undefined {
    if (query.includes('比較') || query.includes('vs') || query.includes('対')) {
      return 'comparison';
    }
    return undefined;
  }

  private extractAggregation(query: string): string | undefined {
    if (query.includes('合計') || query.includes('sum')) {
      return 'sum';
    }
    if (query.includes('平均') || query.includes('avg')) {
      return 'average';
    }
    if (query.includes('最大') || query.includes('max')) {
      return 'max';
    }
    if (query.includes('最小') || query.includes('min')) {
      return 'min';
    }
    return undefined;
  }

  private extractMinValue(query: string): number | undefined {
    const match = query.match(/(\d+)以上|(\d+)個以上|(\d+)件以上/);
    return match ? parseInt(match[1] || match[2] || match[3]) : undefined;
  }

  private extractMaxValue(query: string): number | undefined {
    const match = query.match(/(\d+)以下|(\d+)個以下|(\d+)件以下/);
    return match ? parseInt(match[1] || match[2] || match[3]) : undefined;
  }

  private extractSortBy(query: string): string | undefined {
    if (query.includes('イシュー') || query.includes('issue')) {
      return 'issues';
    }
    if (query.includes('プルリク') || query.includes('pr')) {
      return 'pullRequests';
    }
    if (query.includes('コミット') || query.includes('commit')) {
      return 'commits';
    }
    if (query.includes('レビュー') || query.includes('review')) {
      return 'reviews';
    }
    if (query.includes('合計') || query.includes('total')) {
      return 'total';
    }
    return undefined;
  }

  private extractSortOrder(query: string): 'asc' | 'desc' | undefined {
    if (query.includes('多い') || query.includes('上位') || query.includes('最大')) {
      return 'desc';
    }
    if (query.includes('少ない') || query.includes('下位') || query.includes('最小')) {
      return 'asc';
    }
    return undefined;
  }

  private extractLimit(query: string): number | undefined {
    const match = query.match(/上位(\d+)|(\d+)位まで|(\d+)人/);
    return match ? parseInt(match[1] || match[2] || match[3]) : undefined;
  }

  private async executeQuery(parsed: ParsedQuery, originalQuery: string): Promise<QueryResult> {
    let filteredActivities = this.filterActivities(parsed);
    
    switch (parsed.intent) {
      case 'comparison':
        return this.executeComparison(parsed, filteredActivities, originalQuery);
      case 'analysis':
        return this.executeAnalysis(parsed, filteredActivities, originalQuery);
      case 'aggregation':
        return this.executeAggregation(parsed, filteredActivities, originalQuery);
      case 'ranking':
        return this.executeRanking(parsed, filteredActivities, originalQuery);
      case 'timeline':
        return this.executeTimeline(parsed, filteredActivities, originalQuery);
      default:
        return this.executeDataQuery(parsed, filteredActivities, originalQuery);
    }
  }

  private filterActivities(parsed: ParsedQuery): MemberActivity[] {
    let filtered = [...this.activities];

    // メンバーでフィルタリング
    if (parsed.entities.members && parsed.entities.members.length > 0) {
      filtered = filtered.filter(activity => 
        parsed.entities.members!.includes(activity.login)
      );
    }

    // 組織でフィルタリング
    if (parsed.entities.organizations && parsed.entities.organizations.length > 0) {
      filtered = filtered.filter(activity => 
        activity.organization && parsed.entities.organizations!.includes(activity.organization)
      );
    }

    // 日付範囲でフィルタリング
    if (parsed.entities.dateRange) {
      filtered = filtered.filter(activity => {
        const activityMonths = Object.keys(activity.activities);
        return activityMonths.some(month => {
          const monthDate = moment(month, 'YYYY-MM');
          const startDate = moment(parsed.entities.dateRange!.start);
          const endDate = moment(parsed.entities.dateRange!.end);
          return monthDate.isBetween(startDate, endDate, 'month', '[]');
        });
      });
    }

    // 最小値・最大値でフィルタリング
    if (parsed.filters.minValue !== undefined || parsed.filters.maxValue !== undefined) {
      filtered = filtered.filter(activity => {
        // 活動タイプに基づいて値を計算
        const activityType = parsed.entities.activityTypes?.[0];
        let totalValue = 0;

        if (activityType) {
          totalValue = Object.values(activity.activities).reduce((sum, data) => {
            switch (activityType) {
              case 'issues':
                return sum + data.issues;
              case 'pullRequests':
                return sum + data.pullRequests;
              case 'commits':
                return sum + data.commits;
              case 'reviews':
                return sum + data.reviews;
              default:
                return sum + data.issues + data.pullRequests + data.commits + data.reviews;
            }
          }, 0);
        } else {
          // 活動タイプが指定されていない場合は合計で判定
          totalValue = Object.values(activity.activities).reduce((sum, data) => 
            sum + data.issues + data.pullRequests + data.commits + data.reviews, 0
          );
        }

        // 最小値チェック
        if (parsed.filters.minValue !== undefined && totalValue < parsed.filters.minValue) {
          return false;
        }

        // 最大値チェック
        if (parsed.filters.maxValue !== undefined && totalValue > parsed.filters.maxValue) {
          return false;
        }

        return true;
      });
    }

    return filtered;
  }

  private executeDataQuery(parsed: ParsedQuery, activities: MemberActivity[], originalQuery: string): QueryResult {
    const result = activities.map(activity => {
      const totalIssues = Object.values(activity.activities).reduce((sum, data) => sum + data.issues, 0);
      const totalPRs = Object.values(activity.activities).reduce((sum, data) => sum + data.pullRequests, 0);
      const totalCommits = Object.values(activity.activities).reduce((sum, data) => sum + data.commits, 0);
      const totalReviews = Object.values(activity.activities).reduce((sum, data) => sum + data.reviews, 0);

      return {
        login: activity.login,
        name: activity.name || activity.login,
        organization: activity.organizationDisplayName || activity.organization,
        issues: totalIssues,
        pullRequests: totalPRs,
        commits: totalCommits,
        reviews: totalReviews,
        total: totalIssues + totalPRs + totalCommits + totalReviews
      };
    });

    // ソート
    if (parsed.filters.sortBy) {
      result.sort((a, b) => {
        const aValue = a[parsed.filters.sortBy as keyof typeof a] as number;
        const bValue = b[parsed.filters.sortBy as keyof typeof b] as number;
        return parsed.filters.sortOrder === 'asc' ? aValue - bValue : bValue - aValue;
      });
    }

    // 制限
    if (parsed.filters.limit) {
      result.splice(parsed.filters.limit);
    }

    return {
      type: 'data',
      data: result,
      message: `${result.length}件のデータが見つかりました`,
      query: originalQuery,
      filters: {
        members: parsed.entities.members,
        organizations: parsed.entities.organizations,
        dateRange: parsed.entities.dateRange,
        activityTypes: parsed.entities.activityTypes
      }
    };
  }

  private executeComparison(parsed: ParsedQuery, activities: MemberActivity[], originalQuery: string): QueryResult {
    // 組織間比較
    if (parsed.entities.organizations && parsed.entities.organizations.length > 1) {
      const comparison = parsed.entities.organizations.map(org => {
        const orgActivities = activities.filter(a => a.organization === org);
        const totalIssues = orgActivities.reduce((sum, activity) => 
          sum + Object.values(activity.activities).reduce((s, data) => s + data.issues, 0), 0);
        const totalPRs = orgActivities.reduce((sum, activity) => 
          sum + Object.values(activity.activities).reduce((s, data) => s + data.pullRequests, 0), 0);
        const totalCommits = orgActivities.reduce((sum, activity) => 
          sum + Object.values(activity.activities).reduce((s, data) => s + data.commits, 0), 0);
        const totalReviews = orgActivities.reduce((sum, activity) => 
          sum + Object.values(activity.activities).reduce((s, data) => s + data.reviews, 0), 0);

        return {
          organization: org,
          organizationDisplayName: org === 'macromill' ? 'Macromill' : 'Macromill Mint',
          issues: totalIssues,
          pullRequests: totalPRs,
          commits: totalCommits,
          reviews: totalReviews,
          total: totalIssues + totalPRs + totalCommits + totalReviews,
          memberCount: orgActivities.length,
          averageIssues: orgActivities.length > 0 ? totalIssues / orgActivities.length : 0,
          averagePRs: orgActivities.length > 0 ? totalPRs / orgActivities.length : 0,
          averageCommits: orgActivities.length > 0 ? totalCommits / orgActivities.length : 0,
          averageReviews: orgActivities.length > 0 ? totalReviews / orgActivities.length : 0
        };
      });

      // 比較分析を追加
      const analysis = {
        comparison: comparison,
        summary: {
          totalOrganizations: comparison.length,
          totalMembers: comparison.reduce((sum, org) => sum + org.memberCount, 0),
          totalIssues: comparison.reduce((sum, org) => sum + org.issues, 0),
          totalPRs: comparison.reduce((sum, org) => sum + org.pullRequests, 0),
          totalCommits: comparison.reduce((sum, org) => sum + org.commits, 0),
          totalReviews: comparison.reduce((sum, org) => sum + org.reviews, 0),
          totalActivities: comparison.reduce((sum, org) => sum + org.total, 0)
        },
        insights: this.generateComparisonInsights(comparison)
      };

      return {
        type: 'comparison',
        data: analysis,
        message: `${parsed.entities.organizations.join('と')}の詳細比較結果です`,
        query: originalQuery,
        filters: {
          organizations: parsed.entities.organizations
        }
      };
    }

    // デフォルトはデータクエリ
    return this.executeDataQuery(parsed, activities, originalQuery);
  }

  private executeAnalysis(parsed: ParsedQuery, activities: MemberActivity[], originalQuery: string): QueryResult {
    const analysis = {
      totalMembers: activities.length,
      totalIssues: activities.reduce((sum, activity) => 
        sum + Object.values(activity.activities).reduce((s, data) => s + data.issues, 0), 0),
      totalPRs: activities.reduce((sum, activity) => 
        sum + Object.values(activity.activities).reduce((s, data) => s + data.pullRequests, 0), 0),
      totalCommits: activities.reduce((sum, activity) => 
        sum + Object.values(activity.activities).reduce((s, data) => s + data.commits, 0), 0),
      totalReviews: activities.reduce((sum, activity) => 
        sum + Object.values(activity.activities).reduce((s, data) => s + data.reviews, 0), 0),
      averageIssues: 0,
      averagePRs: 0,
      averageCommits: 0,
      averageReviews: 0
    };

    if (activities.length > 0) {
      analysis.averageIssues = analysis.totalIssues / activities.length;
      analysis.averagePRs = analysis.totalPRs / activities.length;
      analysis.averageCommits = analysis.totalCommits / activities.length;
      analysis.averageReviews = analysis.totalReviews / activities.length;
    }

    return {
      type: 'analysis',
      data: analysis,
      message: `${activities.length}メンバーの活動分析結果です`,
      query: originalQuery
    };
  }

  private executeAggregation(parsed: ParsedQuery, activities: MemberActivity[], originalQuery: string): QueryResult {
    const aggregation = {
      sum: {
        issues: activities.reduce((sum, activity) => 
          sum + Object.values(activity.activities).reduce((s, data) => s + data.issues, 0), 0),
        pullRequests: activities.reduce((sum, activity) => 
          sum + Object.values(activity.activities).reduce((s, data) => s + data.pullRequests, 0), 0),
        commits: activities.reduce((sum, activity) => 
          sum + Object.values(activity.activities).reduce((s, data) => s + data.commits, 0), 0),
        reviews: activities.reduce((sum, activity) => 
          sum + Object.values(activity.activities).reduce((s, data) => s + data.reviews, 0), 0)
      },
      average: {
        issues: 0,
        pullRequests: 0,
        commits: 0,
        reviews: 0
      }
    };

    if (activities.length > 0) {
      aggregation.average.issues = aggregation.sum.issues / activities.length;
      aggregation.average.pullRequests = aggregation.sum.pullRequests / activities.length;
      aggregation.average.commits = aggregation.sum.commits / activities.length;
      aggregation.average.reviews = aggregation.sum.reviews / activities.length;
    }

    return {
      type: 'summary',
      data: aggregation,
      message: `${activities.length}メンバーの集計結果です`,
      query: originalQuery
    };
  }

  private executeRanking(parsed: ParsedQuery, activities: MemberActivity[], originalQuery: string): QueryResult {
    const ranking = activities.map(activity => {
      const totalIssues = Object.values(activity.activities).reduce((sum, data) => sum + data.issues, 0);
      const totalPRs = Object.values(activity.activities).reduce((sum, data) => sum + data.pullRequests, 0);
      const totalCommits = Object.values(activity.activities).reduce((sum, data) => sum + data.commits, 0);
      const totalReviews = Object.values(activity.activities).reduce((sum, data) => sum + data.reviews, 0);

      return {
        login: activity.login,
        name: activity.name || activity.login,
        organization: activity.organizationDisplayName || activity.organization,
        issues: totalIssues,
        pullRequests: totalPRs,
        commits: totalCommits,
        reviews: totalReviews,
        total: totalIssues + totalPRs + totalCommits + totalReviews
      };
    });

    // デフォルトで合計でソート
    const sortBy = parsed.filters.sortBy || 'total';
    ranking.sort((a, b) => {
      const aValue = a[sortBy as keyof typeof a] as number;
      const bValue = b[sortBy as keyof typeof b] as number;
      return parsed.filters.sortOrder === 'asc' ? aValue - bValue : bValue - aValue;
    });

    if (parsed.filters.limit) {
      ranking.splice(parsed.filters.limit);
    }

    return {
      type: 'data',
      data: ranking,
      message: `${sortBy}のランキングです`,
      query: originalQuery
    };
  }

  private executeTimeline(parsed: ParsedQuery, activities: MemberActivity[], originalQuery: string): QueryResult {
    const timeline: { [month: string]: { issues: number; pullRequests: number; commits: number; reviews: number } } = {};

    activities.forEach(activity => {
      Object.entries(activity.activities).forEach(([month, data]) => {
        if (!timeline[month]) {
          timeline[month] = { issues: 0, pullRequests: 0, commits: 0, reviews: 0 };
        }
        timeline[month].issues += data.issues;
        timeline[month].pullRequests += data.pullRequests;
        timeline[month].commits += data.commits;
        timeline[month].reviews += data.reviews;
      });
    });

    const sortedTimeline = Object.entries(timeline)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, data]) => ({
        month,
        ...data,
        total: data.issues + data.pullRequests + data.commits + data.reviews
      }));

    return {
      type: 'trend',
      data: sortedTimeline,
      message: '期間別の活動推移です',
      query: originalQuery
    };
  }

  private generateComparisonInsights(comparison: any[]): string[] {
    const insights: string[] = [];
    
    if (comparison.length < 2) return insights;

    const [org1, org2] = comparison;
    
    // メンバー数の比較
    if (org1.memberCount > org2.memberCount) {
      insights.push(`${org1.organizationDisplayName}の方が${org2.organizationDisplayName}より${org1.memberCount - org2.memberCount}人多く活動しています`);
    } else if (org2.memberCount > org1.memberCount) {
      insights.push(`${org2.organizationDisplayName}の方が${org1.organizationDisplayName}より${org2.memberCount - org1.memberCount}人多く活動しています`);
    }

    // 総活動数の比較
    if (org1.total > org2.total) {
      insights.push(`${org1.organizationDisplayName}の総活動数（${org1.total}件）が${org2.organizationDisplayName}（${org2.total}件）より多いです`);
    } else if (org2.total > org1.total) {
      insights.push(`${org2.organizationDisplayName}の総活動数（${org2.total}件）が${org1.organizationDisplayName}（${org1.total}件）より多いです`);
    }

    // 平均活動数の比較
    const avg1 = org1.memberCount > 0 ? org1.total / org1.memberCount : 0;
    const avg2 = org2.memberCount > 0 ? org2.total / org2.memberCount : 0;
    
    if (avg1 > avg2) {
      insights.push(`${org1.organizationDisplayName}の1人あたりの平均活動数（${avg1.toFixed(1)}件）が${org2.organizationDisplayName}（${avg2.toFixed(1)}件）より高いです`);
    } else if (avg2 > avg1) {
      insights.push(`${org2.organizationDisplayName}の1人あたりの平均活動数（${avg2.toFixed(1)}件）が${org1.organizationDisplayName}（${avg1.toFixed(1)}件）より高いです`);
    }

    // 活動タイプ別の比較
    if (org1.issues > org2.issues) {
      insights.push(`${org1.organizationDisplayName}のIssue作成数（${org1.issues}件）が${org2.organizationDisplayName}（${org2.issues}件）より多いです`);
    }
    if (org1.pullRequests > org2.pullRequests) {
      insights.push(`${org1.organizationDisplayName}のPull Request作成数（${org1.pullRequests}件）が${org2.organizationDisplayName}（${org2.pullRequests}件）より多いです`);
    }
    if (org1.commits > org2.commits) {
      insights.push(`${org1.organizationDisplayName}のコミット数（${org1.commits}件）が${org2.organizationDisplayName}（${org2.commits}件）より多いです`);
    }
    if (org1.reviews > org2.reviews) {
      insights.push(`${org1.organizationDisplayName}のレビュー数（${org1.reviews}件）が${org2.organizationDisplayName}（${org2.reviews}件）より多いです`);
    }

    return insights;
  }
}
