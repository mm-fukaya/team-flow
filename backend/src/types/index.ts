export interface GitHubUser {
  login: string;
  id: number;
  avatar_url: string;
  name?: string;
}

export interface GitHubIssue {
  id: number;
  number: number;
  title: string;
  user: GitHubUser;
  created_at: string;
  state: string;
}

export interface GitHubPullRequest {
  id: number;
  number: number;
  title: string;
  user: GitHubUser;
  created_at: string;
  state: string;
  merged_at?: string;
}

export interface GitHubCommit {
  sha: string;
  commit: {
    author: {
      name: string;
      email: string;
      date: string;
    };
    message: string;
  };
  author?: GitHubUser;
}

export interface GitHubReview {
  id: number;
  user: GitHubUser;
  submitted_at: string;
  state: string;
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

export interface DateRange {
  startDate: string;
  endDate: string;
} 