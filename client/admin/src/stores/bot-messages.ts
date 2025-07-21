import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { botMessagesApi } from '../api';
import type {
  BotMessage,
  GetBotMessagesQuery,
  UpdateBotMessageData,
  CreateBotMessageData,
  ImportDefaultMessagesData,
  PaginatedBotMessagesResponse,
} from '../types';

/**
 * Pinia store для управления сообщениями бота
 * Обеспечивает централизованное состояние для CRUD операций с сообщениями
 * Использует существующую систему аутентификации через botMessagesApi
 */
export const useBotMessagesStore = defineStore('botMessages', () => {
  // State
  const messages = ref<BotMessage[]>([]);
  const totalMessages = ref<number>(0);
  const totalPages = ref<number>(0);
  const isLoading = ref<boolean>(false);
  const isSaving = ref<boolean>(false);
  const isCreating = ref<boolean>(false);
  const isImporting = ref<boolean>(false);
  const error = ref<string | null>(null);
  const selectedMessage = ref<BotMessage | null>(null);

  // Фильтры и пагинация
  const filterOptions = ref<GetBotMessagesQuery>({
    page: 1,
    limit: 20,
    locale: '',
    search: '',
  });

  // Getters
  const getMessages = computed(() => messages.value);
  const getTotalMessages = computed(() => totalMessages.value);
  const getTotalPages = computed(() => totalPages.value);
  const getIsLoading = computed(() => isLoading.value);
  const getIsSaving = computed(() => isSaving.value);
  const getIsCreating = computed(() => isCreating.value);
  const getIsImporting = computed(() => isImporting.value);
  const getError = computed(() => error.value);
  const getFilterOptions = computed(() => filterOptions.value);
  const getSelectedMessage = computed(() => selectedMessage.value);

  // Computed для статистики
  const getMessagesByLocale = computed(() => {
    const ru = messages.value.filter((msg) => msg.locale === 'ru');
    const en = messages.value.filter((msg) => msg.locale === 'en');
    return { ru: ru.length, en: en.length };
  });

  const getDatabaseMessages = computed(() => {
    return messages.value.filter((msg) => msg.source === 'database').length;
  });

  // Actions

  /**
   * Загружает список сообщений с учетом фильтров и пагинации
   * @returns {Promise<PaginatedBotMessagesResponse>} Результат загрузки сообщений
   */
  const fetchMessages = async (): Promise<PaginatedBotMessagesResponse> => {
    try {
      isLoading.value = true;
      error.value = null;

      // Используем существующий botMessagesApi вместо самодельного
      const response = await botMessagesApi.getMessages(filterOptions.value);

      messages.value = response.messages || [];
      totalMessages.value = response.total || 0;
      totalPages.value = response.totalPages || 1;

      return response;
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Ошибка загрузки сообщений';
      console.error('Error fetching bot messages:', err);

      // При ошибке возвращаем пустой результат
      const emptyResponse: PaginatedBotMessagesResponse = {
        messages: [],
        total: 0,
        page: filterOptions.value.page || 1,
        limit: filterOptions.value.limit || 20,
        totalPages: 0,
      };

      messages.value = [];
      totalMessages.value = 0;
      totalPages.value = 0;

      return emptyResponse;
    } finally {
      isLoading.value = false;
    }
  };

  /**
   * Получает конкретное сообщение по ключу и локали
   * @param {string} key - Ключ сообщения
   * @param {string} locale - Локаль сообщения (ru/en)
   * @returns {Promise<BotMessage | null>} Найденное сообщение или null
   */
  const getMessage = async (key: string, locale: string): Promise<BotMessage | null> => {
    try {
      isLoading.value = true;
      error.value = null;

      const response = await botMessagesApi.getMessage(key, locale);
      selectedMessage.value = response;

      return response;
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Ошибка загрузки сообщения';
      console.error('Error fetching bot message:', err);
      selectedMessage.value = null;
      return null;
    } finally {
      isLoading.value = false;
    }
  };

  /**
   * Обновляет существующее сообщение в базе данных
   * @param {string} key - Ключ сообщения
   * @param {string} locale - Локаль сообщения
   * @param {UpdateBotMessageData} data - Данные для обновления
   * @returns {Promise<BotMessage>} Обновленное сообщение
   */
  const updateMessage = async (key: string, locale: string, data: UpdateBotMessageData): Promise<BotMessage> => {
    try {
      isSaving.value = true;
      error.value = null;

      const response = await botMessagesApi.updateMessage(key, locale, data);

      // Обновляем в локальном массиве
      const index = messages.value.findIndex((msg) => msg.key === key && msg.locale === locale);
      if (index !== -1) {
        messages.value[index] = response;
      } else {
        // Если сообщения не было в списке, добавляем его
        messages.value.unshift(response);
        totalMessages.value++;
      }

      if (selectedMessage.value && selectedMessage.value.key === key && selectedMessage.value.locale === locale) {
        selectedMessage.value = response;
      }

      return response;
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Ошибка обновления сообщения';
      console.error('Error updating bot message:', err);
      throw err;
    } finally {
      isSaving.value = false;
    }
  };

  /**
   * Создает новое сообщение в базе данных
   * @param {CreateBotMessageData} data - Данные нового сообщения
   * @returns {Promise<BotMessage>} Созданное сообщение
   */
  const createMessage = async (data: CreateBotMessageData): Promise<BotMessage> => {
    try {
      isCreating.value = true;
      error.value = null;

      const response = await botMessagesApi.createMessage(data);

      // Добавляем в начало списка
      messages.value.unshift(response);
      totalMessages.value++;

      return response;
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Ошибка создания сообщения';
      console.error('Error creating bot message:', err);
      throw err;
    } finally {
      isCreating.value = false;
    }
  };

  /**
   * Удаляет кастомное сообщение из БД (возвращает к дефолтному значению)
   * @param {string} key - Ключ сообщения
   * @param {string} locale - Локаль сообщения
   */
  const deleteMessage = async (key: string, locale: string): Promise<void> => {
    try {
      isLoading.value = true;
      error.value = null;

      await botMessagesApi.deleteMessage(key, locale);

      // Обновляем локальный стейт - либо удаляем, либо помечаем как default
      const index = messages.value.findIndex((msg) => msg.key === key && msg.locale === locale);
      if (index !== -1) {
        // При удалении из БД сообщение может либо исчезнуть, либо вернуться к default
        // Лучше перезагрузить данные для корректного отображения
        await fetchMessages();
      }

      if (selectedMessage.value && selectedMessage.value.key === key && selectedMessage.value.locale === locale) {
        selectedMessage.value = null;
      }
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Ошибка удаления сообщения';
      console.error('Error deleting bot message:', err);
      throw err;
    } finally {
      isLoading.value = false;
    }
  };

  /**
   * Импортирует дефолтные сообщения из файлов локализации в базу данных
   * @param {ImportDefaultMessagesData} data - Параметры импорта
   * @returns {Promise<{imported: number, skipped: number}>} Результат импорта
   */
  const importDefaultMessages = async (
    data: ImportDefaultMessagesData,
  ): Promise<{ imported: number; skipped: number }> => {
    try {
      isImporting.value = true;
      error.value = null;

      const response = await botMessagesApi.importDefaultMessages(data);

      // Перезагружаем сообщения после импорта
      await fetchMessages();

      return {
        imported: response.imported || 0,
        skipped: response.skipped || 0,
      };
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Ошибка импорта сообщений';
      console.error('Error importing default messages:', err);
      throw err;
    } finally {
      isImporting.value = false;
    }
  };

  /**
   * Обновляет опции фильтрации
   * @param {Partial<GetBotMessagesQuery>} options - Новые опции фильтрации
   */
  const updateFilterOptions = (options: Partial<GetBotMessagesQuery>) => {
    filterOptions.value = { ...filterOptions.value, ...options };
  };

  /**
   * Сбрасывает состояние ошибки
   */
  const clearError = () => {
    error.value = null;
  };

  /**
   * Сбрасывает выбранное сообщение
   */
  const clearSelectedMessage = () => {
    selectedMessage.value = null;
  };

  return {
    // State
    messages,
    totalMessages,
    totalPages,
    isLoading,
    isSaving,
    isCreating,
    isImporting,
    error,
    filterOptions,
    selectedMessage,

    // Getters
    getMessages,
    getTotalMessages,
    getTotalPages,
    getIsLoading,
    getIsSaving,
    getIsCreating,
    getIsImporting,
    getError,
    getFilterOptions,
    getSelectedMessage,
    getMessagesByLocale,
    getDatabaseMessages,

    // Actions
    fetchMessages,
    getMessage,
    updateMessage,
    createMessage,
    deleteMessage,
    importDefaultMessages,
    updateFilterOptions,
    clearError,
    clearSelectedMessage,
  };
});
