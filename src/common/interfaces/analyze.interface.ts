import { Analyze } from '@prisma/client';

export interface AnalyzeWithUser extends Analyze {
  user: {
    id: string;
    telegramUsername: string | null;
    telegramId: string;
  };
}

export interface PaginatedAnalyzes {
  analyses: AnalyzeWithUser[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
