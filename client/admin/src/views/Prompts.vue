<template>
  <div class="prompts-view">
    <!-- Форма ввода пароля для доступа к промптам -->
    <div v-if="!isPromptsAuthorized" class="password-protection">
      <div class="password-card">
        <div class="password-header">
          <h1 class="password-title">🔐 Доступ к промптам</h1>
          <p class="password-description">Для редактирования промптов требуется специальный пароль.</p>
        </div>

        <form @submit.prevent="verifyPassword" class="password-form">
          <div class="password-field">
            <label for="password" class="password-label">Пароль:</label>
            <input
              id="password"
              v-model="passwordInput"
              type="password"
              class="password-input"
              placeholder="Введите пароль для доступа к промптам"
              :disabled="verifyingPassword"
              required
            />
          </div>

          <div v-if="passwordError" class="password-error">
            {{ passwordError }}
          </div>

          <button type="submit" class="password-submit" :disabled="verifyingPassword || !passwordInput.trim()">
            <span v-if="verifyingPassword">Проверка...</span>
            <span v-else>Войти</span>
          </button>
        </form>
      </div>
    </div>

    <!-- Основной контент страницы промптов (показывается только после авторизации) -->
    <div v-else class="prompts-content">
      <!-- Заголовок страницы -->
      <div class="header-section">
        <h1 class="page-title">Управление промптами</h1>
        <p class="page-description">
          Редактирование промптов для OpenAI и DeepSeek. Промпты сохраняются в базе данных с приоритетом над значениями
          по умолчанию.
        </p>
        <div class="info-message">
          <span class="info-icon">ℹ️</span>
          <span>Промпты для создания гипотез скрыты из админки и управляются только через код.</span>
        </div>
      </div>

      <!-- Фильтры и поиск -->
      <div class="filters-section">
        <div class="filters-row">
          <div class="search-field">
            <input
              v-model="searchQuery"
              type="text"
              placeholder="Поиск по содержимому или описанию..."
              class="search-input"
              @input="debouncedSearch"
            />
          </div>
          <div class="provider-filter">
            <select v-model="selectedProvider" class="provider-select" @change="loadPrompts">
              <option value="">Все провайдеры</option>
              <option value="openai">OpenAI</option>
              <option value="deepseek">DeepSeek</option>
            </select>
          </div>
          <button @click="loadPrompts" class="refresh-btn" :disabled="loading">
            <span v-if="loading">Загрузка...</span>
            <span v-else>Обновить</span>
          </button>
        </div>
      </div>

      <!-- Сообщения об ошибках и успехе -->
      <div v-if="error" class="error-message">
        {{ error }}
      </div>
      <div v-if="successMessage" class="success-message">
        {{ successMessage }}
      </div>

      <!-- Список промптов -->
      <div v-if="loading" class="loading-state">Загрузка промптов...</div>

      <div v-else-if="prompts.length === 0" class="empty-state">Промпты не найдены</div>

      <div v-else class="prompts-list">
        <div v-for="prompt in prompts" :key="prompt.key" class="prompt-card">
          <div class="prompt-header">
            <div class="prompt-meta">
              <h3 class="prompt-key">{{ prompt.key }}</h3>
              <div class="prompt-badges">
                <span class="provider-badge" :class="`provider-${prompt.provider}`">
                  {{ prompt.provider.toUpperCase() }}
                </span>
                <span class="source-badge" :class="`source-${prompt.source}`">
                  {{ prompt.source === 'database' ? 'База данных' : 'По умолчанию' }}
                </span>
              </div>
            </div>
            <div class="prompt-actions">
              <button @click="editPrompt(prompt)" class="edit-btn">Редактировать</button>
            </div>
          </div>

          <div class="prompt-description" v-if="prompt.description">
            {{ prompt.description }}
          </div>

          <div class="prompt-preview">
            <div class="content-preview">
              {{ getPreviewText(prompt.content) }}
            </div>
            <div class="content-meta">
              <span class="content-length">{{ prompt.content.length }} символов</span>
              <span v-if="prompt.updatedAt" class="updated-date"> Обновлен: {{ formatDate(prompt.updatedAt) }} </span>
            </div>
          </div>
        </div>
      </div>

      <!-- Модальное окно редактирования -->
      <div v-if="editingPrompt" class="modal-overlay" @click="closeEditModal">
        <div class="modal-content" @click.stop>
          <div class="modal-header">
            <h2>Редактирование промпта</h2>
            <button @click="closeEditModal" class="close-btn">&times;</button>
          </div>

          <div class="modal-body">
            <div class="form-field">
              <label class="field-label">Ключ промпта:</label>
              <div class="field-value readonly">{{ editingPrompt.key }}</div>
            </div>

            <div class="form-field">
              <label class="field-label">Провайдер:</label>
              <div class="field-value readonly">{{ editingPrompt.provider.toUpperCase() }}</div>
            </div>

            <div class="form-field">
              <label for="description" class="field-label">Описание:</label>
              <input
                id="description"
                v-model="editForm.description"
                type="text"
                class="text-input"
                placeholder="Описание назначения промпта"
              />
            </div>

            <div class="form-field">
              <label for="content" class="field-label">Содержимое промпта:</label>
              <textarea
                id="content"
                v-model="editForm.content"
                class="content-textarea"
                rows="20"
                placeholder="Введите текст промпта..."
                required
              ></textarea>
              <div class="textarea-meta">
                <span class="char-count">{{ editForm.content.length }} символов</span>
                <span v-if="editForm.content.includes('${')"> Обнаружены переменные для подстановки </span>
              </div>
            </div>
          </div>

          <div class="modal-footer">
            <button @click="closeEditModal" class="cancel-btn" :disabled="saving">Отмена</button>
            <button @click="savePrompt" class="save-btn" :disabled="saving || !isFormValid">
              <span v-if="saving">Сохранение...</span>
              <span v-else>Сохранить</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { getPrompts, updatePrompt, promptsApi } from '../api';
import type { Prompt, GetPromptsParams, UpdatePromptRequest } from '../types';

// Реактивные данные
const loading = ref(false);
const saving = ref(false);
const error = ref('');
const successMessage = ref('');
const prompts = ref<Prompt[]>([]);
const searchQuery = ref('');
const selectedProvider = ref('');

// Редактирование промптов
const editingPrompt = ref<Prompt | null>(null);
const editForm = ref({
  content: '',
  description: '',
});

// Состояние авторизации
const isPromptsAuthorized = ref(false);
const passwordInput = ref('');
const verifyingPassword = ref(false);
const passwordError = ref('');

// Дебаунс для поиска
let searchTimeout: number | null = null;

// Вычисляемые свойства
const isFormValid = computed(() => {
  return editForm.value.content.trim().length >= 10;
});

// Методы
const loadPrompts = async () => {
  try {
    loading.value = true;
    error.value = '';

    const params: GetPromptsParams = {
      page: 1,
      limit: 50,
    };

    if (selectedProvider.value) {
      params.provider = selectedProvider.value;
    }

    if (searchQuery.value.trim()) {
      params.search = searchQuery.value.trim();
    }

    const response = await getPrompts(params);

    // Фильтруем промпты - исключаем промпты связанные с гипотезами
    // Промпты гипотез скрыты из админки по требованию бизнеса
    const filteredPrompts = response.prompts.filter(
      (prompt: Prompt) => !prompt.key.toLowerCase().includes('order_hypothesis'),
    );

    prompts.value = filteredPrompts;
  } catch (err: any) {
    error.value = err.message || 'Ошибка загрузки промптов';
    console.error('Error loading prompts:', err);
  } finally {
    loading.value = false;
  }
};

const debouncedSearch = () => {
  if (searchTimeout) {
    clearTimeout(searchTimeout);
  }
  searchTimeout = setTimeout(() => {
    loadPrompts();
  }, 500);
};

const editPrompt = (prompt: Prompt) => {
  editingPrompt.value = prompt;
  editForm.value = {
    content: prompt.content,
    description: prompt.description || '',
  };
};

const closeEditModal = () => {
  editingPrompt.value = null;
  editForm.value = {
    content: '',
    description: '',
  };
  error.value = '';
};

const savePrompt = async () => {
  if (!editingPrompt.value || !isFormValid.value) return;

  try {
    saving.value = true;
    error.value = '';

    const updateData: UpdatePromptRequest = {
      content: editForm.value.content.trim(),
    };

    if (editForm.value.description.trim()) {
      updateData.description = editForm.value.description.trim();
    }

    await updatePrompt(editingPrompt.value.key, updateData);

    successMessage.value = `Промпт ${editingPrompt.value.key} успешно обновлен`;
    closeEditModal();
    await loadPrompts();

    // Скрыть сообщение об успехе через 3 секунды
    setTimeout(() => {
      successMessage.value = '';
    }, 3000);
  } catch (err: any) {
    error.value = err.message || 'Ошибка сохранения промпта';
    console.error('Error saving prompt:', err);
  } finally {
    saving.value = false;
  }
};

const verifyPassword = async () => {
  if (!passwordInput.value.trim()) {
    passwordError.value = 'Пароль не может быть пустым.';
    return;
  }

  verifyingPassword.value = true;
  passwordError.value = '';

  try {
    // Проверяем пароль через API
    const result = await promptsApi.verifyPassword(passwordInput.value.trim());

    if (result.success) {
      isPromptsAuthorized.value = true;
      // Сохраняем состояние авторизации в localStorage
      localStorage.setItem('prompts_authorized', 'true');
      await loadPrompts(); // Загружаем промпты после успешной авторизации
    } else {
      passwordError.value = result.message || 'Неверный пароль';
    }
  } catch (err: any) {
    passwordError.value = err.response?.data?.message || err.message || 'Ошибка при проверке пароля';
    console.error('Error verifying password:', err);
  } finally {
    verifyingPassword.value = false;
  }
};

const getPreviewText = (content: string) => {
  const maxLength = 200;
  if (content.length <= maxLength) {
    return content;
  }
  return content.substring(0, maxLength) + '...';
};

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleString('ru-RU', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

// Инициализация
onMounted(() => {
  // Проверяем, авторизован ли пользователь ранее
  const isAuthorized = localStorage.getItem('prompts_authorized');
  if (isAuthorized === 'true') {
    isPromptsAuthorized.value = true;
    loadPrompts();
  }
  // Если не авторизован, показываем форму пароля
});
</script>

<style scoped>
.prompts-view {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
}

.password-protection {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh; /* Занимает всю высоту экрана */
  background-color: #f0f2f5; /* Легкий серый фон */
}

.password-card {
  background: white;
  border-radius: 10px;
  padding: 40px;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
  width: 100%;
  max-width: 450px;
  text-align: center;
}

.password-header {
  margin-bottom: 30px;
}

.password-title {
  font-size: 2.5rem;
  font-weight: bold;
  color: #1f2937;
  margin-bottom: 10px;
}

.password-description {
  color: #6b7280;
  font-size: 1.1rem;
  line-height: 1.6;
}

.password-form {
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.password-field {
  position: relative;
}

.password-label {
  display: block;
  margin-bottom: 8px;
  font-weight: 500;
  color: #374151;
}

.password-input {
  width: 100%;
  padding: 12px 16px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 16px;
  transition: border-color 0.2s;
}

.password-input:focus {
  outline: none;
  border-color: #3b82f6;
}

.password-error {
  color: #dc2626;
  font-size: 0.9rem;
  margin-top: 5px;
}

.password-submit {
  padding: 12px 20px;
  background-color: #3b82f6;
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 16px;
  font-weight: 600;
  transition: background-color 0.2s;
}

.password-submit:hover:not(:disabled) {
  background-color: #2563eb;
}

.password-submit:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.prompts-content {
  /* Стили для контента, который показывается после авторизации */
}

.header-section {
  margin-bottom: 30px;
}

.page-title {
  font-size: 2rem;
  font-weight: bold;
  color: #1f2937;
  margin-bottom: 8px;
}

.page-description {
  color: #6b7280;
  font-size: 1rem;
  line-height: 1.5;
}

.info-message {
  color: #6b7280;
  font-size: 1rem;
  line-height: 1.5;
  margin-top: 8px;
}

.info-icon {
  margin-right: 8px;
}

.filters-section {
  background: #f9fafb;
  padding: 20px;
  border-radius: 8px;
  margin-bottom: 20px;
}

.filters-row {
  display: flex;
  gap: 16px;
  align-items: center;
  flex-wrap: wrap;
}

.search-field {
  flex: 1;
  min-width: 300px;
}

.search-input {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 14px;
}

.provider-filter {
  min-width: 150px;
}

.provider-select {
  padding: 8px 12px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 14px;
}

.refresh-btn {
  padding: 8px 16px;
  background-color: #3b82f6;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
}

.refresh-btn:hover:not(:disabled) {
  background-color: #2563eb;
}

.refresh-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.error-message {
  background-color: #fef2f2;
  color: #dc2626;
  padding: 12px;
  border-radius: 6px;
  margin-bottom: 20px;
  border: 1px solid #fecaca;
}

.success-message {
  background-color: #f0fdf4;
  color: #166534;
  padding: 12px;
  border-radius: 6px;
  margin-bottom: 20px;
  border: 1px solid #bbf7d0;
}

.loading-state,
.empty-state {
  text-align: center;
  padding: 40px;
  color: #6b7280;
  font-size: 16px;
}

.prompts-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.prompt-card {
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 20px;
  transition: box-shadow 0.2s;
}

.prompt-card:hover {
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
}

.prompt-header {
  display: flex;
  justify-content: between;
  align-items: flex-start;
  margin-bottom: 12px;
}

.prompt-meta {
  flex: 1;
}

.prompt-key {
  font-size: 1.2rem;
  font-weight: 600;
  color: #1f2937;
  margin-bottom: 8px;
}

.prompt-badges {
  display: flex;
  gap: 8px;
}

.provider-badge,
.source-badge {
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
  text-transform: uppercase;
}

.provider-openai {
  background-color: #dbeafe;
  color: #1e40af;
}

.provider-deepseek {
  background-color: #f3e8ff;
  color: #7c3aed;
}

.source-database {
  background-color: #d1fae5;
  color: #065f46;
}

.source-default {
  background-color: #fef3c7;
  color: #92400e;
}

.prompt-actions {
  margin-left: 16px;
}

.edit-btn {
  padding: 6px 12px;
  background-color: #f59e0b;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
}

.edit-btn:hover {
  background-color: #d97706;
}

.prompt-description {
  color: #6b7280;
  font-size: 14px;
  margin-bottom: 12px;
  font-style: italic;
}

.prompt-preview {
  border-top: 1px solid #e5e7eb;
  padding-top: 12px;
}

.content-preview {
  background-color: #f9fafb;
  padding: 12px;
  border-radius: 4px;
  font-family: monospace;
  font-size: 13px;
  line-height: 1.4;
  color: #374151;
  margin-bottom: 8px;
  white-space: pre-wrap;
}

.content-meta {
  display: flex;
  justify-content: between;
  align-items: center;
  font-size: 12px;
  color: #9ca3af;
}

.content-length,
.updated-date {
  display: inline-block;
}

/* Модальное окно */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 20px;
}

.modal-content {
  background: white;
  border-radius: 8px;
  width: 100%;
  max-width: 800px;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
}

.modal-header {
  display: flex;
  justify-content: between;
  align-items: center;
  padding: 20px;
  border-bottom: 1px solid #e5e7eb;
}

.modal-header h2 {
  font-size: 1.5rem;
  font-weight: 600;
  color: #1f2937;
}

.close-btn {
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: #6b7280;
  padding: 4px;
}

.close-btn:hover {
  color: #1f2937;
}

.modal-body {
  padding: 20px;
  overflow-y: auto;
  flex: 1;
}

.form-field {
  margin-bottom: 20px;
}

.field-label {
  display: block;
  margin-bottom: 6px;
  font-weight: 500;
  color: #374151;
}

.field-value.readonly {
  background-color: #f9fafb;
  padding: 8px 12px;
  border-radius: 4px;
  border: 1px solid #e5e7eb;
  color: #6b7280;
}

.text-input {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 14px;
}

.content-textarea {
  width: 100%;
  padding: 12px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-family: monospace;
  font-size: 13px;
  line-height: 1.4;
  resize: vertical;
  min-height: 400px;
}

.textarea-meta {
  display: flex;
  justify-content: between;
  align-items: center;
  margin-top: 6px;
  font-size: 12px;
  color: #6b7280;
}

.char-count {
  font-weight: 500;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 20px;
  border-top: 1px solid #e5e7eb;
}

.cancel-btn,
.save-btn {
  padding: 8px 16px;
  border-radius: 6px;
  font-size: 14px;
  cursor: pointer;
  border: none;
}

.cancel-btn {
  background-color: #f3f4f6;
  color: #374151;
}

.cancel-btn:hover:not(:disabled) {
  background-color: #e5e7eb;
}

.save-btn {
  background-color: #10b981;
  color: white;
}

.save-btn:hover:not(:disabled) {
  background-color: #059669;
}

.save-btn:disabled,
.cancel-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* Адаптивность */
@media (max-width: 768px) {
  .prompts-view {
    padding: 16px;
  }

  .password-card {
    padding: 20px;
  }

  .password-title {
    font-size: 2rem;
  }

  .password-description {
    font-size: 1rem;
  }

  .filters-row {
    flex-direction: column;
    align-items: stretch;
  }

  .search-field {
    min-width: auto;
  }

  .prompt-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }

  .prompt-actions {
    margin-left: 0;
  }

  .modal-content {
    margin: 10px;
  }

  .content-meta {
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
  }
}
</style>
