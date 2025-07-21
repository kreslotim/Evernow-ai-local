<template>
  <div class="space-y-6">
    <!-- Заголовок и навигация -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold text-gray-900">Дневная статистика воронки</h1>
        <p class="mt-1 text-sm text-gray-500">
          Детальная статистика пользователей по состояниям воронки с группировкой по дням
        </p>
      </div>
      <router-link
        to="/funnel"
        class="inline-flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
      >
        ← Назад к воронке
      </router-link>
    </div>

    <!-- Фильтры -->
    <div class="bg-white shadow rounded-lg">
      <div class="px-6 py-4 border-b border-gray-200">
        <h3 class="text-lg font-medium text-gray-900">Фильтры</h3>
      </div>
      <div class="p-6">
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <!-- Дата начала -->
          <div>
            <label for="date-from" class="block text-sm font-medium text-gray-700 mb-2"> Дата начала </label>
            <input
              id="date-from"
              v-model="localDateFrom"
              type="date"
              class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <!-- Дата окончания -->
          <div>
            <label for="date-to" class="block text-sm font-medium text-gray-700 mb-2"> Дата окончания </label>
            <input
              id="date-to"
              v-model="localDateTo"
              type="date"
              class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <!-- Кнопки управления -->
          <div class="flex items-end space-x-2">
            <button
              @click="applyFilters"
              :disabled="dailyStatsLoading"
              class="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
            >
              Применить
            </button>
            <button
              @click="resetFilters"
              :disabled="dailyStatsLoading"
              class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
            >
              Сбросить
            </button>
            <button
              @click="exportToCSV"
              :disabled="!dailyStatsHasData || dailyStatsLoading"
              class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
            >
              Экспорт CSV
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Таблица статистики -->
    <div class="bg-white shadow rounded-lg">
      <div class="px-6 py-4 border-b border-gray-200">
        <h3 class="text-lg font-medium text-gray-900">
          Статистика по дням
          <span v-if="dailyStatsPagination.total > 0" class="text-sm font-normal text-gray-500">
            ({{ dailyStatsPagination.total }} записей)
          </span>
        </h3>
      </div>

      <!-- Загрузка -->
      <div v-if="dailyStatsLoading" class="p-12 text-center">
        <div class="inline-flex items-center">
          <svg
            class="animate-spin -ml-1 mr-3 h-5 w-5 text-blue-600"
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
          Загрузка статистики...
        </div>
      </div>

      <!-- Ошибка -->
      <div v-else-if="dailyStatsError" class="p-12 text-center">
        <div class="text-red-600">
          <p class="text-sm">{{ dailyStatsError }}</p>
          <button @click="fetchDailyFunnelStats" class="mt-2 text-sm text-blue-600 hover:text-blue-700">
            Попробовать снова
          </button>
        </div>
      </div>

      <!-- Пустое состояние -->
      <div v-else-if="!dailyStatsHasData" class="p-12 text-center">
        <p class="text-gray-500">Нет данных за выбранный период</p>
      </div>

      <!-- Таблица с данными -->
      <div v-else class="overflow-x-auto">
        <table class="min-w-full divide-y divide-gray-200">
          <thead class="bg-gray-50">
            <tr>
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Дата
              </th>
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Подключился к боту
              </th>
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Первый фото анализ
              </th>
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Поделился чувствами
              </th>
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Прошёл псих тест
              </th>
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Получил блок-гипотезу
              </th>
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Пригласил 7 друзей
              </th>
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Поделился видео
              </th>
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Сделал оплату
              </th>
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Полностью прошли
              </th>
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Всего
              </th>
            </tr>
          </thead>
          <tbody class="bg-white divide-y divide-gray-200">
            <tr v-for="item in dailyFunnelStats" :key="item.date" class="hover:bg-gray-50">
              <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                {{ formatDate(item.date) }}
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                <span class="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800">
                  {{ item.BOT_JOINED }}
                </span>
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                <span class="px-2 py-1 text-xs font-medium rounded-full bg-cyan-100 text-cyan-800">
                  {{ item.FIRST_PHOTO_ANALYSIS }}
                </span>
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                <span class="px-2 py-1 text-xs font-medium rounded-full bg-yellow-100 text-yellow-800">
                  {{ item.FEELINGS_SHARED }}
                </span>
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                <span class="px-2 py-1 text-xs font-medium rounded-full bg-orange-100 text-orange-800">
                  {{ item.PSY_TEST_PASSED }}
                </span>
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                <span class="px-2 py-1 text-xs font-medium rounded-full bg-pink-100 text-pink-800">
                  {{ item.HYPOTHESIS_RECEIVED }}
                </span>
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                <span class="px-2 py-1 text-xs font-medium rounded-full bg-purple-100 text-purple-800">
                  {{ item.INVITED_FRIENDS_7 }}
                </span>
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                <span class="px-2 py-1 text-xs font-medium rounded-full bg-indigo-100 text-indigo-800">
                  {{ item.VIDEO_SHARED }}
                </span>
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                <span class="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">
                  {{ item.PAYMENT_MADE }}
                </span>
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                <span class="px-2 py-1 text-xs font-medium rounded-full bg-emerald-100 text-emerald-800">
                  {{ item.FUNNEL_COMPLETED }}
                </span>
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                {{ item.total }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Пагинация -->
      <div v-if="dailyStatsHasData" class="px-6 py-4 border-t border-gray-200">
        <div class="flex items-center justify-between">
          <div class="text-sm text-gray-700">
            Показано {{ (dailyStatsPagination.page - 1) * dailyStatsPagination.limit + 1 }} -
            {{ Math.min(dailyStatsPagination.page * dailyStatsPagination.limit, dailyStatsPagination.total) }}
            из {{ dailyStatsPagination.total }} записей
          </div>
          <div class="flex items-center space-x-2">
            <button
              @click="goToDailyStatsPage(dailyStatsPagination.page - 1)"
              :disabled="dailyStatsPagination.page <= 1 || dailyStatsLoading"
              class="px-3 py-1 text-sm text-gray-500 bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Назад
            </button>
            <span class="text-sm text-gray-700">
              Страница {{ dailyStatsPagination.page }} из {{ dailyStatsPagination.totalPages }}
            </span>
            <button
              @click="goToDailyStatsPage(dailyStatsPagination.page + 1)"
              :disabled="dailyStatsPagination.page >= dailyStatsPagination.totalPages || dailyStatsLoading"
              class="px-3 py-1 text-sm text-gray-500 bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Вперед
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import { storeToRefs } from 'pinia';
import { useFunnelStore } from '../stores/funnel';

// Store
const funnelStore = useFunnelStore();
const {
  dailyFunnelStats,
  dailyStatsLoading,
  dailyStatsError,
  dailyStatsFilters,
  dailyStatsPagination,
  dailyStatsHasData,
} = storeToRefs(funnelStore);

const { fetchDailyFunnelStats, resetDailyStatsFilters, setDailyStatsDateRange, goToDailyStatsPage } = funnelStore;

// Локальные переменные для фильтров
const localDateFrom = ref('');
const localDateTo = ref('');

/**
 * Инициализация компонента
 */
onMounted(async () => {
  // Устанавливаем дефолтные значения
  resetDailyStatsFilters();

  // Копируем значения фильтров в локальные переменные
  localDateFrom.value = dailyStatsFilters.value.dateFrom || '';
  localDateTo.value = dailyStatsFilters.value.dateTo || '';

  // Загружаем данные
  await fetchDailyFunnelStats();
});

/**
 * Отслеживание изменений фильтров и автоматическая загрузка данных
 */
watch(
  () => dailyStatsFilters.value.page,
  async () => {
    await fetchDailyFunnelStats();
  },
);

/**
 * Применение фильтров по датам
 */
const applyFilters = async () => {
  if (localDateFrom.value && localDateTo.value) {
    setDailyStatsDateRange(localDateFrom.value, localDateTo.value);
    await fetchDailyFunnelStats();
  }
};

/**
 * Сброс фильтров
 */
const resetFilters = async () => {
  resetDailyStatsFilters();
  localDateFrom.value = dailyStatsFilters.value.dateFrom || '';
  localDateTo.value = dailyStatsFilters.value.dateTo || '';
  await fetchDailyFunnelStats();
};

/**
 * Форматирование даты для отображения
 */
const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('ru-RU', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
  }).format(date);
};

/**
 * Экспорт данных в CSV
 */
const exportToCSV = () => {
  if (!dailyStatsHasData.value) return;

  const headers = [
    'Дата',
    'Подключился к боту',
    'Первый фото анализ',
    'Поделился чувствами',
    'Прошёл псих тест',
    'Получил блок-гипотезу',
    'Пригласил 7 друзей',
    'Поделился видео',
    'Сделал оплату',
    'Полностью прошли',
    'Всего',
  ];

  const csvContent = [
    headers.join(','),
    ...dailyFunnelStats.value.map((item) =>
      [
        item.date,
        item.BOT_JOINED,
        item.FIRST_PHOTO_ANALYSIS,
        item.FEELINGS_SHARED,
        item.PSY_TEST_PASSED,
        item.HYPOTHESIS_RECEIVED,
        item.INVITED_FRIENDS_7,
        item.VIDEO_SHARED,
        item.PAYMENT_MADE,
        item.FUNNEL_COMPLETED,
        item.total,
      ].join(','),
    ),
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', `daily-funnel-stats-${new Date().toISOString().split('T')[0]}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
</script>
