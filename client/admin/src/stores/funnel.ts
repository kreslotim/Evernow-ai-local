import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { usersApi, notificationApi, funnelApi } from '../api';
import type {
  UserWithStats,
  UserFilterOptions,
  UserFunnelAction,
  DailyFunnelStatsQuery,
  DailyFunnelStatsResponse,
  DailyFunnelStatsItem,
} from '../types';

export const useFunnelStore = defineStore('funnel', () => {
  // State
  const funnelUsers = ref<UserWithStats[]>([]);
  const totalFunnelUsers = ref(0);
  const isLoading = ref(false);
  const error = ref<string | null>(null);

  // Global funnel statistics - separate from current page
  const globalFunnelStats = ref({
    BOT_JOINED: 0,
    FIRST_PHOTO_ANALYSIS: 0,
    FEELINGS_SHARED: 0,
    PSY_TEST_PASSED: 0,
    HYPOTHESIS_RECEIVED: 0,
    INVITED_FRIENDS_7: 0,
    VIDEO_SHARED: 0,
    PAYMENT_MADE: 0,
    FUNNEL_COMPLETED: 0,
  });

  // Filter options - funnelAction is the key differentiator
  const funnelFilterOptions = ref<UserFilterOptions>({
    page: 1,
    limit: 20,
    search: '',
    sortBy: 'createdAt',
    sortDirection: 'desc',
    funnelAction: undefined, // Core filtering mechanism
  });

  // Daily funnel stats state
  const dailyFunnelStats = ref<DailyFunnelStatsItem[]>([]);
  const dailyStatsLoading = ref(false);
  const dailyStatsError = ref<string | null>(null);
  const dailyStatsFilters = ref<DailyFunnelStatsQuery>({
    dateFrom: undefined,
    dateTo: undefined,
    page: 1,
    limit: 30,
  });
  const dailyStatsPagination = ref({
    page: 1,
    limit: 30,
    total: 0,
    totalPages: 0,
  });

  // Computed properties
  const totalPages = computed(() => {
    return Math.ceil(totalFunnelUsers.value / funnelFilterOptions.value.limit);
  });

  // Use global stats instead of calculating from current page
  const funnelStats = computed(() => globalFunnelStats.value);

  // Daily stats computed properties
  const dailyStatsHasData = computed(() => dailyFunnelStats.value.length > 0);
  const dailyStatsDateRange = computed(() => {
    const { dateFrom, dateTo } = dailyStatsFilters.value;
    return {
      from: dateFrom || '',
      to: dateTo || '',
    };
  });

  // Conversion funnel stages with metadata
  const funnelStages = computed(() => [
    {
      key: 'all' as const,
      label: 'Все этапы',
      color: 'bg-gray-100 text-gray-800',
      description: 'Показать всех пользователей',
    },
    {
      key: 'BOT_JOINED' as const,
      label: 'Подключился к боту',
      color: 'bg-blue-100 text-blue-800',
      description: 'Пользователи, которые запустили бота',
    },
    {
      key: 'FIRST_PHOTO_ANALYSIS' as const,
      label: 'Первый фото анализ',
      color: 'bg-cyan-100 text-cyan-800',
      description: 'Сделали первый анализ фотографии',
    },
    {
      key: 'FEELINGS_SHARED' as const,
      label: 'Поделился чувствами',
      color: 'bg-yellow-100 text-yellow-800',
      description: 'Поделились своими чувствами',
    },
    {
      key: 'PSY_TEST_PASSED' as const,
      label: 'Прошёл псих тест',
      color: 'bg-orange-100 text-orange-800',
      description: 'Прошли психологический тест',
    },
    {
      key: 'HYPOTHESIS_RECEIVED' as const,
      label: 'Получил блок-гипотезу',
      color: 'bg-pink-100 text-pink-800',
      description: 'Получили персональную гипотезу',
    },
    {
      key: 'INVITED_FRIENDS_7' as const,
      label: 'Пригласил 7 друзей',
      color: 'bg-purple-100 text-purple-800',
      description: 'Привели семь друзей',
    },
    {
      key: 'VIDEO_SHARED' as const,
      label: 'Поделился видео',
      color: 'bg-indigo-100 text-indigo-800',
      description: 'Поделились видео/сделали репост',
    },
    {
      key: 'PAYMENT_MADE' as const,
      label: 'Сделал оплату',
      color: 'bg-green-100 text-green-800',
      description: 'Совершили оплату',
    },
    {
      key: 'FUNNEL_COMPLETED' as const,
      label: 'Полностью прошли',
      color: 'bg-emerald-100 text-emerald-800',
      description: 'Полностью прошли всю воронку',
    },
  ]);

  // Actions
  const fetchGlobalFunnelStats = async () => {
    try {
      const stats = await funnelApi.getFunnelStats();
      globalFunnelStats.value = stats;
    } catch (err) {
      console.error('Error fetching global funnel stats:', err);
    }
  };

  const fetchFunnelUsers = async () => {
    try {
      isLoading.value = true;
      error.value = null;

      const [usersResponse] = await Promise.all([
        usersApi.getUsers(funnelFilterOptions.value),
        fetchGlobalFunnelStats(), // Always fetch fresh global stats
      ]);

      funnelUsers.value = usersResponse.users;
      totalFunnelUsers.value = usersResponse.total;
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Произошла ошибка при загрузке данных воронки';
      console.error('Error fetching funnel users:', err);
    } finally {
      isLoading.value = false;
    }
  };

  const updateFunnelFilterOptions = (newOptions: Partial<UserFilterOptions>) => {
    funnelFilterOptions.value = { ...funnelFilterOptions.value, ...newOptions };
  };

  // Core funnel filtering logic
  const filterByFunnelAction = (action: UserFunnelAction | 'all') => {
    updateFunnelFilterOptions({
      funnelAction: action === 'all' ? undefined : action,
      page: 1, // Reset pagination when changing filter
    });
  };

  // Update individual user's funnel stage
  const updateUserFunnelAction = async (userId: string, funnelAction: UserFunnelAction) => {
    try {
      await usersApi.updateUser(userId, { funnelAction });
      // Refresh data to reflect changes
      await fetchFunnelUsers();
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Ошибка обновления этапа воронки';
      throw err;
    }
  };

  // Real telegram messaging functionality via notification API
  const sendTelegramMessage = async (funnelAction: UserFunnelAction | 'all', message: string) => {
    try {
      const result = await notificationApi.sendFunnelMessage({
        funnelAction,
        message,
      });

      return {
        success: true,
        sentCount: result.sentCount,
        failedCount: result.failedCount,
        blockedCount: result.blockedCount,
        totalTargeted: result.totalTargeted,
      };
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Ошибка отправки Telegram сообщений';
      throw err;
    }
  };

  // Get users for specific funnel action
  const getUsersByFunnelAction = (action: UserFunnelAction) => {
    return funnelUsers.value.filter((user) => user.funnelAction === action);
  };

  // Reset all filters
  const resetFunnelFilters = () => {
    funnelFilterOptions.value = {
      page: 1,
      limit: 20,
      search: '',
      sortBy: 'createdAt',
      sortDirection: 'desc',
      funnelAction: undefined,
    };
  };

  // Get funnel stage info by key
  const getFunnelStageInfo = (key: UserFunnelAction | 'all') => {
    return funnelStages.value.find((stage) => stage.key === key);
  };

  // Daily funnel stats actions

  /**
   * Загружает дневную статистику воронки
   */
  const fetchDailyFunnelStats = async () => {
    try {
      dailyStatsLoading.value = true;
      dailyStatsError.value = null;

      const response: DailyFunnelStatsResponse = await funnelApi.getDailyFunnelStats(dailyStatsFilters.value);

      dailyFunnelStats.value = response.data;
      dailyStatsPagination.value = response.pagination;
    } catch (err) {
      dailyStatsError.value = err instanceof Error ? err.message : 'Ошибка загрузки дневной статистики воронки';
      console.error('Error fetching daily funnel stats:', err);
    } finally {
      dailyStatsLoading.value = false;
    }
  };

  /**
   * Обновляет фильтры дневной статистики
   */
  const updateDailyStatsFilters = (newFilters: Partial<DailyFunnelStatsQuery>) => {
    dailyStatsFilters.value = { ...dailyStatsFilters.value, ...newFilters };
  };

  /**
   * Сбрасывает фильтры дневной статистики
   */
  const resetDailyStatsFilters = () => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    dailyStatsFilters.value = {
      dateFrom: thirtyDaysAgo.toISOString().split('T')[0],
      dateTo: new Date().toISOString().split('T')[0],
      page: 1,
      limit: 30,
    };
  };

  /**
   * Устанавливает диапазон дат для дневной статистики
   */
  const setDailyStatsDateRange = (dateFrom: string, dateTo: string) => {
    updateDailyStatsFilters({
      dateFrom,
      dateTo,
      page: 1, // сбрасываем на первую страницу при изменении диапазона
    });
  };

  /**
   * Переходит на определенную страницу дневной статистики
   */
  const goToDailyStatsPage = (page: number) => {
    updateDailyStatsFilters({ page });
  };

  return {
    // State
    funnelUsers,
    totalFunnelUsers,
    isLoading,
    error,
    funnelFilterOptions,
    globalFunnelStats,

    // Daily stats state
    dailyFunnelStats,
    dailyStatsLoading,
    dailyStatsError,
    dailyStatsFilters,
    dailyStatsPagination,

    // Computed
    totalPages,
    funnelStats,
    funnelStages,
    dailyStatsHasData,
    dailyStatsDateRange,

    // Actions
    fetchGlobalFunnelStats,
    fetchFunnelUsers,
    updateFunnelFilterOptions,
    filterByFunnelAction,
    updateUserFunnelAction,
    sendTelegramMessage,
    getUsersByFunnelAction,
    resetFunnelFilters,
    getFunnelStageInfo,

    // Daily stats actions
    fetchDailyFunnelStats,
    updateDailyStatsFilters,
    resetDailyStatsFilters,
    setDailyStatsDateRange,
    goToDailyStatsPage,
  };
});
