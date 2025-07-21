<script setup lang="ts">
import { ElMessage } from 'element-plus';
import { onMounted, ref, watch } from 'vue';
import { useUsersStore } from '../stores/users';

const props = defineProps<{
  visible: boolean;
  userId: string | null;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
}>();

// Инициализация хранилища
const usersStore = useUsersStore();

// Состояние формы
const isLoading = ref(false);
const formData = ref({
  email: '',
  analysisCredits: 0,
  language: 'RU' as 'EN' | 'RU',
  // Другие поля, которые можно редактировать
});

// Загрузка данных пользователя
const loadUserData = async () => {
  if (!props.userId) return;

  try {
    isLoading.value = true;
    const userData = await usersStore.getUserById(props.userId);
    if (userData) {
      formData.value = {
        email: userData.email || '',
        analysisCredits: userData.analysisCredits || 0,
        language: userData.language || 'RU',
      };
    }
  } catch (error) {
    ElMessage({
      type: 'error',
      message: 'Ошибка загрузки данных пользователя',
    });
  } finally {
    isLoading.value = false;
  }
};

// Обработка отправки формы
const handleSubmit = async () => {
  if (!props.userId) return;

  try {
    isLoading.value = true;
    await usersStore.updateUser(props.userId, {
      analysisCredits: formData.value.analysisCredits,
      language: formData.value.language,
    });

    ElMessage({
      type: 'success',
      message: 'Пользователь успешно обновлен',
    });

    emit('close');
  } catch (error) {
    ElMessage({
      type: 'error',
      message: 'Ошибка обновления пользователя',
    });
  } finally {
    isLoading.value = false;
  }
};

// Загрузка данных пользователя при открытии диалога
watch(() => props.visible, (newValue) => {
  if (newValue && props.userId) {
    loadUserData();
  }
});

// Загрузка данных при монтировании, если диалог открыт
onMounted(() => {
  if (props.visible && props.userId) {
    loadUserData();
  }
});

// Обработка закрытия диалога
const handleClose = () => {
  emit('close');
};
</script>

<template>
  <div v-if="visible" class="fixed inset-0 flex items-center justify-center z-50">
    <!-- Затемнение фона -->
    <div class="absolute inset-0 bg-black bg-opacity-50" @click="handleClose"></div>

    <!-- Модальное окно -->
    <div class="bg-white rounded-lg shadow-xl w-full max-w-md relative z-10 mx-4">
      <div class="p-6">
        <h2 class="text-xl font-semibold text-gray-900 mb-6">Редактирование пользователя</h2>

        <!-- Спиннер загрузки -->
        <div v-if="isLoading" class="flex justify-center items-center p-10">
          <svg class="animate-spin h-10 w-10 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none"
            viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z">
            </path>
          </svg>
        </div>

        <!-- Форма редактирования -->
        <form v-else @submit.prevent="handleSubmit">
          <!-- Email (только для просмотра) -->
          <div class="mb-4">
            <label class="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input type="email" v-model="formData.email" disabled
              class="w-full p-2 border border-gray-300 rounded-md bg-gray-100" />
            <p class="text-xs text-gray-500 mt-1">Email нельзя изменить</p>
          </div>

          <!-- Кредиты анализа -->
          <div class="mb-4">
            <label class="block text-sm font-medium text-gray-700 mb-1">Кредиты анализа</label>
            <input type="number" v-model="formData.analysisCredits" min="0"
              class="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>


          <!-- Язык -->
          <div class="mb-6">
            <label class="block text-sm font-medium text-gray-700 mb-1">Язык</label>
            <select v-model="formData.language"
              class="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="RU">Русский</option>
              <option value="EN">English</option>
            </select>
          </div>

          <!-- Кнопки действий -->
          <div class="flex justify-end">
            <button type="button" @click="handleClose"
              class="mr-3 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-500">
              Отмена
            </button>
            <button type="submit" :disabled="isLoading"
              class="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
              Сохранить
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>