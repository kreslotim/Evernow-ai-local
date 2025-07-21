import { User } from '@prisma/client';

export interface UserWithStats extends User {
  analyzesCount?: number;
  referralsCount?: number;
}

export interface PaginatedUsers {
  users: UserWithStats[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
