import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { usersApi } from '../api';
import type { UserWithStats, UserFilterOptions, UserUpdateRequest } from '../types';

export const useUsersStore = defineStore('users', () => {
  // State
  const users = ref<UserWithStats[]>([]);
  const totalUsers = ref<number>(0);
  const totalPages = ref<number>(0);
  const isLoading = ref<boolean>(false);
  const error = ref<string | null>(null);
  const selectedUser = ref<UserWithStats | null>(null);
  const filterOptions = ref<UserFilterOptions>({
    page: 1,
    limit: 10,
    sortBy: 'createdAt',
    sortDirection: 'desc',
  });

  // Getters
  const getUsers = computed(() => users.value);
  const getTotalUsers = computed(() => totalUsers.value);
  const getIsLoading = computed(() => isLoading.value);
  const getError = computed(() => error.value);
  const getFilterOptions = computed(() => filterOptions.value);
  const getSelectedUser = computed(() => selectedUser.value);

  // Actions
  const fetchUsers = async () => {
    try {
      isLoading.value = true;
      error.value = null;

      const response = await usersApi.getUsers(filterOptions.value);

      users.value = response.users;
      totalUsers.value = response.total;
      totalPages.value = response.totalPages;

      return {
        users: users.value,
        totalUsers: totalUsers.value,
        totalPages: totalPages.value,
      };
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Error loading users';
      console.error('Error fetching users:', err);
      throw err;
    } finally {
      isLoading.value = false;
    }
  };

  // Get user by ID
  const getUserById = async (id: string): Promise<UserWithStats | null> => {
    try {
      isLoading.value = true;
      error.value = null;

      const response = await usersApi.getUserById(id);
      // Convert UserDetailsResponse to UserWithStats by adding missing counts
      const userWithStats: UserWithStats = {
        ...response,
        analyzesCount: response.analyses?.length || 0,
        referralsCount: response.referrals?.length || 0,
      };
      selectedUser.value = userWithStats;
      return selectedUser.value;
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Error loading user';
      console.error('Error fetching user:', err);
      return null;
    } finally {
      isLoading.value = false;
    }
  };

  // Update user
  const updateUser = async (id: string, userData: UserUpdateRequest) => {
    try {
      isLoading.value = true;
      error.value = null;

      const response = await usersApi.updateUser(id, userData);

      // Update user in local array
      const index = users.value.findIndex((user) => user.id === id);
      if (index !== -1) {
        users.value[index] = { ...users.value[index], ...response };
      }

      // Update selected user if it's the current selected user
      if (selectedUser.value && selectedUser.value.id === id) {
        selectedUser.value = { ...selectedUser.value, ...response };
      }

      return response;
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Error updating user';
      console.error('Error updating user:', err);
      throw err;
    } finally {
      isLoading.value = false;
    }
  };

  // Ban user
  const banUser = async (id: string, reason?: string) => {
    try {
      isLoading.value = true;
      error.value = null;

      const response = await usersApi.banUser(id, reason);

      // Update user in local array
      const index = users.value.findIndex((user) => user.id === id);
      if (index !== -1) {
        users.value[index] = {
          ...users.value[index],
          isBanned: true,
          banReason: reason || 'Banned by administrator',
          bannedAt: new Date().toISOString(),
        };
      }

      // Update selected user if it's the current selected user
      if (selectedUser.value && selectedUser.value.id === id) {
        selectedUser.value = {
          ...selectedUser.value,
          isBanned: true,
          banReason: reason || 'Banned by administrator',
          bannedAt: new Date().toISOString(),
        };
      }

      return response;
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Error banning user';
      console.error('Error banning user:', err);
      throw err;
    } finally {
      isLoading.value = false;
    }
  };

  // Unban user
  const unbanUser = async (id: string) => {
    try {
      isLoading.value = true;
      error.value = null;

      const response = await usersApi.unbanUser(id);

      // Update user in local array
      const index = users.value.findIndex((user) => user.id === id);
      if (index !== -1) {
        users.value[index] = {
          ...users.value[index],
          isBanned: false,
          banReason: undefined,
          bannedAt: undefined,
        };
      }

      // Update selected user if it's the current selected user
      if (selectedUser.value && selectedUser.value.id === id) {
        selectedUser.value = {
          ...selectedUser.value,
          isBanned: false,
          banReason: undefined,
          bannedAt: undefined,
        };
      }

      return response;
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Error unbanning user';
      console.error('Error unbanning user:', err);
      throw err;
    } finally {
      isLoading.value = false;
    }
  };

  // Add credits to user
  const addCredits = async (id: string, amount: number) => {
    try {
      isLoading.value = true;
      error.value = null;

      const response = await usersApi.addCredits(id, amount);

      // Update user in local array
      const index = users.value.findIndex((user) => user.id === id);
      if (index !== -1) {
        users.value[index] = { ...users.value[index], analysisCredits: response.analysisCredits };
      }

      // Update selected user if it's the current selected user
      if (selectedUser.value && selectedUser.value.id === id) {
        selectedUser.value = { ...selectedUser.value, analysisCredits: response.analysisCredits };
      }

      return response;
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Error adding credits';
      console.error('Error adding credits:', err);
      throw err;
    } finally {
      isLoading.value = false;
    }
  };

  // Clear user data (keep user but remove all analysis data, Luscher test results, etc.)
  const clearUserData = async (id: string) => {
    try {
      isLoading.value = true;
      error.value = null;

      const response = await usersApi.clearUserData(id);

      // User remains in the system, but we might want to refresh their data
      // to reflect the cleared state
      if (selectedUser.value && selectedUser.value.id === id) {
        // Refresh selected user data
        await getUserById(id);
      }

      return response;
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Ошибка очистки данных пользователя';
      console.error('Error clearing user data:', err);
      throw err;
    } finally {
      isLoading.value = false;
    }
  };

  // Delete user completely
  const deleteUser = async (id: string) => {
    try {
      isLoading.value = true;
      error.value = null;

      const response = await usersApi.deleteUser(id);

      // Remove user from local array
      const index = users.value.findIndex((user) => user.id === id);
      if (index !== -1) {
        users.value.splice(index, 1);
        totalUsers.value -= 1;
      }

      // Clear selected user if it's the deleted user
      if (selectedUser.value && selectedUser.value.id === id) {
        selectedUser.value = null;
      }

      return response;
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Ошибка удаления пользователя';
      console.error('Error deleting user:', err);
      throw err;
    } finally {
      isLoading.value = false;
    }
  };

  // Update filter options
  const updateFilterOptions = (options: Partial<UserFilterOptions>) => {
    filterOptions.value = { ...filterOptions.value, ...options };
  };

  return {
    // State
    users,
    totalUsers,
    totalPages,
    isLoading,
    error,
    filterOptions,
    selectedUser,

    // Getters
    getUsers,
    getTotalUsers,
    getIsLoading,
    getError,
    getFilterOptions,
    getSelectedUser,

    // Actions
    fetchUsers,
    getUserById,
    updateUser,
    banUser,
    unbanUser,
    addCredits,
    clearUserData,
    deleteUser,
    updateFilterOptions,
  };
});
