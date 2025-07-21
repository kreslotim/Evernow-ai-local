import axios from 'axios';
import type {
  AdminLoginRequest,
  Analysis,
  AnalysisFilterOptions,
  AnalysisListResponse,
  ApproveRejectOfferRequest,
  BotMessage,
  BulkUpdateWelcomePhotosRequest,
  CreateBotMessageData,
  CreateOfferRequest,
  CreateWelcomePhotoRequest,
  DailyFunnelStatsQuery,
  DailyFunnelStatsResponse,
  DashboardStats,
  ExtendedUserDetailsResponse,
  FindPhilosophiesDto,
  GetBotMessagesQuery,
  ImportDefaultMessagesData,
  ImportDefaultMessagesResponse,
  LoginResponse,
  Offer,
  OfferFilterOptions,
  OfferListResponse,
  OfferStats,
  PaginatedBotMessagesResponse,
  Philosophy,
  PhilosophyDto,
  UpdateBotMessageData,
  UpdateOfferRequest,
  UpdateWelcomePhotoRequest,
  User,
  UserFilterOptions,
  UserListResponse,
  UserUpdateRequest,
  WelcomePhoto,
  WelcomePhotoFilterOptions,
  WelcomePhotoListResponse,
  WelcomePhotoStats,
  WelcomePhotoUploadResponse,
} from '../types';
// API URL - dynamically resolve based on environment
const getApiBaseUrl = () => {
  // In production, use relative API path
  if (typeof window !== 'undefined') {
    return `${import.meta.env.VITE_API_URL || window.location.origin}/api`;
  }
  // Fallback for SSR/build time
  return 'http://localhost:4001/api';
};

const apiBaseUrl = getApiBaseUrl();

// Token management utilities
const TOKEN_KEY = 'admin_token';

export const tokenManager = {
  getToken: (): string | null => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(TOKEN_KEY);
  },

  setToken: (token: string): void => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(TOKEN_KEY, token);
  },

  removeToken: (): void => {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(TOKEN_KEY);
  },

  isAuthenticated: (): boolean => {
    return !!tokenManager.getToken();
  },
};

// Create axios instance with base URL
const api = axios.create({
  baseURL: apiBaseUrl,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    // Skip adding token for auth endpoints
    const isAuthEndpoint = config.url?.includes('/auth/');

    if (!isAuthEndpoint) {
      const token = tokenManager.getToken();
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  },
);

// Response interceptor to handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // If auth error (401), clear token and redirect to login
    if (error.response && error.response.status === 401) {
      tokenManager.removeToken();

      // Redirect to login if not already there
      if (typeof window !== 'undefined' && !window.location.pathname.includes('/login')) {
        window.location.href = '/panel/login';
      }
    }
    return Promise.reject(error);
  },
);

// Authentication API methods
export const authApi = {
  /**
   * Admin login with password
   * @param credentials - Object with admin password
   * @returns Response with token and user data
   */
  login: async (credentials: AdminLoginRequest): Promise<LoginResponse> => {
    const response = await api.post('/auth/login', credentials);

    // Store the token in localStorage
    if (response.data.token) {
      tokenManager.setToken(response.data.token);
    }

    return response.data;
  },

  /**
   * Logout - clears the stored token
   */
  logout: () => {
    tokenManager.removeToken();
  },

  /**
   * Check if user is authenticated
   */
  isAuthenticated: (): boolean => {
    return tokenManager.isAuthenticated();
  },

  /**
   * Get current token
   */
  getToken: (): string | null => {
    return tokenManager.getToken();
  },
};

// Dashboard API methods
export const dashboardApi = {
  getStats: async (): Promise<DashboardStats> => {
    const response = await api.get('/admin/dashboard');
    return response.data;
  },
};

// User management API methods
export const usersApi = {
  getUsers: async (options: UserFilterOptions): Promise<UserListResponse> => {
    const { page, limit, search, sortBy, sortDirection } = options;
    const response = await api.get('/admin/users', {
      params: {
        page,
        limit,
        search,
        sortBy,
        sortDirection,
      },
    });
    return response.data;
  },

  getUserById: async (id: string): Promise<ExtendedUserDetailsResponse> => {
    const response = await api.get(`/admin/users/${id}`);
    return response.data;
  },

  updateUser: async (id: string, data: UserUpdateRequest): Promise<User> => {
    const response = await api.put(`/admin/users/${id}`, data);
    return response.data;
  },

  // Add credits to user
  addCredits: async (id: string, amount: number): Promise<User> => {
    const response = await api.post(`/admin/users/${id}/credits`, { amount });
    return response.data;
  },

  banUser: async (id: string, reason?: string): Promise<User> => {
    const response = await api.post(`/admin/users/${id}/ban`, { reason });
    return response.data;
  },

  unbanUser: async (id: string): Promise<User> => {
    const response = await api.post(`/admin/users/${id}/unban`);
    return response.data;
  },

  clearUserData: async (id: string): Promise<{ success: boolean; message: string; filesDeleted: number }> => {
    const response = await api.post(`/admin/users/${id}/clear-data`);
    return response.data;
  },

  deleteUser: async (id: string): Promise<{ success: boolean; message: string }> => {
    const response = await api.delete(`/admin/users/${id}`);
    return response.data;
  },

  getUserAnalyses: async (userId: string, options: AnalysisFilterOptions): Promise<AnalysisListResponse> => {
    const { page, limit, sortBy, sortDirection } = options;
    const response = await api.get(`/admin/users/${userId}/analyzes`, {
      params: {
        page,
        limit,
        sortBy,
        sortDirection,
      },
    });
    return response.data;
  },
};

// Analysis management API methods
export const analysisApi = {
  getAnalyses: async (options: AnalysisFilterOptions): Promise<AnalysisListResponse> => {
    const { page, limit, search, sortBy, sortDirection, status, type, userId } = options;
    const response = await api.get('/admin/analyzes', {
      params: {
        page,
        limit,
        search,
        sortBy,
        sortDirection,
        status,
        type,
        userId,
      },
    });
    return response.data;
  },

  getAnalysisById: async (id: string): Promise<Analysis> => {
    const response = await api.get(`/admin/analyzes/${id}`);
    return response.data;
  },
};

// Offers management API methods
export const offersApi = {
  getOffers: async (options: OfferFilterOptions): Promise<OfferListResponse> => {
    const { page, limit, search, sortBy, sortDirection, status, userId } = options;
    const response = await api.get('/admin/offers', {
      params: {
        page,
        limit,
        search,
        sortBy,
        sortDirection,
        status,
        userId,
      },
    });
    return response.data;
  },

  getOfferById: async (id: string): Promise<Offer> => {
    const response = await api.get(`/admin/offers/${id}`);
    return response.data;
  },

  createOffer: async (data: CreateOfferRequest): Promise<Offer> => {
    const response = await api.post('/admin/offers', data);
    return response.data;
  },

  updateOffer: async (id: string, data: UpdateOfferRequest): Promise<Offer> => {
    const response = await api.put(`/admin/offers/${id}`, data);
    return response.data;
  },

  approveOffer: async (id: string, data?: ApproveRejectOfferRequest): Promise<Offer> => {
    const response = await api.post(`/admin/offers/${id}/approve`, data || {});
    return response.data;
  },

  rejectOffer: async (id: string, data?: ApproveRejectOfferRequest): Promise<Offer> => {
    const response = await api.post(`/admin/offers/${id}/reject`, data || {});
    return response.data;
  },

  deleteOffer: async (id: string): Promise<void> => {
    await api.delete(`/admin/offers/${id}`);
  },

  getOfferStats: async (): Promise<OfferStats> => {
    const response = await api.get('/admin/offers/stats');
    return response.data;
  },
};

// Notification API methods
export const notificationApi = {
  /**
   * Send message to users by funnel action or all users
   * @param data - Funnel message data with action and message
   * @returns Result with sent/failed counts
   */
  sendFunnelMessage: async (data: { funnelAction: string | 'all'; message: string }) => {
    const response = await api.post('/admin/notifications/funnel/send', data);
    return response.data;
  },
};

// Funnel API methods
export const funnelApi = {
  /**
   * Get funnel statistics for all users
   * @returns Funnel statistics by action
   */
  getFunnelStats: async () => {
    const response = await api.get('/admin/funnel/stats');
    return response.data;
  },

  /**
   * Получить дневную статистику воронки
   * @param params - параметры запроса с фильтрацией и пагинацией
   * @returns дневная статистика воронки с пагинацией
   */
  getDailyFunnelStats: async (params: DailyFunnelStatsQuery): Promise<DailyFunnelStatsResponse> => {
    const response = await api.get('/admin/funnel/daily-stats', {
      params: {
        dateFrom: params.dateFrom,
        dateTo: params.dateTo,
        page: params.page,
        limit: params.limit,
      },
    });
    return response.data;
  },
};

// Prompt management API methods
export const promptsApi = {
  /**
   * Проверить пароль для доступа к промптам
   * @param password - пароль для проверки
   * @returns результат проверки пароля
   */
  verifyPassword: async (password: string): Promise<{ success: boolean; message: string }> => {
    const response = await api.post('/admin/prompts/verify-password', { password });
    return response.data;
  },

  /**
   * Получить список всех промптов с пагинацией и фильтрацией
   * @param options - параметры фильтрации и пагинации
   * @returns список промптов с пагинацией
   */
  getPrompts: async (options: { page?: number; limit?: number; provider?: string; search?: string }) => {
    const { page, limit, provider, search } = options;
    const response = await api.get('/admin/prompts', {
      params: {
        page,
        limit,
        provider,
        search,
      },
    });
    return response.data;
  },

  /**
   * Получить конкретный промпт по ключу
   * @param key - ключ промпта
   * @returns промпт с метаданными
   */
  getPromptByKey: async (key: string) => {
    const response = await api.get(`/admin/prompts/${key}`);
    return response.data;
  },

  /**
   * Обновить содержимое промпта
   * @param key - ключ промпта
   * @param data - данные для обновления
   * @returns обновленный промпт
   */
  updatePrompt: async (key: string, data: { content: string; description?: string }) => {
    const response = await api.put(`/admin/prompts/${key}`, data);
    return response.data;
  },
};

// Bot Messages management API methods
export const botMessagesApi = {
  /**
   * Получить список сообщений бота с пагинацией и фильтрацией
   * @param options - параметры фильтрации и пагинации
   * @returns список сообщений бота с пагинацией
   */
  getMessages: async (options: GetBotMessagesQuery): Promise<PaginatedBotMessagesResponse> => {
    const { page, limit, locale, search } = options;
    const response = await api.get('/admin/bot-messages', {
      params: {
        page,
        limit,
        locale,
        search,
      },
    });
    return response.data;
  },

  /**
   * Получить конкретное сообщение бота по ключу и локали
   * @param key - ключ сообщения
   * @param locale - локаль сообщения (ru/en)
   * @returns сообщение бота
   */
  getMessage: async (key: string, locale: string): Promise<BotMessage> => {
    const response = await api.get(`/admin/bot-messages/${encodeURIComponent(key)}/${locale}`);
    return response.data;
  },

  /**
   * Обновить содержимое сообщения бота
   * @param key - ключ сообщения
   * @param locale - локаль сообщения
   * @param data - данные для обновления
   * @returns обновленное сообщение
   */
  updateMessage: async (key: string, locale: string, dto: UpdateBotMessageData): Promise<BotMessage> => {
    const formData = new FormData();

    formData.append('content', dto.content);
    if (dto.description !== undefined) {
      formData.append('description', dto.description);
    }
    if (dto.contentFile) {
      formData.append('file', dto.contentFile);
    }

    const { data } = await api.put(
      `/admin/bot-messages/${encodeURIComponent(key)}/${locale}`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      },
    );

    return data;
  },

  /**
   * Создать новое сообщение бота
   * @param data - данные нового сообщения
   * @returns созданное сообщение
   */
  createMessage: async (data: CreateBotMessageData): Promise<BotMessage> => {
    const response = await api.post('/admin/bot-messages', data);
    return response.data;
  },

  /**
   * Удалить кастомное сообщение бота (вернуть к дефолтному)
   * @param key - ключ сообщения
   * @param locale - локаль сообщения
   */
  deleteMessage: async (key: string, locale: string): Promise<void> => {
    await api.delete(`/admin/bot-messages/${encodeURIComponent(key)}/${locale}`);
  },

  /**
   * Импортировать дефолтные сообщения из файлов локализации
   * @param data - параметры импорта
   * @returns результат импорта
   */
  importDefaultMessages: async (data: ImportDefaultMessagesData): Promise<ImportDefaultMessagesResponse> => {
    const response = await api.post('/admin/bot-messages/import-defaults', data);
    return response.data;
  },
};

// Welcome Photos management API methods
export const welcomePhotosApi = {
  /**
   * Получить список фотографий приветствия с пагинацией и фильтрацией
   * @param options - параметры фильтрации и пагинации
   * @returns список фотографий приветствия с пагинацией
   */
  getWelcomePhotos: async (options: WelcomePhotoFilterOptions): Promise<WelcomePhotoListResponse> => {
    const { page, limit, search, isActive } = options;
    const response = await api.get('/admin/photos', {
      params: {
        page,
        limit,
        search,
        isActive,
      },
    });
    return response.data;
  },

  /**
   * Получить статистику фотографий приветствия
   * @returns статистика фотографий
   */
  getWelcomePhotosStats: async (): Promise<WelcomePhotoStats> => {
    const response = await api.get('/admin/photos/stats');
    return response.data;
  },

  /**
   * Получить фотографию приветствия по ID
   * @param id - ID фотографии
   * @returns фотография приветствия
   */
  getWelcomePhotoById: async (id: string): Promise<WelcomePhoto> => {
    const response = await api.get(`/admin/photos/${id}`);
    return response.data;
  },

  /**
   * Загрузить новую фотографию приветствия
   * @param file - файл изображения
   * @param data - данные фотографии
   * @returns результат загрузки
   */
  uploadWelcomePhoto: async (file: File, data: CreateWelcomePhotoRequest): Promise<WelcomePhotoUploadResponse> => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('title', data.title);
    if (data.description) formData.append('description', data.description);
    if (data.isActive !== undefined) formData.append('isActive', data.isActive.toString());
    if (data.order !== undefined) formData.append('order', data.order.toString());

    const response = await api.post('/admin/photos/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  /**
   * Обновить фотографию приветствия
   * @param id - ID фотографии
   * @param data - данные для обновления
   * @returns обновленная фотография
   */
  updateWelcomePhoto: async (id: string, data: UpdateWelcomePhotoRequest): Promise<WelcomePhoto> => {
    const response = await api.put(`/admin/photos/${id}`, data);
    return response.data;
  },

  /**
   * Удалить фотографию приветствия
   * @param id - ID фотографии
   */
  deleteWelcomePhoto: async (id: string): Promise<void> => {
    await api.delete(`/admin/photos/${id}`);
  },

  /**
   * Массовое обновление фотографий приветствия
   * @param data - данные для массового обновления
   * @returns результат обновления
   */
  bulkUpdateWelcomePhotos: async (
    data: BulkUpdateWelcomePhotosRequest,
  ): Promise<{ message: string; updated: number }> => {
    const response = await api.put('/admin/photos/bulk-update', data);
    return response.data;
  },
};

export const philosophiesApi = {
  create: async (dto: PhilosophyDto) => {
    const { data } = await api.post(`/philosophy/`, dto);

    return data;
  },
  findAll: async (params: FindPhilosophiesDto): Promise<{ total: number; items: Philosophy[] }> => {
    const { data } = await api.get('/philosophy/', {
      params,
    });

    return data;
  },
  findOne: async (id: string): Promise<Philosophy> => {
    const { data } = await api.get(`/philosophy/${id}`);

    return data;
  },
  update: async (id: string, dto: PhilosophyDto) => {
    const { data } = await api.put(`/philosophy/${id}`, dto);

    return data;
  },
};

// Convenience exports for backward compatibility
export const getPrompts = promptsApi.getPrompts;
export const getPromptByKey = promptsApi.getPromptByKey;
export const updatePrompt = promptsApi.updatePrompt;

export { api };
