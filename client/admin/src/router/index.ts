import type { RouteRecordRaw } from 'vue-router';
import { createRouter, createWebHistory } from 'vue-router';

// Определение маршрутов
const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'panel',
    component: () => import('../views/AdminLayout.vue'),
    children: [
      {
        path: '',
        name: 'dashboard',
        component: () => import('../views/Dashboard.vue'),
      },
      {
        path: 'users',
        name: 'users',
        component: () => import('../views/Users.vue'),
      },
      {
        path: 'users/:id',
        name: 'user-details',
        component: () => import('../views/UserDetails.vue'),
        props: true,
      },
      {
        path: 'users/:id/edit',
        name: 'user-edit',
        component: () => import('../views/UserEdit.vue'),
        props: true,
      },
      {
        path: 'analyzes',
        name: 'analyzes',
        component: () => import('../views/Analyzes.vue'),
      },
      {
        path: 'prompts',
        name: 'prompts',
        component: () => import('../views/Prompts.vue'),
      },
      {
        path: 'bot-messages',
        name: 'bot-messages',
        component: () => import('../views/BotMessages.vue'),
        meta: {
          title: 'Сообщения бота',
        },
      },
      {
        path: 'photos',
        name: 'photos',
        component: () => import('../views/WelcomePhotos.vue'),
        meta: {
          title: 'Фотографии сообщения',
          description: 'Управление фотографиями в сообщениях',
        },
      },
      {
        path: 'offers',
        name: 'offers',
        component: () => import('../views/Offers.vue'),
      },
      // {
      //   path: 'analyze-statistics',
      //   name: 'analyze-statistics',
      //   component: () => import('../views/AnalyzeStatistics.vue'),
      // },
      {
        path: 'funnel',
        name: 'funnel',
        component: () => import('../views/Funnel.vue'),
      },
      {
        path: 'daily-funnel-stats',
        name: 'daily-funnel-stats',
        component: () => import('../views/DailyFunnelStats.vue'),
        meta: {
          title: 'Дневная статистика воронки',
          description: 'Детальная статистика пользователей по состояниям воронки с группировкой по дням',
        },
      },
      {
        path: 'philosophy',
        name: 'philosophy',
        component: () => import('../views/Philosophy.vue'),
        meta: {
          title: 'Философия',
          description: 'Таблица философий',
        },
      },
    ],
  },
  {
    path: '/login',
    name: 'login',
    component: () => import('../views/Login.vue'),
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'not-found',
    component: () => import('../views/NotFound.vue'),
  },
];

// Создание экземпляра роутера с исправленной конфигурацией
const router = createRouter({
  // Используем базовый путь, заданный в Vite ("/panel/")
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
});

// Глобальный обработчик ошибок роутера
router.onError((error, to) => {
  console.error('Router error:', error);
  console.error('Target route:', to);

  // При ошибках роутинга перенаправляем на главную панель
  router.push('/').catch((err) => {
    console.error('Failed to redirect to panel:', err);
  });
});

// Защита маршрутов (проверка авторизации)
router.beforeEach((to, _from, next) => {
  try {
    // Получаем токен из localStorage
    const isAuthenticated = !!localStorage.getItem('admin_token');

    // Если маршрут требует авторизации, а пользователь не авторизован, перенаправляем на страницу входа
    if (to.name !== 'login' && !isAuthenticated) {
      next({ name: 'login' });
    } else {
      next();
    }
  } catch (error) {
    console.error('Router beforeEach error:', error);
    // При ошибке авторизации перенаправляем на логин
    next({ name: 'login' });
  }
});

// Обработка ошибок навигации
router.afterEach((to, from, failure) => {
  if (failure) {
    console.error('Navigation failed:', failure);
    console.error('From:', from.fullPath, 'To:', to.fullPath);

    // При критических ошибках навигации перенаправляем на панель
    if (
      failure.type === 4 /* NavigationFailureType.aborted */ ||
      failure.type === 8 /* NavigationFailureType.duplicated */
    ) {
      // Не перенаправляем при обычных ошибках навигации
      return;
    }

    // При серьезных ошибках перенаправляем на главную
    router.push('/').catch((err) => {
      console.error('Failed to redirect after navigation failure:', err);
    });
  }
});

export default router;
