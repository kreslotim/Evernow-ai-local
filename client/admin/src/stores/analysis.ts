import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { analysisApi } from '../api';
import type { Analysis, AnalysisFilterOptions} from '../types';

export const useAnalysisStore = defineStore('analysis', () => {
  // State
  const analyses = ref<Analysis[]>([]);
  const totalAnalyses = ref<number>(0);
  const totalPages = ref<number>(0);
  const isLoading = ref<boolean>(false);
  const error = ref<string | null>(null);
  const filterOptions = ref<AnalysisFilterOptions>({
    page: 1,
    limit: 10,
    sortBy: 'createdAt',
    sortDirection: 'desc',
  });

  // Getters
  const getAnalyses = computed(() => analyses.value);
  const getTotalAnalyses = computed(() => totalAnalyses.value);
  const getIsLoading = computed(() => isLoading.value);
  const getError = computed(() => error.value);
  const getFilterOptions = computed(() => filterOptions.value);

  // Actions
  const fetchAnalyses = async () => {
    try {
      isLoading.value = true;
      error.value = null;
      
      const response = await analysisApi.getAnalyses(filterOptions.value);
      
      analyses.value = response.analyses;
      totalAnalyses.value = response.total;
      totalPages.value = response.totalPages;
      
      return {
        analyses: analyses.value,
        totalAnalyses: totalAnalyses.value,
        totalPages: totalPages.value
      };
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Error loading analyses';
      console.error('Error fetching analyses:', err);
      throw err;
    } finally {
      isLoading.value = false;
    }
  };
  
  // Get analysis by ID
  const getAnalysisById = async (id: string): Promise<Analysis | null> => {
    try {
      isLoading.value = true;
      error.value = null;
      
      const response = await analysisApi.getAnalysisById(id);
      return response;
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Error loading analysis';
      console.error('Error fetching analysis:', err);
      return null;
    } finally {
      isLoading.value = false;
    }
  };
  
  // Update filter options
  const updateFilterOptions = (options: Partial<AnalysisFilterOptions>) => {
    filterOptions.value = { ...filterOptions.value, ...options };
  };

  return {
    // State
    analyses,
    totalAnalyses,
    totalPages,
    isLoading,
    error,
    filterOptions,
    
    // Getters
    getAnalyses,
    getTotalAnalyses,
    getIsLoading,
    getError,
    getFilterOptions,
    
    // Actions
    fetchAnalyses,
    getAnalysisById,
    updateFilterOptions,
  };
}); 