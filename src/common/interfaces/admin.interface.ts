export interface DashboardStats {
  totalUsers: number;
  activeUsers: number;
  bannedUsers: number;
  usersLast30Days: number;
  totalAnalyzes: number;
  completedAnalyzes: number;
  pendingAnalyzes: number;
  failedAnalyzes: number;
  analyzesLast30Days: number;
  funnelCompletedUsers: number;
}
