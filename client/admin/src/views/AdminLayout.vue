<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';

const router = useRouter();
const isCollapse = ref(false);

// Функция для выхода из системы
const handleLogout = () => {
  localStorage.removeItem('admin_token');
  router.push('/login');
};
</script>

<template>
  <!-- Главный контейнер -->
  <div class="flex h-screen bg-gray-50">
    <!-- Боковое меню -->
    <div :class="['bg-gray-800 text-white transition-all duration-300', isCollapse ? 'w-20' : 'w-64']">
      <!-- Заголовок -->
      <div class="p-4 flex items-center justify-between">
        <h1 :class="['font-bold text-xl transition-opacity duration-300', isCollapse ? 'opacity-0' : 'opacity-100']">
          Evernow-AI
        </h1>
        <button
            v-if="!isCollapse"
            @click="isCollapse = !isCollapse"
            class="text-white p-1 rounded hover:bg-gray-700 transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="h-6 w-6">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 19l-7-7 7-7m8 14l-7-7 7-7"/>
          </svg>
        </button>
      </div>

      <!-- Элементы навигации -->
      <div class="mt-5">
        <router-link
            to="/"
            exact-active-class="bg-gray-700"
            class="flex items-center px-4 py-3 hover:bg-gray-700 transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6z"
            />
            <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6z"
            />
            <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2z"
            />
            <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
            />
          </svg>
          <span :class="['ml-3 transition-opacity duration-300', isCollapse ? 'opacity-0' : 'opacity-100']"
          >Дашборд</span
          >
        </router-link>

        <router-link
            to="/users"
            exact-active-class="bg-gray-700"
            class="flex items-center px-4 py-3 hover:bg-gray-700 transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
            />
          </svg>
          <span :class="['ml-3 transition-opacity duration-300', isCollapse ? 'opacity-0' : 'opacity-100']"
          >Пользователи</span
          >
        </router-link>

        <router-link
            to="/analyzes"
            exact-active-class="bg-gray-700"
            class="flex items-center px-4 py-3 hover:bg-gray-700 transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
            />
          </svg>
          <span :class="['ml-3 transition-opacity duration-300', isCollapse ? 'opacity-0' : 'opacity-100']"
          >Анализы</span
          >
        </router-link>

        <router-link
            to="/prompts"
            exact-active-class="bg-gray-700"
            class="flex items-center px-4 py-3 hover:bg-gray-700 transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
            />
          </svg>
          <span :class="['ml-3 transition-opacity duration-300', isCollapse ? 'opacity-0' : 'opacity-100']"
          >Промпты</span
          >
        </router-link>

        <router-link
            to="/bot-messages"
            exact-active-class="bg-gray-700"
            class="flex items-center px-4 py-3 hover:bg-gray-700 transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
            />
          </svg>
          <span :class="['ml-3 transition-opacity duration-300', isCollapse ? 'opacity-0' : 'opacity-100']"
          >Сообщения бота</span
          >
        </router-link>

        <router-link
          to="/photos"
          exact-active-class="bg-gray-700"
          class="flex items-center px-4 py-3 hover:bg-gray-700 transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
          <span :class="['ml-3 transition-opacity duration-300', isCollapse ? 'opacity-0' : 'opacity-100']"
            >Фотографии сообщений</span
          >
        </router-link>

        <router-link
          to="/offers"
          exact-active-class="bg-gray-700"
          class="flex items-center px-4 py-3 hover:bg-gray-700 transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
            />
          </svg>
          <span :class="['ml-3 transition-opacity duration-300', isCollapse ? 'opacity-0' : 'opacity-100']"
          >Предложения</span
          >
        </router-link>

        <router-link
            to="/funnel"
            exact-active-class="bg-gray-700"
            class="flex items-center px-4 py-3 hover:bg-gray-700 transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
            />
          </svg>
          <span :class="['ml-3 transition-opacity duration-300', isCollapse ? 'opacity-0' : 'opacity-100']"
          >Воронка</span
          >
        </router-link>

        <router-link
            to="/daily-funnel-stats"
            exact-active-class="bg-gray-700"
            class="flex items-center px-4 py-3 hover:bg-gray-700 transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
          <span :class="['ml-3 transition-opacity duration-300', isCollapse ? 'opacity-0' : 'opacity-100']"
          >Дневная статистика</span
          >
        </router-link>

        <router-link
            to="/philosophy"
            exact-active-class="bg-gray-700"
            class="flex items-center px-4 py-3 hover:bg-gray-700 transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="#ffffff" class="h-6 w-6" viewBox="0 0 96 96">

            <path
                d="M44 9.553c-1.925.812-4.86 3.056-6.523 4.988-2.862 3.327-3.196 3.453-6.299 2.371-7.117-2.481-16.58 2.241-20.581 10.27-4.402 8.833-2.61 17.282 4.996 23.559 4.854 4.006 5.66 4.812 9.666 9.666 5.493 6.656 13.034 8.936 20.741 6.269 2.85-.986 4.266-.939 7.623.253 5.57 1.978 11.336.245 16.708-5.021C72.524 59.759 74.906 58 75.624 58c2.279 0 8.621-6.331 10.511-10.491C91.4 35.919 83.178 22.041 70 20.273c-2.2-.295-4-.926-4-1.402 0-2.12-7.482-8.911-10.848-9.846-4.829-1.341-6.956-1.24-11.152.528m.838 7.973c-1.621.88-3.336 3.21-4.386 5.96-2.008 5.258-1.53 5.046-5.678 2.518-10.81-6.591-23.486 5.211-17.138 15.956 1.765 2.989 6.195 6.04 8.768 6.04A1.6 1.6 0 0 1 28 49.596c0 7.743 11.474 13.045 18.381 8.492 2.83-1.866 2.935-1.866 6 .002 5.341 3.258 11.783 1.708 14.573-3.505C67.715 53.163 68.98 52 69.765 52 74.454 52 80 45.498 80 40c0-7.684-6.192-12.605-14.615-11.615-5.226.614-5.385.56-5.385-1.829 0-8.107-8.042-12.897-15.162-9.03M26 74c-3.585 3.585-1.019 10 4 10 2.576 0 6-3.424 6-6 0-1.1-.9-2.9-2-4s-2.9-2-4-2-2.9.9-4 2m-12.96 7.452c-2.657 3.201 1.245 8.118 4.71 5.936C21.212 85.207 19.979 80 16 80c-.965 0-2.297.653-2.96 1.452"
                fill-rule="evenodd"/>

          </svg>
          <span :class="['ml-3 transition-opacity duration-300', isCollapse ? 'opacity-0' : 'opacity-100']"
          >Философия</span>
        </router-link>

        <!-- Кнопка выхода -->
        <div
            @click="handleLogout"
            class="flex items-center px-4 py-3 hover:bg-gray-700 cursor-pointer mt-8 transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
            />
          </svg>
          <span :class="['ml-3 transition-opacity duration-300', isCollapse ? 'opacity-0' : 'opacity-100']">Выход</span>
        </div>
      </div>
    </div>

    <!-- Floating expand button (shown when sidebar is collapsed) -->
    <div v-if="isCollapse" class="fixed top-6 left-6 z-50">
      <button
          @click="isCollapse = false"
          class="bg-gray-800 hover:bg-gray-700 text-white p-3 rounded-lg shadow-lg transition-all duration-200 hover:scale-105"
      >
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 5l7 7-7 7M5 5l7 7-7 7"/>
        </svg>
      </button>
    </div>

    <!-- Основной контент -->
    <div class="flex-1 flex flex-col overflow-hidden">
      <!-- Верхняя панель -->
      <header class="bg-white shadow">
        <div class="px-6 py-4">
          <h2 class="text-xl font-semibold text-gray-800">Админ-панель Evernow-AI</h2>
        </div>
      </header>

      <!-- Основной контент страницы -->
      <main class="flex-1 overflow-auto p-6">
        <router-view/>
      </main>
    </div>
  </div>
</template>
