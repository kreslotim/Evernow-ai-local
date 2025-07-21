import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { offersApi } from '../api';
import type { Offer, OfferFilterOptions, OfferListResponse, OfferStats, ApproveRejectOfferRequest } from '../types';

export const useOffersStore = defineStore('offers', () => {
  // State
  const offers = ref<Offer[]>([]);
  const totalOffers = ref(0);
  const loading = ref(false);
  const error = ref<string | null>(null);
  const currentOffer = ref<Offer | null>(null);
  const stats = ref<OfferStats | null>(null);

  // Filter state
  const filterOptions = ref<OfferFilterOptions>({
    page: 1,
    limit: 20,
    search: '',
    sortBy: 'createdAt',
    sortDirection: 'desc',
    status: 'PENDING', // Default to showing pending offers
  });

  // Computed
  const totalPages = computed(() => Math.ceil(totalOffers.value / filterOptions.value.limit));
  
  const isLoading = computed(() => loading.value);
  const hasError = computed(() => !!error.value);
  const isEmpty = computed(() => offers.value.length === 0);

  const pendingOffers = computed(() => offers.value.filter(offer => offer.status === 'PENDING'));
  const approvedOffers = computed(() => offers.value.filter(offer => offer.status === 'APPROVED'));
  const rejectedOffers = computed(() => offers.value.filter(offer => offer.status === 'REJECTED'));

  // Actions
  const fetchOffers = async (options?: Partial<OfferFilterOptions>) => {
    loading.value = true;
    error.value = null;

    try {
      // Merge options with current filter options
      if (options) {
        Object.assign(filterOptions.value, options);
      }

      const response: OfferListResponse = await offersApi.getOffers(filterOptions.value);
      offers.value = response.offers;
      totalOffers.value = response.total;
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Failed to fetch offers';
      console.error('Error fetching offers:', err);
    } finally {
      loading.value = false;
    }
  };

  const fetchOfferById = async (id: string) => {
    loading.value = true;
    error.value = null;

    try {
      const offer = await offersApi.getOfferById(id);
      currentOffer.value = offer;
      return offer;
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Failed to fetch offer';
      console.error('Error fetching offer:', err);
      throw err;
    } finally {
      loading.value = false;
    }
  };

  const approveOffer = async (id: string, adminResponse?: string) => {
    loading.value = true;
    error.value = null;

    try {
      const requestData: ApproveRejectOfferRequest = adminResponse ? { adminResponse } : {};
      const updatedOffer = await offersApi.approveOffer(id, requestData);
      
      // Update the offer in the list
      const index = offers.value.findIndex(offer => offer.id === id);
      if (index !== -1) {
        offers.value[index] = updatedOffer;
      }
      
      // Update current offer if it's the same
      if (currentOffer.value?.id === id) {
        currentOffer.value = updatedOffer;
      }

      return updatedOffer;
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Failed to approve offer';
      console.error('Error approving offer:', err);
      throw err;
    } finally {
      loading.value = false;
    }
  };

  const rejectOffer = async (id: string, adminResponse?: string) => {
    loading.value = true;
    error.value = null;

    try {
      const requestData: ApproveRejectOfferRequest = adminResponse ? { adminResponse } : {};
      const updatedOffer = await offersApi.rejectOffer(id, requestData);
      
      // Update the offer in the list
      const index = offers.value.findIndex(offer => offer.id === id);
      if (index !== -1) {
        offers.value[index] = updatedOffer;
      }
      
      // Update current offer if it's the same
      if (currentOffer.value?.id === id) {
        currentOffer.value = updatedOffer;
      }

      return updatedOffer;
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Failed to reject offer';
      console.error('Error rejecting offer:', err);
      throw err;
    } finally {
      loading.value = false;
    }
  };

  const deleteOffer = async (id: string) => {
    loading.value = true;
    error.value = null;

    try {
      await offersApi.deleteOffer(id);
      
      // Remove from the list
      offers.value = offers.value.filter(offer => offer.id !== id);
      totalOffers.value -= 1;
      
      // Clear current offer if it's the same
      if (currentOffer.value?.id === id) {
        currentOffer.value = null;
      }
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Failed to delete offer';
      console.error('Error deleting offer:', err);
      throw err;
    } finally {
      loading.value = false;
    }
  };

  const fetchOfferStats = async () => {
    try {
      const offerStats = await offersApi.getOfferStats();
      stats.value = offerStats;
      return offerStats;
    } catch (err: any) {
      console.error('Error fetching offer stats:', err);
      throw err;
    }
  };

  // Filter actions
  const updateFilters = (newFilters: Partial<OfferFilterOptions>) => {
    Object.assign(filterOptions.value, newFilters);
  };

  const resetFilters = () => {
    filterOptions.value = {
      page: 1,
      limit: 20,
      search: '',
      sortBy: 'createdAt',
      sortDirection: 'desc',
      status: 'PENDING',
    };
  };

  const setPage = (page: number) => {
    filterOptions.value.page = page;
  };

  const setPageSize = (limit: number) => {
    filterOptions.value.limit = limit;
    filterOptions.value.page = 1; // Reset to first page
  };

  const setSearch = (search: string) => {
    filterOptions.value.search = search;
    filterOptions.value.page = 1; // Reset to first page
  };

  const setStatusFilter = (status: string) => {
    filterOptions.value.status = status === 'all' ? undefined : status as any;
    filterOptions.value.page = 1; // Reset to first page
  };

  const clearError = () => {
    error.value = null;
  };

  return {
    // State
    offers,
    totalOffers,
    loading,
    error,
    currentOffer,
    stats,
    filterOptions,

    // Computed
    totalPages,
    isLoading,
    hasError,
    isEmpty,
    pendingOffers,
    approvedOffers,
    rejectedOffers,

    // Actions
    fetchOffers,
    fetchOfferById,
    approveOffer,
    rejectOffer,
    deleteOffer,
    fetchOfferStats,

    // Filter actions
    updateFilters,
    resetFilters,
    setPage,
    setPageSize,
    setSearch,
    setStatusFilter,
    clearError,
  };
}); 