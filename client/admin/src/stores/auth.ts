import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { authApi } from '../api';
import type { AdminLoginRequest } from '../types';

export const useAuthStore = defineStore('auth', () => {
  // State
  const user = ref<{ role: string } | null>(null);
  const isLoading = ref<boolean>(false);
  const error = ref<string | null>(null);

  // Getters
  const isAuthenticated = computed(() => authApi.isAuthenticated());
  const isAdmin = computed(() => user.value?.role === 'ADMIN');
  const getUser = computed(() => user.value);
  const getToken = computed(() => authApi.getToken());
  const getIsLoading = computed(() => isLoading.value);
  const getError = computed(() => error.value);

  // Actions
  const login = async (credentials: AdminLoginRequest) => {
    try {
      isLoading.value = true;
      error.value = null;
      
      const response = await authApi.login(credentials);
      
      user.value = response.user || { role: 'ADMIN' };
      
      return response.user;
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Authentication error';
      console.error('Login error:', err);
      throw err;
    } finally {
      isLoading.value = false;
    }
  };
  
  const logout = () => {
    user.value = null;
    authApi.logout();
  };
  
  const checkAuth = async () => {
    if (!authApi.isAuthenticated()) return false;
    
    try {
      // Устанавливаем пользователя как админа - в нашем случае наличие валидного токена
      // уже означает, что это администратор, т.к. обычные пользователи не используют веб-интерфейс
      user.value = { role: 'ADMIN' };
      return true;
    } catch (err) {
      console.error('Auth check error:', err);
      logout();
      return false;
    }
  };

  return {
    // Состояние
    user,
    isLoading,
    error,
    
    // Геттеры
    isAuthenticated,
    isAdmin,
    getUser,
    getToken,
    getIsLoading,
    getError,
    
    // Экшены
    login,
    logout,
    checkAuth,
  };
}); 