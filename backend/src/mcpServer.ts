import { DataService } from './services/dataService';
import { NaturalLanguageQueryService } from './services/naturalLanguageQueryService';

export interface MCPServer {
  name: string;
  version: string;
  capabilities: {
    tools: {
      listChanged: boolean;
    };
    resources: {
      listChanged: boolean;
    };
  };
}

export interface MCPTool {
  name: string;
  description: string;
  inputSchema: {
    type: string;
    properties: Record<string, any>;
    required?: string[];
  };
}

export interface MCPResource {
  uri: string;
  name: string;
  description: string;
  mimeType: string;
}

export class GitStatusMCPServer {
  private dataService: DataService;
  private queryService: NaturalLanguageQueryService | null = null;

  constructor() {
    this.dataService = new DataService();
  }

  // サーバー情報
  getServerInfo(): MCPServer {
    return {
      name: "git-status-server",
      version: "1.0.0",
      capabilities: {
        tools: {
          listChanged: true
        },
        resources: {
          listChanged: true
        }
      }
    };
  }

  // 利用可能なツール一覧
  getTools(): MCPTool[] {
    return [
      {
        name: "query_member_activities",
        description: "自然言語でメンバー活動を検索します。メンバー名、組織名、活動タイプ、期間などを指定できます。",
        inputSchema: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "自然言語クエリ（例: 'mm-kadoの活動を表示して', '最も活動したメンバー上位5人'）"
            }
          },
          required: ["query"]
        }
      },
      {
        name: "get_member_activities",
        description: "指定したメンバーの活動データを取得します。",
        inputSchema: {
          type: "object",
          properties: {
            memberLogin: {
              type: "string",
              description: "メンバーのログイン名"
            },
            organization: {
              type: "string",
              description: "組織名（macromill または macromill-mint）",
              enum: ["macromill", "macromill-mint"]
            }
          },
          required: ["memberLogin"]
        }
      },
      {
        name: "get_organization_stats",
        description: "組織の統計情報を取得します。",
        inputSchema: {
          type: "object",
          properties: {
            organization: {
              type: "string",
              description: "組織名（macromill または macromill-mint）",
              enum: ["macromill", "macromill-mint"]
            }
          }
        }
      },
      {
        name: "get_top_contributors",
        description: "指定した条件でトップコントリビューターを取得します。",
        inputSchema: {
          type: "object",
          properties: {
            activityType: {
              type: "string",
              description: "活動タイプ",
              enum: ["issues", "pullRequests", "commits", "reviews", "total"]
            },
            limit: {
              type: "number",
              description: "取得件数（デフォルト: 10）",
              default: 10
            },
            organization: {
              type: "string",
              description: "組織名（macromill または macromill-mint）"
            }
          },
          required: ["activityType"]
        }
      }
    ];
  }

  // 利用可能なリソース一覧
  getResources(): MCPResource[] {
    return [
      {
        uri: "git-status://activities/all",
        name: "all_member_activities",
        description: "全メンバーの活動データ（JSON形式）",
        mimeType: "application/json"
      },
      {
        uri: "git-status://activities/macromill",
        name: "macromill_activities",
        description: "Macromill組織のメンバー活動データ",
        mimeType: "application/json"
      },
      {
        uri: "git-status://activities/macromill-mint",
        name: "macromill_mint_activities",
        description: "Macromill Mint組織のメンバー活動データ",
        mimeType: "application/json"
      },
      {
        uri: "git-status://stats/organizations",
        name: "organization_statistics",
        description: "組織別統計情報",
        mimeType: "application/json"
      }
    ];
  }

  // ツールの実行
  async executeTool(name: string, args: any): Promise<any> {
    switch (name) {
      case "query_member_activities":
        return await this.executeQueryMemberActivities(args.query);
      
      case "get_member_activities":
        return await this.executeGetMemberActivities(args.memberLogin, args.organization);
      
      case "get_organization_stats":
        return await this.executeGetOrganizationStats(args.organization);
      
      case "get_top_contributors":
        return await this.executeGetTopContributors(args.activityType, args.limit, args.organization);
      
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  }

  // リソースの読み取り
  async readResource(uri: string): Promise<any> {
    switch (uri) {
      case "git-status://activities/all":
        return await this.readAllActivities();
      
      case "git-status://activities/macromill":
        return await this.readOrganizationActivities("macromill");
      
      case "git-status://activities/macromill-mint":
        return await this.readOrganizationActivities("macromill-mint");
      
      case "git-status://stats/organizations":
        return await this.readOrganizationStats();
      
      default:
        throw new Error(`Unknown resource: ${uri}`);
    }
  }

  // 自然言語クエリの実行
  private async executeQueryMemberActivities(query: string): Promise<any> {
    if (!this.queryService) {
      const { activities } = this.dataService.loadAllOrganizationsActivities();
      this.queryService = new NaturalLanguageQueryService(activities);
    }
    
    const result = await this.queryService.processQuery(query);
    return {
      type: result.type,
      data: result.data,
      message: result.message,
      query: result.query,
      filters: result.filters
    };
  }

  // メンバー活動データの取得
  private async executeGetMemberActivities(memberLogin: string, organization?: string): Promise<any> {
    let activities: any[] = [];
    
    if (organization) {
      const orgActivities = this.dataService.loadOrganizationActivities(organization);
      if (orgActivities) {
        activities = orgActivities.filter(a => a.login === memberLogin);
      }
    } else {
      const { activities: allActivities } = this.dataService.loadAllOrganizationsActivities();
      activities = allActivities.filter(a => a.login === memberLogin);
    }

    if (activities.length === 0) {
      return {
        message: `メンバー "${memberLogin}" のデータが見つかりませんでした。`,
        data: []
      };
    }

    return {
      message: `${activities.length}件のデータが見つかりました。`,
      data: activities.map(activity => ({
        login: activity.login,
        name: activity.name || activity.login,
        organization: activity.organizationDisplayName || activity.organization,
        totalIssues: Object.values(activity.activities).reduce((sum: number, data: any) => sum + data.issues, 0),
        totalPRs: Object.values(activity.activities).reduce((sum: number, data: any) => sum + data.pullRequests, 0),
        totalCommits: Object.values(activity.activities).reduce((sum: number, data: any) => sum + data.commits, 0),
        totalReviews: Object.values(activity.activities).reduce((sum: number, data: any) => sum + data.reviews, 0),
        activities: activity.activities
      }))
    };
  }

  // 組織統計の取得
  private async executeGetOrganizationStats(organization?: string): Promise<any> {
    const { activities, organizations } = this.dataService.loadAllOrganizationsActivities();
    
    if (organization) {
      const orgActivities = activities.filter(a => a.organization === organization);
      const stats = this.calculateOrganizationStats(orgActivities);
      return {
        organization,
        ...stats
      };
    } else {
      const allStats: Record<string, any> = {};
      for (const org of Object.keys(organizations)) {
        const orgActivities = activities.filter(a => a.organization === org);
        allStats[org] = this.calculateOrganizationStats(orgActivities);
      }
      return allStats;
    }
  }

  // トップコントリビューターの取得
  private async executeGetTopContributors(activityType: string, limit: number = 10, organization?: string): Promise<any> {
    let activities: any[] = [];
    
    if (organization) {
      const orgActivities = this.dataService.loadOrganizationActivities(organization);
      if (orgActivities) {
        activities = orgActivities;
      }
    } else {
      const { activities: allActivities } = this.dataService.loadAllOrganizationsActivities();
      activities = allActivities;
    }

    const contributors = activities.map(activity => {
      const totalIssues = Object.values(activity.activities).reduce((sum: number, data: any) => sum + data.issues, 0);
      const totalPRs = Object.values(activity.activities).reduce((sum: number, data: any) => sum + data.pullRequests, 0);
      const totalCommits = Object.values(activity.activities).reduce((sum: number, data: any) => sum + data.commits, 0);
      const totalReviews = Object.values(activity.activities).reduce((sum: number, data: any) => sum + data.reviews, 0);

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

    // 指定された活動タイプでソート
    contributors.sort((a, b) => {
      const aValue = (a as any)[activityType] || 0;
      const bValue = (b as any)[activityType] || 0;
      return bValue - aValue;
    });

    return {
      activityType,
      limit,
      organization: organization || 'all',
      data: contributors.slice(0, limit)
    };
  }

  // 組織統計の計算
  private calculateOrganizationStats(activities: any[]): any {
    const totalIssues = activities.reduce((sum, activity) => 
      sum + Object.values(activity.activities).reduce((s: number, data: any) => s + data.issues, 0), 0);
    const totalPRs = activities.reduce((sum, activity) => 
      sum + Object.values(activity.activities).reduce((s: number, data: any) => s + data.pullRequests, 0), 0);
    const totalCommits = activities.reduce((sum, activity) => 
      sum + Object.values(activity.activities).reduce((s: number, data: any) => s + data.commits, 0), 0);
    const totalReviews = activities.reduce((sum, activity) => 
      sum + Object.values(activity.activities).reduce((s: number, data: any) => s + data.reviews, 0), 0);

    return {
      memberCount: activities.length,
      totalIssues,
      totalPRs,
      totalCommits,
      totalReviews,
      totalActivities: totalIssues + totalPRs + totalCommits + totalReviews,
      averageIssues: activities.length > 0 ? totalIssues / activities.length : 0,
      averagePRs: activities.length > 0 ? totalPRs / activities.length : 0,
      averageCommits: activities.length > 0 ? totalCommits / activities.length : 0,
      averageReviews: activities.length > 0 ? totalReviews / activities.length : 0
    };
  }

  // 全活動データの読み取り
  private async readAllActivities(): Promise<any> {
    const { activities, organizations } = this.dataService.loadAllOrganizationsActivities();
    return {
      activities,
      organizations,
      lastUpdated: this.dataService.getAllOrganizationsLastUpdated()
    };
  }

  // 組織別活動データの読み取り
  private async readOrganizationActivities(organization: string): Promise<any> {
    const activities = this.dataService.loadOrganizationActivities(organization);
    const lastUpdated = this.dataService.getOrganizationLastUpdated(organization);
    
    return {
      organization,
      activities: activities || [],
      lastUpdated
    };
  }

  // 組織統計の読み取り
  private async readOrganizationStats(): Promise<any> {
    const { activities, organizations } = this.dataService.loadAllOrganizationsActivities();
    const stats: Record<string, any> = {};
    
    for (const org of Object.keys(organizations)) {
      const orgActivities = activities.filter(a => a.organization === org);
      stats[org] = this.calculateOrganizationStats(orgActivities);
    }
    
    return stats;
  }
} 