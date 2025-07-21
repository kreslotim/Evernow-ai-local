<script setup lang="ts">
import { ref, onMounted, computed, watch, onBeforeUnmount } from 'vue';
import { useFunnelStore } from '../stores/funnel';
import { ElMessage } from 'element-plus';
import UserEditDialog from '../components/UserEditDialog.vue';
import type { UserFunnelAction, FunnelState } from '../types';

// Initialize stores and router
const funnelStore = useFunnelStore();

// Component state
const funnelUsers = computed(() => funnelStore.funnelUsers);
const totalFunnelUsers = computed(() => funnelStore.totalFunnelUsers);
const isLoading = computed(() => funnelStore.isLoading);
const error = computed(() => funnelStore.error);
const funnelFilterOptions = computed(() => funnelStore.funnelFilterOptions);
const funnelStats = computed(() => funnelStore.funnelStats);
const funnelStages = computed(() => funnelStore.funnelStages);

// Auto-refresh functionality
const refreshInterval = ref<number | null>(null);
const refreshRate = 15000; // 15 seconds

// Edit dialog state
const editUserDialogVisible = ref(false);
const selectedUserId = ref('');

// Search and filtering state
const searchQuery = ref('');
const searchTimeout = ref<number | null>(null);
const selectedFunnelAction = ref<UserFunnelAction | 'all'>('all');

// Telegram messaging state
const telegramMessageDialogVisible = ref(false);
const messageText = ref('');
const messagingInProgress = ref(false);

// Core data fetching
const fetchFunnelUsers = async () => {
  try {
    await funnelStore.fetchFunnelUsers();
  } catch (error) {
    console.error('Error fetching funnel users:', error);
  }
};

// Search input handler with debouncing
const handleSearchInput = () => {
  if (searchTimeout.value) {
    clearTimeout(searchTimeout.value);
  }

  searchTimeout.value = setTimeout(() => {
    funnelStore.updateFunnelFilterOptions({
      search: searchQuery.value,
      page: 1,
    });
    fetchFunnelUsers();
  }, 500) as unknown as number;
};

// Pagination handlers
const handlePageChange = (page: number) => {
  funnelStore.updateFunnelFilterOptions({ page });
  fetchFunnelUsers();
};

const handleSizeChange = (size: number) => {
  funnelStore.updateFunnelFilterOptions({
    limit: size,
    page: 1,
  });
  fetchFunnelUsers();
};

// Core funnel filtering - the main feature
const handleFunnelActionChange = () => {
  funnelStore.filterByFunnelAction(selectedFunnelAction.value);
  fetchFunnelUsers();
};

// User editing
const openEditDialog = (userId: string) => {
  selectedUserId.value = userId;
  editUserDialogVisible.value = true;
};

const closeEditDialog = () => {
  editUserDialogVisible.value = false;
  selectedUserId.value = '';
  fetchFunnelUsers();
};

// Update user's funnel stage
const updateUserFunnelAction = async (userId: string, newAction: UserFunnelAction) => {
  try {
    await funnelStore.updateUserFunnelAction(userId, newAction);
    ElMessage.success('Этап воронки успешно обновлен');
  } catch (error) {
    console.error('Error updating funnel action:', error);
    ElMessage.error('Не удалось обновить этап воронки');
  }
};

// Telegram messaging functionality
const openTelegramMessageDialog = () => {
  // Allow sending to all users or specific funnel action
  telegramMessageDialogVisible.value = true;
};

const sendTelegramMessages = async () => {
  try {
    if (!messageText.value.trim()) {
      ElMessage.warning('Введите текст сообщения');
      return;
    }

    messagingInProgress.value = true;
    const funnelAction = selectedFunnelAction.value;

    const result = await funnelStore.sendTelegramMessage(funnelAction, messageText.value);

    let successMessage = `Сообщения отправлены ${result.sentCount} пользователям`;

    if (result.failedCount > 0) {
      successMessage += `, ${result.failedCount} не доставлено`;
    }

    if (result.blockedCount > 0) {
      successMessage += `, ${result.blockedCount} заблокировали бота`;
    }

    ElMessage.success(successMessage);
    telegramMessageDialogVisible.value = false;
    messageText.value = '';
  } catch (error) {
    console.error('Error sending telegram messages:', error);
    ElMessage.error('Не удалось отправить сообщения');
  } finally {
    messagingInProgress.value = false;
  }
};

// Utility functions
const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleString('ru-RU', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const getFunnelStageInfo = (action: UserFunnelAction) => {
  return funnelStore.getFunnelStageInfo(action);
};

// Auto-refresh management
const startPolling = () => {
  stopPolling();
  refreshInterval.value = setInterval(fetchFunnelUsers, refreshRate) as unknown as number;
};

const stopPolling = () => {
  if (refreshInterval.value) {
    clearInterval(refreshInterval.value);
    refreshInterval.value = null;
  }
};

// Watchers
watch(selectedFunnelAction, handleFunnelActionChange);

// Lifecycle hooks
onMounted(async () => {
  await fetchFunnelUsers();
  startPolling();
});

onBeforeUnmount(() => {
  stopPolling();
  if (searchTimeout.value) {
    clearTimeout(searchTimeout.value);
  }
});
</script>

<template>
  <div>
    <h1 class="text-2xl font-semibold text-gray-900 mb-6">Воронка</h1>

    <!-- Funnel Analytics Dashboard -->
    <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
      <div
        v-for="stage in funnelStages.slice(1)"
        :key="stage.key"
        class="bg-white p-4 rounded-lg shadow border-l-4 border-blue-400"
      >
        <div class="text-2xl font-bold text-gray-900">{{ funnelStats[stage.key as FunnelState] }}</div>
        <div class="text-sm text-gray-600 font-medium">{{ stage.label }}</div>
        <div class="text-xs text-gray-500 mt-1">{{ stage.description }}</div>
      </div>
    </div>

    <!-- Filters and Controls -->
    <div class="bg-white p-4 rounded-lg shadow mb-6">
      <div class="flex flex-col md:flex-row gap-4 mb-4">
        <!-- Search Input -->
        <div class="flex-1">
          <div class="relative">
            <input
              v-model="searchQuery"
              @input="handleSearchInput"
              type="text"
              placeholder="Поиск по имени, TelegramID или email..."
              class="w-full p-2 pl-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-5 w-5 text-gray-400 absolute left-3 top-3"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </div>
        </div>

        <!-- Funnel Action Filter - Core Feature -->
        <div class="min-w-[200px]">
          <select
            v-model="selectedFunnelAction"
            class="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
          >
            <option v-for="stage in funnelStages" :key="stage.key" :value="stage.key">
              {{ stage.label }}
            </option>
          </select>
        </div>

        <!-- Daily Stats Button -->
        <div>
          <router-link
            to="/daily-funnel-stats"
            class="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 flex items-center gap-2"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            Дневная статистика
          </router-link>
        </div>

        <!-- Telegram Messaging Button -->
        <div>
          <button
            @click="openTelegramMessageDialog"
            :disabled="selectedFunnelAction !== 'all' && funnelUsers.length === 0"
            class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
              />
            </svg>
            Отправить сообщение
          </button>
        </div>
      </div>
    </div>

    <!-- Funnel Users Table -->
    <div class="bg-white rounded-lg shadow overflow-hidden">
      <!-- Loading State -->
      <div v-if="isLoading" class="flex justify-center items-center p-10">
        <svg
          class="animate-spin h-10 w-10 text-blue-500"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path
            class="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          ></path>
        </svg>
      </div>

      <!-- Error State -->
      <div v-else-if="error" class="p-6 text-center">
        <div class="text-red-500 mb-4">{{ error }}</div>
        <button @click="fetchFunnelUsers" class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">
          Повторить
        </button>
      </div>

      <!-- Empty State -->
      <div v-else-if="funnelUsers.length === 0" class="p-10 text-center text-gray-500">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="h-12 w-12 mx-auto mb-4 text-gray-300"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
          />
        </svg>
        <div class="text-lg font-medium mb-2">Пользователи не найдены</div>
        <div class="text-sm">Для выбранного этапа воронки нет пользователей</div>
      </div>

      <!-- Data Table -->
      <div v-else>
        <div class="overflow-x-auto">
          <table class="min-w-full divide-y divide-gray-200">
            <thead class="bg-gray-50">
              <tr>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Пользователь
                </th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Этап воронки
                </th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Активность
                </th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Дата регистрации
                </th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Действия</th>
              </tr>
            </thead>
            <tbody class="bg-white divide-y divide-gray-200">
              <tr
                v-for="user in funnelUsers"
                :key="user.id"
                :class="{
                  'bg-red-50': user.isBanned,
                  'bg-orange-50': user.isBotBlocked,
                }"
              >
                <td class="px-6 py-4 whitespace-nowrap">
                  <div class="flex flex-col">
                    <div class="flex items-center gap-2">
                      <div class="text-sm font-medium text-gray-900">
                        {{ user.telegramUsername || 'Нет имени' }}
                      </div>
                      <span
                        v-if="user.isBotBlocked"
                        class="px-2 py-1 text-xs bg-orange-100 text-orange-800 rounded-full"
                        title="Пользователь заблокировал бота"
                      >
                        🚫 Заблокирован
                      </span>
                    </div>
                    <div class="text-sm text-gray-500">ID: {{ user.telegramId || 'Нет ID' }}</div>
                    <div class="text-sm text-gray-500" v-if="user.email">
                      {{ user.email }}
                    </div>
                  </div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <div class="flex flex-col">
                    <span
                      v-if="user.funnelAction"
                      :class="[
                        'px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full',
                        getFunnelStageInfo(user.funnelAction)?.color || 'bg-gray-100 text-gray-800',
                      ]"
                    >
                      {{ getFunnelStageInfo(user.funnelAction)?.label || user.funnelAction }}
                    </span>
                    <span
                      v-else
                      class="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800"
                    >
                      Не определен
                    </span>
                    <div class="mt-2">
                      <select
                        @change="
                          updateUserFunnelAction(
                            user.id,
                            ($event.target as HTMLSelectElement).value as UserFunnelAction,
                          )
                        "
                        class="text-xs p-1 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                      >
                        <option value="">Изменить этап</option>
                        <option v-for="stage in funnelStages.slice(1)" :key="stage.key" :value="stage.key">
                          {{ stage.label }}
                        </option>
                      </select>
                    </div>
                  </div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <div class="text-sm text-gray-900">
                    <div>Анализы: {{ user.analyzesCount || 0 }}</div>
                    <div>Рефералы: {{ user.referralsCount || 0 }}</div>
                    <div>Кредиты: {{ user.analysisCredits }}</div>
                  </div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <div class="text-sm text-gray-900">{{ formatDate(user.createdAt) }}</div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <button
                    @click="openEditDialog(user.id)"
                    class="text-blue-600 hover:text-blue-900"
                    title="Редактировать"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      class="h-5 w-5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                      />
                    </svg>
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Pagination -->
        <div class="p-4 flex items-center justify-between border-t border-gray-200">
          <div class="flex-1 flex justify-between sm:hidden">
            <button
              @click="handlePageChange(funnelFilterOptions.page - 1)"
              :disabled="funnelFilterOptions.page <= 1"
              class="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md bg-white text-gray-700 hover:bg-gray-50 disabled:bg-gray-100 disabled:text-gray-400"
            >
              Назад
            </button>
            <button
              @click="handlePageChange(funnelFilterOptions.page + 1)"
              :disabled="funnelFilterOptions.page * funnelFilterOptions.limit >= totalFunnelUsers"
              class="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md bg-white text-gray-700 hover:bg-gray-50 disabled:bg-gray-100 disabled:text-gray-400"
            >
              Вперед
            </button>
          </div>
          <div class="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
            <div>
              <p class="text-sm text-gray-700">
                Показано
                <span class="font-medium">{{ (funnelFilterOptions.page - 1) * funnelFilterOptions.limit + 1 }}</span>
                по
                <span class="font-medium">
                  {{ Math.min(funnelFilterOptions.page * funnelFilterOptions.limit, totalFunnelUsers) }}
                </span>
                из
                <span class="font-medium">{{ totalFunnelUsers.toLocaleString() }}</span>
                результатов
              </p>
            </div>
            <div class="flex items-center space-x-2">
              <select
                v-model="funnelFilterOptions.limit"
                @change="handleSizeChange(Number(($event.target as HTMLSelectElement).value))"
                class="p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="10">10 на странице</option>
                <option value="20">20 на странице</option>
                <option value="50">50 на странице</option>
              </select>

              <nav class="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                <button
                  @click="handlePageChange(funnelFilterOptions.page - 1)"
                  :disabled="funnelFilterOptions.page <= 1"
                  class="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:bg-gray-100 disabled:text-gray-400"
                >
                  <svg class="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path
                      fill-rule="evenodd"
                      d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z"
                      clip-rule="evenodd"
                    />
                  </svg>
                </button>

                <button
                  @click="handlePageChange(funnelFilterOptions.page + 1)"
                  :disabled="funnelFilterOptions.page * funnelFilterOptions.limit >= totalFunnelUsers"
                  class="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:bg-gray-100 disabled:text-gray-400"
                >
                  <svg class="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path
                      fill-rule="evenodd"
                      d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                      clip-rule="evenodd"
                    />
                  </svg>
                </button>
              </nav>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- User Edit Dialog -->
    <UserEditDialog
      v-if="editUserDialogVisible"
      :visible="editUserDialogVisible"
      :user-id="selectedUserId"
      @close="closeEditDialog"
    />

    <!-- Telegram Messaging Dialog -->
    <div
      v-if="telegramMessageDialogVisible"
      class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50"
    >
      <div class="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
        <div class="mt-3">
          <h3 class="text-lg font-medium text-gray-900 mb-4 flex items-center gap-2">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-6 w-6 text-blue-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
              />
            </svg>
            Отправить Telegram сообщения
          </h3>
          <p class="text-sm text-gray-500 mb-4">
            Сообщение будет отправлено
            <span v-if="selectedFunnelAction === 'all'" class="font-medium text-blue-600">
              всем активным пользователям (все этапы воронки)
            </span>
            <span v-else class="font-medium">
              пользователям на этапе "{{ getFunnelStageInfo(selectedFunnelAction)?.label }}"
            </span>
          </p>
          <div class="mb-2">
            <label class="block text-sm font-medium text-gray-700 mb-1">
              Сообщение (поддерживается HTML форматирование)
            </label>
            <div class="text-xs text-gray-500 mb-2">
              Используйте HTML теги: &lt;b&gt;жирный&lt;/b&gt;, &lt;i&gt;курсив&lt;/i&gt;,
              &lt;u&gt;подчеркнутый&lt;/u&gt;, &lt;a href="url"&gt;ссылка&lt;/a&gt;
            </div>
          </div>
          <textarea
            v-model="messageText"
            placeholder="Введите текст сообщения с HTML форматированием..."
            class="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 h-32 resize-none"
          >
          </textarea>
          <div class="flex gap-2 mt-4">
            <button
              @click="sendTelegramMessages"
              :disabled="!messageText.trim() || messagingInProgress"
              class="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <svg
                v-if="messagingInProgress"
                class="animate-spin h-4 w-4"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path
                  class="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
              {{ messagingInProgress ? 'Отправка...' : 'Отправить' }}
            </button>
            <button
              @click="telegramMessageDialogVisible = false"
              class="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400"
            >
              Отмена
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
