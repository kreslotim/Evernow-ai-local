// Base user interface matching API documentation
export interface User {
  id: string;
  telegramId: string;
  telegramUsername?: string;
  telegramChatId?: string;
  email?: string;
  analysisCredits: number;
  language: 'EN' | 'RU';
  referralCode: string;
  role: 'USER' | 'ADMIN';
  isBanned: boolean;
  banReason?: string;
  bannedAt?: string;
  isSubscribed?: boolean;
  freeGenerationsGranted?: boolean;
  funnelAction?: UserFunnelAction;
  // Bot blocking tracking
  isBotBlocked?: boolean;
  lastBotInteraction?: string;
  botBlockedAt?: string;
  createdAt: string;
  updatedAt: string;
}

// Extended user interface with statistics
export interface UserWithStats extends User {
  analyzesCount: number;
  referralsCount: number;
}

// Analysis interface matching API documentation
export interface Analysis {
  id: string;
  userId: string;
  type: AnalyzeType;
  status: ProcessingStatus;
  inputPhotoUrl: string[];
  analysisResultText?: string;
  summaryText?: string;
  postcardImageUrl?: string;
  errorMessage?: string;
  cost: number;
  createdAt: string;
  updatedAt: string;
  user: {
    id: string;
    telegramUsername?: string;
    telegramId: string;
  };
}

// Analysis with user details
export interface AnalyzeWithUser extends Analysis {
  user: {
    id: string;
    telegramUsername?: string;
    telegramId: string;
  };
}

// Processing status enum
export type ProcessingStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

// Analysis type enum matching schema.prisma
export type AnalyzeType = 'DEFAULT';

// User funnel action enum matching schema.prisma
export type UserFunnelAction =
  | 'START'
  | 'ONBOARDING_COMPLETE'
  | 'ANALYSIS_START'
  | 'ANALYSIS_COMPLETE'
  | 'SUBSCRIPTION_PURCHASE'
  | 'REFERRAL_INVITE'
  | 'FEELINGS_SHARE'
  | 'PSY_TEST_COMPLETE'
  | 'HYPOTHESIS_RECEIVE'
  | 'VIDEO_SHARE'
  | 'FUNNEL_COMPLETE';

export type FunnelState =
  | 'BOT_JOINED'
  | 'FIRST_PHOTO_ANALYSIS'
  | 'FEELINGS_SHARED'
  | 'PSY_TEST_PASSED'
  | 'HYPOTHESIS_RECEIVED'
  | 'INVITED_FRIENDS_7'
  | 'VIDEO_SHARED'
  | 'PAYMENT_MADE'
  | 'FUNNEL_COMPLETED';

// Referral interface
export interface Referral {
  id: string;
  referrerId: string;
  invitedUserId: string;
  createdAt: string;
  invitedUser: {
    id: string;
    telegramUsername?: string;
    createdAt: string;
  };
}

// User list response
export interface UserListResponse {
  users: UserWithStats[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// User filter options
export interface UserFilterOptions {
  page: number;
  limit: number;
  search?: string;
  sortBy?: string;
  sortDirection?: 'asc' | 'desc';
  funnelAction?: string;
}

// Analysis list response
export interface AnalysisListResponse {
  analyses: AnalyzeWithUser[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// Analysis filter options
export interface AnalysisFilterOptions {
  page: number;
  limit: number;
  search?: string;
  sortBy?: string;
  sortDirection?: 'asc' | 'desc';
  status?: ProcessingStatus;
  type?: AnalyzeType;
  userId?: string;
}

// Dashboard statistics types matching API documentation
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
  // Offer statistics
  totalOffers?: number;
  pendingOffers?: number;
  approvedOffers?: number;
  rejectedOffers?: number;
  offersLast30Days?: number;
}

// Запрос для авторизации администратора
export interface AdminLoginRequest {
  password: string;
}

// Ответ при успешной авторизации
export interface LoginResponse {
  token: string;
  user: {
    role: string;
  };
}

// User update request
export interface UserUpdateRequest {
  telegramUsername?: string;
  telegramChatId?: string;
  email?: string;
  analysisCredits?: number;
  language?: 'EN' | 'RU';
  role?: 'USER' | 'ADMIN';
  isBanned?: boolean;
  banReason?: string;
  isSubscribed?: boolean;
  freeGenerationsGranted?: boolean;
  funnelAction?: UserFunnelAction;
}

// Ban user request
export interface BanUserRequest {
  reason?: string;
}

// Offer status enum
export type OfferStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

// Offer interface
export interface Offer {
  id: string;
  text: string;
  status: OfferStatus;
  adminResponse?: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
  user?: {
    id: string;
    telegramUsername?: string;
    telegramId: string;
  };
}

// Offer filter options
export interface OfferFilterOptions {
  page: number;
  limit: number;
  search?: string;
  sortBy?: string;
  sortDirection?: 'asc' | 'desc';
  status?: OfferStatus;
  userId?: string;
}

// Offer list response
export interface OfferListResponse {
  offers: Offer[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// Create offer request
export interface CreateOfferRequest {
  text: string;
  userId: string;
}

// Update offer request
export interface UpdateOfferRequest {
  status?: OfferStatus;
  adminResponse?: string;
}

// Approve/Reject offer request
export interface ApproveRejectOfferRequest {
  adminResponse?: string;
}

// Offer statistics
export interface OfferStats {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  last30Days: number;
}

// // Analyze Statistic interfaces
// export interface AnalyzeStatistic {
//   id: string;
//   analyzeType: AnalyzeType;
//   selectClickCount: number;
//   startAnalyzeCount: number;
//   aiChatRequestCount: number;
//   date: string;
//   createdAt: string;
//   updatedAt: string;
// }

// export interface AnalyzeStatisticAggregated {
//   analyzeType: AnalyzeType;
//   period: string;
//   totalSelectClicks: number;
//   totalStartAnalyze: number;
//   totalAiChatRequests: number;
//   conversionRate: number;
//   aiEngagementRate: number;
// }

// export interface AnalyzeStatisticListResponse {
//   data: AnalyzeStatistic[];
//   total: number;
//   page: number;
//   limit: number;
//   totalPages: number;
// }

// export interface AnalyzeStatisticFilterOptions {
//   page: number;
//   limit: number;
//   sortBy?: string;
//   sortDirection?: 'asc' | 'desc';
//   analyzeType?: AnalyzeType;
//   dateFrom?: string;
//   dateTo?: string;
// }

// export interface CreateAnalyzeStatisticRequest {
//   analyzeType: AnalyzeType;
//   date: string;
//   selectClickCount?: number;
//   startAnalyzeCount?: number;
//   aiChatRequestCount?: number;
// }

// export interface UpdateAnalyzeStatisticRequest {
//   selectClickCount?: number;
//   startAnalyzeCount?: number;
//   aiChatRequestCount?: number;
// }

// export interface IncrementStatisticRequest {
//   analyzeType: AnalyzeType;
//   metric: 'selectClickCount' | 'startAnalyzeCount' | 'aiChatRequestCount';
//   increment?: number;
//   date?: string;
// }

// User details response
export interface UserDetailsResponse {
  id: string;
  telegramId: string;
  telegramUsername?: string;
  telegramChatId?: string;
  email?: string;
  analysisCredits: number;
  language: 'EN' | 'RU';
  referralCode: string;
  role: 'USER' | 'ADMIN';
  isBanned: boolean;
  banReason?: string;
  bannedAt?: string;
  createdAt: string;
  updatedAt: string;
  referrals: Array<{
    id: string;
    invitedUser: {
      id: string;
      telegramUsername?: string;
      createdAt: string;
    };
  }>;
  analyses: Array<{
    id: string;
    type: string;
    status: string;
    createdAt: string;
  }>;
}

/**
 * Расширенная информация о пользователе с полными данными для админки
 */
export interface ExtendedUserDetailsResponse {
  id: string;
  telegramId: string;
  telegramUsername?: string;
  telegramChatId?: string;
  email?: string;
  analysisCredits: number;
  language: 'EN' | 'RU';
  referralCode: string;
  role: 'USER' | 'ADMIN';
  isBanned: boolean;
  banReason?: string;
  bannedAt?: string;
  isBotBlocked?: boolean;
  botBlockedAt?: string;
  funnelAction?: UserFunnelAction;
  funnelState?: FunnelState;
  pipelineState?: UserPipelineState;
  subscriptionActive: boolean;
  subscriptionExpiry?: string;
  photoFailureAttempts: number;
  createdAt: string;
  updatedAt: string;

  // Рефералы
  referrals: Array<{
    id: string;
    invitedUser: {
      id: string;
      telegramUsername?: string;
      telegramId: string;
      createdAt: string;
    };
  }>;

  // Детальные анализы с фотографиями и результатами
  analyses: Array<{
    id: string;
    type: AnalyzeType;
    status: ProcessingStatus;
    inputPhotoUrl: string[];
    analysisResultText?: string;
    summaryText?: string;
    postcardImageUrl?: string;
    errorMessage?: string;
    cost: number;
    createdAt: string;
    updatedAt: string;
  }>;

  // Информация от OpenAI/DeepSeek анализов
  userInfo?: {
    id: string;
    description?: string; // Описание от OpenAI Vision API
    feelings?: string; // Результаты опроса + голосовое сообщение о чувствах
    feelingsAnalysis?: string; // Анализ чувств от DeepSeek (пустое)
    blockHypothesis?: string; // Блок-гипотеза от OpenAI
    surveyAnswers?: string; // JSON строка с ответами на диагностический опрос из 4 вопросов
    hypothesisRejectedCount: number; // Счётчик отклонений гипотезы
    luscherTestResult?: string; // Результат теста Люшера в JSON
    createdAt: string;
    updatedAt: string;
  };

  // Текущий таймер (если есть)
  userTimer?: {
    id: string;
    chatId: string;
    messageId?: number;
    startTime: string;
    endTime: string;
    completed: boolean;
    createdAt: string;
    updatedAt: string;
  };

  // События воронки для аналитики
  funnelEvents?: Array<{
    id: string;
    eventType: EventType;
    previousValue?: string;
    newValue: string;
    createdAt: string;
  }>;
}

/**
 * Состояния пайплайна пользователя
 */
export type UserPipelineState =
  | 'WELCOME_SENT'
  | 'WAITING_PHOTOS'
  | 'PHOTOS_RECEIVED'
  | 'ANALYSIS_COMPLETED'
  | 'TIMER_STARTED'
  | 'WAITING_FEELINGS'
  | 'WAITING_ANALYSIS_FOR_HYPOTHESIS'
  | 'MINI_APP_OPENED'
  | 'CREATING_HYPOTHESIS'
  | 'HYPOTHESIS_SENT'
  | 'HYPOTHESIS_REJECTED'
  | 'FINAL_MESSAGE_SENT'
  | 'ONBOARDING_COMPLETE';

// Prompt management interfaces
export interface Prompt {
  key: string;
  content: string;
  description?: string;
  provider: string;
  source: 'database' | 'default';
  isActive: boolean;
  deprecated?: boolean;
  updatedAt?: string;
}

export interface GetPromptsParams {
  page?: number;
  limit?: number;
  provider?: string;
  search?: string;
}

export interface UpdatePromptRequest {
  content: string;
  description?: string;
}

export interface PaginatedPromptsResponse {
  prompts: Prompt[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// Daily Funnel Stats interfaces

/**
 * Параметры запроса для дневной статистики воронки
 */
export interface DailyFunnelStatsQuery {
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
}

/**
 * Элемент дневной статистики воронки
 */
export interface DailyFunnelStatsItem {
  date: string;
  BOT_JOINED: number;
  FIRST_PHOTO_ANALYSIS: number;
  FEELINGS_SHARED: number;
  PSY_TEST_PASSED: number;
  HYPOTHESIS_RECEIVED: number;
  INVITED_FRIENDS_7: number;
  VIDEO_SHARED: number;
  PAYMENT_MADE: number;
  FUNNEL_COMPLETED: number;
  total: number;
}

/**
 * Информация о пагинации
 */
export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

/**
 * Ответ API с дневной статистикой воронки
 */
export interface DailyFunnelStatsResponse {
  data: DailyFunnelStatsItem[];
  pagination: Pagination;
}

/**
 * Тип события воронки
 */
export type EventType = 'FUNNEL_ACTION_CHANGE' | 'FUNNEL_STATE_CHANGE' | 'PIPELINE_STATE_CHANGE';

/**
 * Событие воронки
 */
export interface FunnelEvent {
  id: string;
  userId: string;
  eventType: EventType;
  previousValue?: string;
  newValue: string;
  createdAt: string;
}

// Bot Messages management interfaces

/**
 * Сообщение бота
 */
export interface BotMessage {
  key: string;
  locale: string;
  content: string;
  description?: string;
  source: 'database' | 'default';
  isActive: boolean;
  updatedAt?: string;
}

/**
 * Параметры для получения списка сообщений бота
 */
export interface GetBotMessagesQuery {
  page?: number;
  limit?: number;
  locale?: string;
  search?: string;
}

/**
 * Данные для обновления сообщения бота
 */
export interface UpdateBotMessageData {
  contentFile: File | null;
  content: string;
  description?: string;
}

/**
 * Данные для создания нового сообщения бота
 */
export interface CreateBotMessageData {
  key: string;
  locale: string;
  content: string;
  description?: string;
}

/**
 * Данные для импорта дефолтных сообщений
 */
export interface ImportDefaultMessagesData {
  locale?: string;
  overwrite?: boolean;
}

/**
 * Ответ API со списком сообщений бота и пагинацией
 */
export interface PaginatedBotMessagesResponse {
  messages: BotMessage[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * Результат импорта дефолтных сообщений
 */
export interface ImportDefaultMessagesResponse {
  imported: number;
  skipped: number;
}

export interface Philosophy {
  id: string;
  text: string;
}

export interface PhilosophyDto {
  text: string;
}

export interface FindPhilosophiesDto {
  page: number;
  limit: number;
  search: string;
}
// Welcome Photo management interfaces
export interface WelcomePhoto {
  id: string;
  title: string;
  description?: string;
  fileName: string;
  filePath: string;
  fileSize: number;
  mimeType: string;
  isActive: boolean;
  order: number;
  createdAt: string;
  updatedAt: string;
}

export interface WelcomePhotoFilterOptions {
  page?: number;
  limit?: number;
  search?: string;
  isActive?: boolean;
}

export interface CreateWelcomePhotoRequest {
  title: string;
  description?: string;
  isActive?: boolean;
  order?: number;
}

export interface UpdateWelcomePhotoRequest {
  title?: string;
  description?: string;
  isActive?: boolean;
  order?: number;
}

export interface BulkUpdateWelcomePhotosRequest {
  photos: Array<{
    id: string;
    order?: number;
    isActive?: boolean;
  }>;
}

export interface WelcomePhotoListResponse {
  photos: WelcomePhoto[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface WelcomePhotoStats {
  total: number;
  active: number;
  inactive: number;
  totalSizeBytes: number;
}

export interface WelcomePhotoUploadResponse {
  success: boolean;
  message: string;
  photo: WelcomePhoto;
}
