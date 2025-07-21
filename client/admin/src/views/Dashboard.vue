<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { dashboardApi, offersApi } from '../api';
import type { DashboardStats, OfferStats } from '../types';

const isLoading = ref(true);
const stats = ref<DashboardStats>({
  totalUsers: 0,
  activeUsers: 0,
  bannedUsers: 0,
  usersLast30Days: 0,
  totalAnalyzes: 0,
  completedAnalyzes: 0,
  pendingAnalyzes: 0,
  failedAnalyzes: 0,
  analyzesLast30Days: 0,
  funnelCompletedUsers: 0,
  totalOffers: 0,
  pendingOffers: 0,
  approvedOffers: 0,
  rejectedOffers: 0,
  offersLast30Days: 0,
});

const offerStats = ref<OfferStats>({
  total: 0,
  pending: 0,
  approved: 0,
  rejected: 0,
  last30Days: 0,
});

// Derived analytics metrics for better insights
const analytics = computed(() => ({
  userEngagementRate:
    stats.value.totalUsers > 0 ? ((stats.value.activeUsers / stats.value.totalUsers) * 100).toFixed(1) : 0,
  userGrowthRate:
    stats.value.totalUsers > 0 ? ((stats.value.usersLast30Days / stats.value.totalUsers) * 100).toFixed(1) : 0,
  banRate: stats.value.totalUsers > 0 ? ((stats.value.bannedUsers / stats.value.totalUsers) * 100).toFixed(1) : 0,
  analysisSuccessRate:
    stats.value.totalAnalyzes > 0 ? ((stats.value.completedAnalyzes / stats.value.totalAnalyzes) * 100).toFixed(1) : 0,
  analysisFailureRate:
    stats.value.totalAnalyzes > 0 ? ((stats.value.failedAnalyzes / stats.value.totalAnalyzes) * 100).toFixed(1) : 0,
  analysisPendingRate:
    stats.value.totalAnalyzes > 0 ? ((stats.value.pendingAnalyzes / stats.value.totalAnalyzes) * 100).toFixed(1) : 0,
  analysisGrowthRate:
    stats.value.totalAnalyzes > 0 ? ((stats.value.analyzesLast30Days / stats.value.totalAnalyzes) * 100).toFixed(1) : 0,
  // Offer analytics
  offerApprovalRate:
    offerStats.value.total > 0 ? ((offerStats.value.approved / offerStats.value.total) * 100).toFixed(1) : 0,
  offerRejectionRate:
    offerStats.value.total > 0 ? ((offerStats.value.rejected / offerStats.value.total) * 100).toFixed(1) : 0,
  offerGrowthRate:
    offerStats.value.total > 0 ? ((offerStats.value.last30Days / offerStats.value.total) * 100).toFixed(1) : 0,
  systemHealth: stats.value.pendingAnalyzes + stats.value.failedAnalyzes < 10 ? 'Excellent' : 'Needs Attention',
}));

const fetchStats = async () => {
  try {
    isLoading.value = true;

    // Fetch dashboard stats and offer stats in parallel
    const [dashboardResponse, offerResponse] = await Promise.all([
      dashboardApi.getStats(),
      offersApi.getOfferStats().catch(() => ({ total: 0, pending: 0, approved: 0, rejected: 0, last30Days: 0 })), // Fallback if offers API fails
    ]);

    stats.value = dashboardResponse;
    offerStats.value = offerResponse;

    // Merge offer stats into main stats for convenience
    stats.value.totalOffers = offerResponse.total;
    stats.value.pendingOffers = offerResponse.pending;
    stats.value.approvedOffers = offerResponse.approved;
    stats.value.rejectedOffers = offerResponse.rejected;
    stats.value.offersLast30Days = offerResponse.last30Days;
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
  } finally {
    isLoading.value = false;
  }
};

onMounted(() => {
  fetchStats();
});
</script>

<template>
  <div>
    <h1 class="text-2xl font-semibold text-gray-900 mb-6">Дашборд</h1>

    <div v-if="isLoading" class="flex justify-center items-center h-64">
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

    <div v-else class="space-y-8">
      <!-- User Metrics Section -->
      <div>
        <h2 class="text-lg font-medium text-gray-900 mb-4">Пользователи</h2>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <!-- 1. Total Users -->
          <div class="bg-white rounded-lg shadow p-6 border-l-4 border-blue-500">
            <div class="flex items-center">
              <div class="p-3 rounded-full bg-blue-100 text-blue-500">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  class="h-8 w-8"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                  />
                </svg>
              </div>
              <div class="ml-4">
                <h3 class="text-gray-500 text-sm font-medium">Всего пользователей</h3>
                <p class="text-3xl font-semibold text-gray-900">{{ stats.totalUsers.toLocaleString() }}</p>
                <p class="text-sm text-blue-600">База пользователей</p>
              </div>
            </div>
          </div>

          <!-- 2. Active Users -->
          <div class="bg-white rounded-lg shadow p-6 border-l-4 border-green-500">
            <div class="flex items-center">
              <div class="p-3 rounded-full bg-green-100 text-green-500">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  class="h-8 w-8"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                  />
                </svg>
              </div>
              <div class="ml-4">
                <h3 class="text-gray-500 text-sm font-medium">Активные пользователи</h3>
                <p class="text-3xl font-semibold text-gray-900">{{ stats.activeUsers.toLocaleString() }}</p>
                <p class="text-sm text-green-600">{{ analytics.userEngagementRate }}% вовлеченность</p>
              </div>
            </div>
          </div>

          <!-- 3. Banned Users -->
          <div class="bg-white rounded-lg shadow p-6 border-l-4 border-red-500">
            <div class="flex items-center">
              <div class="p-3 rounded-full bg-red-100 text-red-500">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  class="h-8 w-8"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
                  />
                </svg>
              </div>
              <div class="ml-4">
                <h3 class="text-gray-500 text-sm font-medium">Заблокированные</h3>
                <p class="text-3xl font-semibold text-gray-900">{{ stats.bannedUsers.toLocaleString() }}</p>
                <p class="text-sm text-red-600">{{ analytics.banRate }}% от общего числа</p>
              </div>
            </div>
          </div>

          <!-- 4. Users Last 30 Days -->
          <div class="bg-white rounded-lg shadow p-6 border-l-4 border-indigo-500">
            <div class="flex items-center">
              <div class="p-3 rounded-full bg-indigo-100 text-indigo-500">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  class="h-8 w-8"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
                  />
                </svg>
              </div>
              <div class="ml-4">
                <h3 class="text-gray-500 text-sm font-medium">Новые за 30 дней</h3>
                <p class="text-3xl font-semibold text-gray-900">{{ stats.usersLast30Days.toLocaleString() }}</p>
                <p class="text-sm text-indigo-600">+{{ analytics.userGrowthRate }}% рост</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Analysis Metrics Section -->
      <div>
        <h2 class="text-xl font-semibold text-gray-900 mb-6">Анализы</h2>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          <!-- 5. Total Analyses -->
          <div
            class="bg-white rounded-xl shadow-lg p-8 border-l-4 border-purple-500 hover:shadow-xl transition-shadow duration-300"
          >
            <div class="flex items-center">
              <div class="p-4 rounded-full bg-purple-100 text-purple-500">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  class="h-10 w-10"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                  />
                </svg>
              </div>
              <div class="ml-5">
                <h3 class="text-gray-500 text-sm font-medium uppercase tracking-wide">Всего анализов</h3>
                <p class="text-4xl font-bold text-gray-900 mt-1">{{ stats.totalAnalyzes.toLocaleString() }}</p>
                <p class="text-sm text-purple-600 mt-2 font-medium">Общий объем</p>
              </div>
            </div>
          </div>

          <!-- 6. Completed Analyses -->
          <div
            class="bg-white rounded-xl shadow-lg p-8 border-l-4 border-emerald-500 hover:shadow-xl transition-shadow duration-300"
          >
            <div class="flex items-center">
              <div class="p-4 rounded-full bg-emerald-100 text-emerald-500">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  class="h-10 w-10"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <div class="ml-5">
                <h3 class="text-gray-500 text-sm font-medium uppercase tracking-wide">Завершенные</h3>
                <p class="text-4xl font-bold text-gray-900 mt-1">{{ stats.completedAnalyzes.toLocaleString() }}</p>
                <p class="text-sm text-emerald-600 mt-2 font-medium">{{ analytics.analysisSuccessRate }}% успешность</p>
              </div>
            </div>
          </div>

          <!-- 7. Pending Analyses -->
          <div
            class="bg-white rounded-xl shadow-lg p-8 border-l-4 border-yellow-500 hover:shadow-xl transition-shadow duration-300"
          >
            <div class="flex items-center">
              <div class="p-4 rounded-full bg-yellow-100 text-yellow-500">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  class="h-10 w-10"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <div class="ml-5">
                <h3 class="text-gray-500 text-sm font-medium uppercase tracking-wide">В обработке</h3>
                <p class="text-4xl font-bold text-gray-900 mt-1">{{ stats.pendingAnalyzes.toLocaleString() }}</p>
                <p class="text-sm text-yellow-600 mt-2 font-medium">{{ analytics.analysisPendingRate }}% в очереди</p>
              </div>
            </div>
          </div>

          <!-- 8. Failed Analyses -->
          <div
            class="bg-white rounded-xl shadow-lg p-8 border-l-4 border-rose-500 hover:shadow-xl transition-shadow duration-300"
          >
            <div class="flex items-center">
              <div class="p-4 rounded-full bg-rose-100 text-rose-500">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  class="h-10 w-10"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
              </div>
              <div class="ml-5">
                <h3 class="text-gray-500 text-sm font-medium uppercase tracking-wide">Неудачные</h3>
                <p class="text-4xl font-bold text-gray-900 mt-1">{{ stats.failedAnalyzes.toLocaleString() }}</p>
                <p class="text-sm text-rose-600 mt-2 font-medium">{{ analytics.analysisFailureRate }}% ошибок</p>
              </div>
            </div>
          </div>

          <!-- 9. Analyses Last 30 Days -->
          <div
            class="bg-white rounded-xl shadow-lg p-8 border-l-4 border-cyan-500 hover:shadow-xl transition-shadow duration-300"
          >
            <div class="flex items-center">
              <div class="p-4 rounded-full bg-cyan-100 text-cyan-500">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  class="h-10 w-10"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M13 10V3L4 14h7v7l9-11h-7z"
                  />
                </svg>
              </div>
              <div class="ml-5">
                <h3 class="text-gray-500 text-sm font-medium uppercase tracking-wide">За 30 дней</h3>
                <p class="text-4xl font-bold text-gray-900 mt-1">{{ stats.analyzesLast30Days.toLocaleString() }}</p>
                <p class="text-sm text-cyan-600 mt-2 font-medium">+{{ analytics.analysisGrowthRate }}% активность</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- User Suggestions Section -->
      <div>
        <h2 class="text-xl font-semibold text-gray-900 mb-6">Предложения пользователей</h2>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          <!-- Total Offers -->
          <div
            class="bg-white rounded-xl shadow-lg p-8 border-l-4 border-blue-500 hover:shadow-xl transition-shadow duration-300"
          >
            <div class="flex items-center">
              <div class="p-4 rounded-full bg-blue-100 text-blue-500">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  class="h-10 w-10"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                  />
                </svg>
              </div>
              <div class="ml-5">
                <h3 class="text-gray-500 text-sm font-medium uppercase tracking-wide">Всего предложений</h3>
                <p class="text-4xl font-bold text-gray-900 mt-1">{{ (stats.totalOffers || 0).toLocaleString() }}</p>
                <p class="text-sm text-blue-600 mt-2 font-medium">Общее количество</p>
              </div>
            </div>
          </div>

          <!-- Pending Offers -->
          <div
            class="bg-white rounded-xl shadow-lg p-8 border-l-4 border-yellow-500 hover:shadow-xl transition-shadow duration-300"
          >
            <div class="flex items-center">
              <div class="p-4 rounded-full bg-yellow-100 text-yellow-500">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  class="h-10 w-10"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <div class="ml-5">
                <h3 class="text-gray-500 text-sm font-medium uppercase tracking-wide">Ожидают рассмотрения</h3>
                <p class="text-4xl font-bold text-gray-900 mt-1">{{ (stats.pendingOffers || 0).toLocaleString() }}</p>
                <p class="text-sm text-yellow-600 mt-2 font-medium">Требуют внимания</p>
              </div>
            </div>
          </div>

          <!-- Approved Offers -->
          <div
            class="bg-white rounded-xl shadow-lg p-8 border-l-4 border-green-500 hover:shadow-xl transition-shadow duration-300"
          >
            <div class="flex items-center">
              <div class="p-4 rounded-full bg-green-100 text-green-500">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  class="h-10 w-10"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <div class="ml-5">
                <h3 class="text-gray-500 text-sm font-medium uppercase tracking-wide">Одобрено</h3>
                <p class="text-4xl font-bold text-gray-900 mt-1">{{ (stats.approvedOffers || 0).toLocaleString() }}</p>
                <p class="text-sm text-green-600 mt-2 font-medium">{{ analytics.offerApprovalRate }}% одобрения</p>
              </div>
            </div>
          </div>

          <!-- Rejected Offers -->
          <div
            class="bg-white rounded-xl shadow-lg p-8 border-l-4 border-red-500 hover:shadow-xl transition-shadow duration-300"
          >
            <div class="flex items-center">
              <div class="p-4 rounded-full bg-red-100 text-red-500">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  class="h-10 w-10"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <div class="ml-5">
                <h3 class="text-gray-500 text-sm font-medium uppercase tracking-wide">Отклонено</h3>
                <p class="text-4xl font-bold text-gray-900 mt-1">{{ (stats.rejectedOffers || 0).toLocaleString() }}</p>
                <p class="text-sm text-red-600 mt-2 font-medium">{{ analytics.offerRejectionRate }}% отклонений</p>
              </div>
            </div>
          </div>

          <!-- Offers Last 30 Days -->
          <div
            class="bg-white rounded-xl shadow-lg p-8 border-l-4 border-purple-500 hover:shadow-xl transition-shadow duration-300"
          >
            <div class="flex items-center">
              <div class="p-4 rounded-full bg-purple-100 text-purple-500">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  class="h-10 w-10"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
                  />
                </svg>
              </div>
              <div class="ml-5">
                <h3 class="text-gray-500 text-sm font-medium uppercase tracking-wide">За 30 дней</h3>
                <p class="text-4xl font-bold text-gray-900 mt-1">
                  {{ (stats.offersLast30Days || 0).toLocaleString() }}
                </p>
                <p class="text-sm text-purple-600 mt-2 font-medium">+{{ analytics.offerGrowthRate }}% активность</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Executive Summary Cards -->
      <div>
        <h2 class="text-lg font-medium text-gray-900 mb-4">Ключевые показатели</h2>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
          <!-- User Engagement -->
          <div class="bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg shadow p-6 text-white">
            <div class="flex items-center justify-between">
              <div>
                <h3 class="text-blue-100 text-sm font-medium">Вовлеченность пользователей</h3>
                <p class="text-3xl font-bold">{{ analytics.userEngagementRate }}%</p>
                <p class="text-blue-100 text-sm">Активные пользователи</p>
              </div>
              <div class="p-3 bg-blue-400 bg-opacity-50 rounded-full">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  class="h-8 w-8"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
                  />
                </svg>
              </div>
            </div>
          </div>

          <!-- Analysis Quality -->
          <div class="bg-gradient-to-r from-emerald-500 to-emerald-600 rounded-lg shadow p-6 text-white">
            <div class="flex items-center justify-between">
              <div>
                <h3 class="text-emerald-100 text-sm font-medium">Качество анализов</h3>
                <p class="text-3xl font-bold">{{ analytics.analysisSuccessRate }}%</p>
                <p class="text-emerald-100 text-sm">Успешных анализов</p>
              </div>
              <div class="p-3 bg-emerald-400 bg-opacity-50 rounded-full">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  class="h-8 w-8"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
            </div>
          </div>

          <!-- Growth Rate -->
          <div class="bg-gradient-to-r from-purple-500 to-purple-600 rounded-lg shadow p-6 text-white">
            <div class="flex items-center justify-between">
              <div>
                <h3 class="text-purple-100 text-sm font-medium">Рост пользователей</h3>
                <p class="text-3xl font-bold">+{{ analytics.userGrowthRate }}%</p>
                <p class="text-purple-100 text-sm">За месяц</p>
              </div>
              <div class="p-3 bg-purple-400 bg-opacity-50 rounded-full">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  class="h-8 w-8"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 11l5-5m0 0l5 5m-5-5v12" />
                </svg>
              </div>
            </div>
          </div>

          <!-- System Health -->
          <div class="bg-gradient-to-r from-indigo-500 to-indigo-600 rounded-lg shadow p-6 text-white">
            <div class="flex items-center justify-between">
              <div>
                <h3 class="text-indigo-100 text-sm font-medium">Состояние системы</h3>
                <p class="text-2xl font-bold">{{ analytics.systemHealth }}</p>
                <p class="text-indigo-100 text-sm">{{ stats.pendingAnalyzes + stats.failedAnalyzes }} проблем</p>
              </div>
              <div class="p-3 bg-indigo-400 bg-opacity-50 rounded-full">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  class="h-8 w-8"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                  />
                </svg>
              </div>
            </div>
          </div>

          <!-- Offer Management -->
          <div class="bg-gradient-to-r from-orange-500 to-orange-600 rounded-lg shadow p-6 text-white">
            <div class="flex items-center justify-between">
              <div>
                <h3 class="text-orange-100 text-sm font-medium">Управление предложениями</h3>
                <p class="text-3xl font-bold">{{ analytics.offerApprovalRate }}%</p>
                <p class="text-orange-100 text-sm">Одобрения</p>
              </div>
              <div class="p-3 bg-orange-400 bg-opacity-50 rounded-full">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  class="h-8 w-8"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                  />
                </svg>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
