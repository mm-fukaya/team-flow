export interface GitHubUser {
  login: string;
  id: number;
  avatar_url: string;
  name?: string;
}

export interface MemberActivity {
  login: string;
  name?: string;
  avatar_url: string;
  organization?: string;
  organizationDisplayName?: string;
  activities: {
    [yearMonth: string]: {
      issues: number;
      pullRequests: number;
      commits: number;
      reviews: number;
    };
  };
}

export interface Organization {
  name: string;
  displayName: string;
}

export interface ChartData {
  labels: string[];
  datasets: {
    label: string;
    data: number[];
    backgroundColor: string;
    borderColor: string;
    borderWidth: number;
  }[];
} 