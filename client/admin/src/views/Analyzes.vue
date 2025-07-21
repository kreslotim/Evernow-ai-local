<template>
  <div>
    <h1 class="text-2xl font-semibold text-gray-900 mb-6">Анализы</h1>

    <!-- Filters and search -->
    <div class="bg-white p-4 rounded-lg shadow mb-6">
      <div class="flex flex-col md:flex-row gap-4 mb-4">
        <div class="flex-1">
          <div class="relative">
            <input
              v-model="searchQuery"
              @input="handleSearchInput"
              type="text"
              placeholder="Search by analysis text or user..."
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
        <div>
          <select
            v-model="statusFilter"
            class="p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Statuses</option>
            <option value="COMPLETED">Completed</option>
            <option value="PENDING">Pending</option>
            <option value="PROCESSING">Processing</option>
            <option value="FAILED">Failed</option>
          </select>
        </div>
        <div>
          <select
            v-model="typeFilter"
            class="p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Types</option>
            <option value="FAST_ANALYZE">Fast Analyze</option>
            <option value="PROFORIENTATION_ANALYZE">Proforientation</option>
            <option value="COMPATIBILITY_ANALYZE">Compatibility</option>
            <option value="KINETIC_ANALYZE">Kinetic</option>
            <option value="INCOME_GROWTH_ANALYZE">Income Growth</option>
            <option value="LOCATION_ANALYZE">Location</option>
            <option value="COUPLE_FAMILY_GROWTH_ANALYZE">Couple/Family Growth</option>
            <option value="BUSINESS_COMMUNICATION_ANALYZE">Business Communication</option>
            <option value="FUTURE_ANALYZE">Future</option>
            <option value="HEALTH_ANALYZE">Health</option>
            <option value="CHILD_ANALYZE">Child</option>
            <option value="STRANGER_ANALYZE">Stranger</option>
            <option value="SPIRITUALITY_ANALYZE">Spirituality</option>
            <option value="COUPLE_COMPATIBILITY_ANALYZE">Couple Compatibility</option>
            <option value="BUSINESS_COMPATIBILITY_ANALYZE">Business Compatibility</option>
          </select>
        </div>
      </div>
    </div>

    <!-- Analyses Table -->
    <div class="bg-white rounded-lg shadow overflow-hidden">
      <!-- Loading spinner -->
      <div v-if="loading" class="flex justify-center items-center p-10">
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

      <!-- Error message -->
      <div v-else-if="error" class="p-6 text-center">
        <div class="text-red-500 mb-4">{{ error }}</div>
        <button @click="fetchAnalyses" class="btn">Retry</button>
      </div>

      <!-- Empty result -->
      <div v-else-if="analyses.length === 0" class="p-10 text-center text-gray-500">No analyses found</div>

      <!-- Table with data -->
      <div v-else>
        <div class="overflow-x-auto">
          <table class="min-w-full divide-y divide-gray-200">
            <thead class="bg-gray-50">
              <tr>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Summary</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cost</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Created At
                </th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody class="bg-white divide-y divide-gray-200">
              <tr v-for="analysis in analyses" :key="analysis.id">
                <td class="px-6 py-4 whitespace-nowrap">
                  <router-link :to="`/users/${analysis.userId}`" class="text-blue-600 hover:text-blue-900">
                    @{{ analysis.user.telegramUsername || analysis.user.telegramId }}
                  </router-link>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <div class="text-sm text-gray-900">{{ formatAnalysisType(analysis.type) }}</div>
                </td>
                <td class="px-6 py-4 max-w-xs">
                  <div class="text-sm text-gray-900 truncate">
                    {{ analysis.summaryText || analysis.analysisResultText || 'No summary' }}
                  </div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <span
                    :class="[
                      'px-2 inline-flex text-xs leading-5 font-semibold rounded-full',
                      analysis.status === 'COMPLETED'
                        ? 'bg-green-100 text-green-800'
                        : analysis.status === 'PENDING'
                          ? 'bg-blue-100 text-blue-800'
                          : analysis.status === 'PROCESSING'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-red-100 text-red-800',
                    ]"
                  >
                    {{ analysis.status }}
                  </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <div class="text-sm text-gray-900">{{ analysis.cost }}</div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <div class="text-sm text-gray-900">{{ formatDate(analysis.createdAt) }}</div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  <button @click="viewAnalysis(analysis)" class="text-indigo-600 hover:text-indigo-900">
                    View Details
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
              @click="handlePageChange(filterOptions.page - 1)"
              :disabled="filterOptions.page <= 1"
              :class="[
                'relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md',
                filterOptions.page <= 1
                  ? 'bg-white text-gray-300 cursor-not-allowed'
                  : 'bg-white text-gray-700 hover:bg-gray-50',
              ]"
            >
              Previous
            </button>
            <button
              @click="handlePageChange(filterOptions.page + 1)"
              :disabled="filterOptions.page * filterOptions.limit >= totalAnalyses"
              :class="[
                'ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md',
                filterOptions.page * filterOptions.limit >= totalAnalyses
                  ? 'bg-white text-gray-300 cursor-not-allowed'
                  : 'bg-white text-gray-700 hover:bg-gray-50',
              ]"
            >
              Next
            </button>
          </div>
          <div class="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
            <div>
              <p class="text-sm text-gray-700">
                Showing
                <span class="font-medium">{{ (filterOptions.page - 1) * filterOptions.limit + 1 }}</span>
                to
                <span class="font-medium">
                  {{ Math.min(filterOptions.page * filterOptions.limit, totalAnalyses) }}
                </span>
                of
                <span class="font-medium">{{ totalAnalyses }}</span>
                results
              </p>
            </div>
            <div>
              <div class="flex items-center">
                <select
                  v-model="filterOptions.limit"
                  @change="handleSizeChange(Number(($event.target as HTMLSelectElement).value))"
                  class="mr-4 p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="10">10 per page</option>
                  <option value="20">20 per page</option>
                  <option value="50">50 per page</option>
                  <option value="100">100 per page</option>
                </select>

                <nav class="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                  <button
                    @click="handlePageChange(filterOptions.page - 1)"
                    :disabled="filterOptions.page <= 1"
                    :class="[
                      'relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium',
                      filterOptions.page <= 1 ? 'text-gray-300 cursor-not-allowed' : 'text-gray-500 hover:bg-gray-50',
                    ]"
                  >
                    <span class="sr-only">Previous</span>
                    <svg
                      class="h-5 w-5"
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                      aria-hidden="true"
                    >
                      <path
                        fill-rule="evenodd"
                        d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z"
                        clip-rule="evenodd"
                      />
                    </svg>
                  </button>

                  <!-- Page buttons -->
                  <template v-for="pageNum in Math.ceil(totalAnalyses / filterOptions.limit)">
                    <button
                      v-if="
                        pageNum <= 3 ||
                        pageNum > Math.ceil(totalAnalyses / filterOptions.limit) - 3 ||
                        Math.abs(pageNum - filterOptions.page) <= 1
                      "
                      :key="pageNum"
                      @click="handlePageChange(pageNum)"
                      :class="[
                        'relative inline-flex items-center px-4 py-2 border text-sm font-medium',
                        pageNum === filterOptions.page
                          ? 'z-10 bg-blue-50 border-blue-500 text-blue-600'
                          : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50',
                      ]"
                    >
                      {{ pageNum }}
                    </button>
                    <span
                      v-else-if="pageNum === 4 && filterOptions.page > 6"
                      :key="`ellipsis-${pageNum}`"
                      class="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-700"
                    >
                      ...
                    </span>
                  </template>

                  <button
                    @click="handlePageChange(filterOptions.page + 1)"
                    :disabled="filterOptions.page * filterOptions.limit >= totalAnalyses"
                    :class="[
                      'relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium',
                      filterOptions.page * filterOptions.limit >= totalAnalyses
                        ? 'text-gray-300 cursor-not-allowed'
                        : 'text-gray-500 hover:bg-gray-50',
                    ]"
                  >
                    <span class="sr-only">Next</span>
                    <svg
                      class="h-5 w-5"
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                      aria-hidden="true"
                    >
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
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch, onBeforeUnmount } from 'vue';
import { analysisApi } from '../api';
import type { Analysis, AnalysisFilterOptions, ProcessingStatus, AnalyzeType } from '../types';
import { useRouter } from 'vue-router';

// Router for navigation
const router = useRouter();

// Component state
const analyses = ref<Analysis[]>([]);
const totalAnalyses = ref(0);
const loading = ref(false);
const error = ref<string | null>(null);

// Filter state
const searchQuery = ref('');
const searchTimeout = ref<number | null>(null);
const statusFilter = ref('all');
const typeFilter = ref('all');

// Filter options
const filterOptions = ref<AnalysisFilterOptions>({
  page: 1,
  limit: 20,
  search: '',
  sortBy: 'createdAt',
  sortDirection: 'desc',
});

// Fetch analyses
const fetchAnalyses = async () => {
  loading.value = true;
  error.value = null;

  try {
    // Update filter options
    filterOptions.value.search = searchQuery.value;
    filterOptions.value.status = statusFilter.value !== 'all' ? (statusFilter.value as ProcessingStatus) : undefined;
    filterOptions.value.type = typeFilter.value !== 'all' ? (typeFilter.value as AnalyzeType) : undefined;

    const response = await analysisApi.getAnalyses(filterOptions.value);
    analyses.value = response.analyses;
    totalAnalyses.value = response.total;
  } catch (err: any) {
    error.value = err.response?.data?.message || 'Failed to fetch analyses';
  } finally {
    loading.value = false;
  }
};

// Handle search input
const handleSearchInput = () => {
  if (searchTimeout.value) {
    clearTimeout(searchTimeout.value);
  }

  searchTimeout.value = setTimeout(() => {
    filterOptions.value.page = 1;
    fetchAnalyses();
  }, 500) as unknown as number;
};

// Handle status filter change
watch(statusFilter, () => {
  filterOptions.value.page = 1;
  fetchAnalyses();
});

// Handle type filter change
watch(typeFilter, () => {
  filterOptions.value.page = 1;
  fetchAnalyses();
});

// Handle page change
const handlePageChange = (page: number) => {
  filterOptions.value.page = page;
  fetchAnalyses();
};

// Handle size change
const handleSizeChange = (size: number) => {
  filterOptions.value.limit = size;
  filterOptions.value.page = 1;
  fetchAnalyses();
};

// Format date
const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

// Format analysis type
const formatAnalysisType = (type: string) => {
  const typeMap: Record<string, string> = {
    FAST_ANALYZE: 'Fast Analyze',
    PROFORIENTATION_ANALYZE: 'Proforientation',
    COMPATIBILITY_ANALYZE: 'Compatibility',
    KINETIC_ANALYZE: 'Kinetic',
    INCOME_GROWTH_ANALYZE: 'Income Growth',
    LOCATION_ANALYZE: 'Location',
    COUPLE_FAMILY_GROWTH_ANALYZE: 'Couple/Family Growth',
    BUSINESS_COMMUNICATION_ANALYZE: 'Business Communication',
    FUTURE_ANALYZE: 'Future',
    HEALTH_ANALYZE: 'Health',
    CHILD_ANALYZE: 'Child',
    STRANGER_ANALYZE: 'Stranger',
    SPIRITUALITY_ANALYZE: 'Spirituality',
    COUPLE_COMPATIBILITY_ANALYZE: 'Couple Compatibility',
    BUSINESS_COMPATIBILITY_ANALYZE: 'Business Compatibility',
  };
  return typeMap[type] || type;
};

// View analysis details
const viewAnalysis = (analysis: Analysis) => {
  // Перенаправляем к профилю пользователя где отображаются все его анализы
  router.push(`/users/${analysis.userId}`);
};

// Initialize component
onMounted(() => {
  fetchAnalyses();
});

// Cleanup on unmount
onBeforeUnmount(() => {
  if (searchTimeout.value) {
    clearTimeout(searchTimeout.value);
  }
});
</script>

<style scoped>
.btn {
  @apply bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded;
}
</style>
