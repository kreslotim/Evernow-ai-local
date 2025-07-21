<template>
  <div class="bot-messages-view">
    <!-- Заголовок страницы -->
    <div class="header-section">
      <h1 class="page-title">Управление сообщениями бота</h1>
      <p class="page-description">
        Управление реальными сообщениями бота, которые отправляются пользователям в handlers (start, onboarding,
        analyze). Поддерживается HTML разметка, изменения применяются мгновенно.
      </p>
    </div>

    <!-- Фильтры и поиск -->
    <div class="filters-section">
      <div class="filters-row">
        <div class="search-field">
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Поиск по ключу..."
            class="search-input"
            @input="debouncedSearch"
          />
        </div>
        <div class="locale-filter">
          <select v-model="selectedLocale" class="locale-select" @change="loadMessages">
            <option value="">Все языки</option>
            <option value="ru">Русский</option>
            <option value="en">English</option>
          </select>
        </div>
        <button @click="openCreateModal" class="create-btn">Создать</button>
        <button @click="loadMessages" class="refresh-btn" :disabled="loading">
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

    <!-- Список сообщений -->
    <div v-if="loading" class="loading-state">
      <div class="loading-spinner"></div>
      <span>Загрузка сообщений...</span>
    </div>
    <div v-else-if="messages.length === 0" class="empty-state">
      <div class="empty-icon">💬</div>
      <h3>Сообщения бота не найдены</h3>
      <p>
        Здесь должны отображаться реальные сообщения из handlers.
        <br />Попробуйте сбросить фильтры или проверьте API подключение.
      </p>
    </div>
    <div v-else class="messages-list">
      <div v-for="message in messages" :key="`${message.key}-${message.locale}`" class="message-card">
        <div class="message-header">
          <div class="message-meta">
            <h3 class="message-key">{{ message.key }}</h3>
            <div class="message-badges">
              <span class="locale-badge" :class="`locale-${message.locale}`">
                {{ message.locale.toUpperCase() }}
              </span>
              <span class="source-badge" :class="`source-${message.source}`">
                {{ message.source === 'database' ? 'База данных' : 'По умолчанию' }}
              </span>
            </div>
          </div>
          <div class="message-actions">
            <button @click="editMessage(message)" class="edit-btn">Редактировать</button>
            <button v-if="message.source === 'database'" @click="deleteMessage(message)" class="delete-btn">
              Сбросить
            </button>
          </div>
        </div>
        <div class="message-description" v-if="message.description">
          {{ message.description }}
        </div>
        <div class="message-preview">
          <div class="content-preview">
            <a v-if="getPreviewText(message.content).startsWith('http')" :href="message.content">Видео</a>
            <div v-else v-html="getPreviewText(message.content)"></div>
          </div>
          <div class="content-meta">
            <span class="content-length">{{ message.content.length }} символов</span>
            <span v-if="message.updatedAt" class="updated-date"> Обновлен: {{ formatDate(message.updatedAt) }} </span>
          </div>
        </div>
      </div>
    </div>

    <!-- Модал создания сообщения -->
    <div v-if="showCreateModal" class="modal-overlay" @click="closeCreateModal">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h2>Создать новое сообщение</h2>
          <button @click="closeCreateModal" class="modal-close">&times;</button>
        </div>

        <div class="modal-body">
          <div class="form-field">
            <label>Ключ сообщения *</label>
            <select v-model="createForm.key" class="form-select">
              <option value="">Выберите ключ...</option>
              <optgroup label="Приветствие и старт">
                <option value="greeting.auto_registered">greeting.auto_registered</option>
                <option value="greeting.referral_bonus">greeting.referral_bonus</option>
              </optgroup>
              <optgroup label="Онбординг">
                <option value="onboarding.processingFeelings">onboarding.processingFeelings</option>
                <option value="onboarding.waitingPhotoAnalysis">onboarding.waitingPhotoAnalysis</option>
                <option value="onboarding.feelsMessageDeclined">onboarding.feelsMessageDeclined</option>
                <option value="onboarding.triggerMessage">onboarding.triggerMessage</option>
                <option value="onboarding.miniAppButton">onboarding.miniAppButton</option>
                <option value="onboarding.miniAppMessage">onboarding.miniAppMessage</option>
                <option value="onboarding.final">onboarding.final</option>
                <option value="onboarding.shareWithFriendsButton">onboarding.shareWithFriendsButton</option>
                <option value="onboarding.makeRepostButton">onboarding.makeRepostButton</option>
                <option value="onboarding.purchaseParticipationButton">onboarding.purchaseParticipationButton</option>
                <option value="onboarding.shareMessage">onboarding.shareMessage</option>
                <option value="onboarding.readyToStartSurvey">onboarding.readyToStartSurvey</option>
                <option value="onboarding.readyToStartButton">onboarding.readyToStartButton</option>
                <option value="onboarding.backButton">onboarding.backButton</option>
                <option value="onboarding.repostMessage">onboarding.repostMessage</option>
                <option value="onboarding.repostCheckButton">onboarding.repostCheckButton</option>
                <option value="onboarding.repostSuccessMessage">onboarding.repostSuccessMessage</option>
                <option value="onboarding.repostAlreadyActivated">onboarding.repostAlreadyActivated</option>
                <option value="onboarding.photoRequest">onboarding.photoRequest</option>
                <option value="onboarding.completed">onboarding.completed</option>
                <option value="onboarding.purchaseMessage">onboarding.purchaseMessage</option>
                <option value="onboarding.custom_answer_request">onboarding.custom_answer_request</option>
                <option value="onboarding.processing_voice_message">onboarding.processing_voice_message</option>
                <option value="onboarding.voice_question">onboarding.voice_question</option>
                <option value="onboarding.voice_processing_error_retry">onboarding.voice_processing_error_retry</option>
                <option value="onboarding.survey_results_header">onboarding.survey_results_header</option>
                <option value="onboarding.voice_message_footer">onboarding.voice_message_footer</option>
                <option value="onboarding.answer_fallback">onboarding.answer_fallback</option>
                <option value="onboarding.custom_answer_option">onboarding.custom_answer_option</option>
              </optgroup>
              <optgroup label="Психологический опрос">
                <option value="onboarding.survey.q1.text">onboarding.survey.q1.text</option>
                <option value="onboarding.survey.q1.question_title">onboarding.survey.q1.question_title</option>
                <option value="onboarding.survey.q2.text">onboarding.survey.q2.text</option>
                <option value="onboarding.survey.q2.question_title">onboarding.survey.q2.question_title</option>
                <option value="onboarding.survey.q3.text">onboarding.survey.q3.text</option>
                <option value="onboarding.survey.q3.question_title">onboarding.survey.q3.question_title</option>
                <option value="onboarding.survey.q4.text">onboarding.survey.q4.text</option>
                <option value="onboarding.survey.q4.question_title">onboarding.survey.q4.question_title</option>
                <option value="onboarding.survey.results_header">onboarding.survey.results_header</option>
                <option value="onboarding.survey.voice_message_prefix">onboarding.survey.voice_message_prefix</option>
                <!-- Варианты ответов (кнопки) для вопросов 1-4 -->
                <option value="onboarding.survey.q1.options.0">onboarding.survey.q1.options.0</option>
                <option value="onboarding.survey.q1.options.1">onboarding.survey.q1.options.1</option>
                <option value="onboarding.survey.q1.options.2">onboarding.survey.q1.options.2</option>
                <option value="onboarding.survey.q1.options.3">onboarding.survey.q1.options.3</option>
                <option value="onboarding.survey.q2.options.0">onboarding.survey.q2.options.0</option>
                <option value="onboarding.survey.q2.options.1">onboarding.survey.q2.options.1</option>
                <option value="onboarding.survey.q2.options.2">onboarding.survey.q2.options.2</option>
                <option value="onboarding.survey.q2.options.3">onboarding.survey.q2.options.3</option>
                <option value="onboarding.survey.q2.options.4">onboarding.survey.q2.options.4</option>
                <option value="onboarding.survey.q3.options.0">onboarding.survey.q3.options.0</option>
                <option value="onboarding.survey.q3.options.1">onboarding.survey.q3.options.1</option>
                <option value="onboarding.survey.q3.options.2">onboarding.survey.q3.options.2</option>
                <option value="onboarding.survey.q3.options.3">onboarding.survey.q3.options.3</option>
                <option value="onboarding.survey.q3.options.4">onboarding.survey.q3.options.4</option>
                <option value="onboarding.survey.q4.options.0">onboarding.survey.q4.options.0</option>
                <option value="onboarding.survey.q4.options.1">onboarding.survey.q4.options.1</option>
                <option value="onboarding.survey.q4.options.2">onboarding.survey.q4.options.2</option>
                <option value="onboarding.survey.q4.options.3">onboarding.survey.q4.options.3</option>
                <option value="onboarding.survey.q4.options.4">onboarding.survey.q4.options.4</option>
                <option value="onboarding.voice_question">onboarding.voice_question</option>
                <option value="onboarding.backToQuestionButton">onboarding.backToQuestionButton</option>
                <option value="onboarding.mainConclusion">onboarding.mainConclusion</option>
                <option value="onboarding.readyButton">onboarding.readyButton</option>
                <option value="onboarding.finalChoices">onboarding.finalChoices</option>
              </optgroup>
              <optgroup label="Middleware сообщения">
                <option value="onboarding.middleware.use_survey_buttons">
                  onboarding.middleware.use_survey_buttons
                </option>
                <option value="onboarding.middleware.voice_message_required">
                  onboarding.middleware.voice_message_required
                </option>
                <option value="onboarding.middleware.text_answer_required">
                  onboarding.middleware.text_answer_required
                </option>
              </optgroup>
              <optgroup label="Анализ">
                <option value="scenes.analysis.send_face_photo">scenes.analysis.send_face_photo</option>
                <option value="scenes.analysis.skip_palms_button">scenes.analysis.skip_palms_button</option>
                <option value="scenes.analysis.send_palms_optional">scenes.analysis.send_palms_optional</option>
                <option value="scenes.analysis.skip_second_palm_button">scenes.analysis.skip_second_palm_button</option>
                <option value="scenes.analysis.complete_analysis_button">
                  scenes.analysis.complete_analysis_button
                </option>
                <option value="scenes.analysis.send_second_palm_optional">
                  scenes.analysis.send_second_palm_optional
                </option>

                <option value="scenes.analysis.session_completed">scenes.analysis.session_completed</option>
              </optgroup>
              <optgroup label="Ошибки">
                <option value="errors.general">errors.general</option>
                <option value="errors.account_banned">errors.account_banned</option>
                <option value="errors.user_not_found">errors.user_not_found</option>
                <option value="errors.photo_failed">errors.photo_failed</option>
                <option value="errors.analysis_creation_failed">errors.analysis_creation_failed</option>
                <option value="errors.hypothesis_creation_failed">errors.hypothesis_creation_failed</option>
              </optgroup>
            </select>
          </div>

          <div class="form-field">
            <label>Язык *</label>
            <select v-model="createForm.locale" class="form-select">
              <option value="ru">Русский</option>
              <option value="en">English</option>
            </select>
          </div>

          <div class="form-field">
            <label>Содержимое сообщения *</label>
            <textarea
              v-model="createForm.content"
              class="form-textarea"
              rows="4"
              placeholder="Введите текст сообщения (поддерживается HTML разметка)..."
            ></textarea>
          </div>

          <div class="form-field">
            <label>Описание (необязательно)</label>
            <input
              v-model="createForm.description"
              type="text"
              class="form-input"
              placeholder="Краткое описание назначения сообщения..."
            />
          </div>
        </div>

        <div class="modal-footer">
          <button @click="closeCreateModal" class="btn-secondary">Отмена</button>
          <button @click="createMessage" class="btn-primary">Создать</button>
        </div>
      </div>
    </div>

    <!-- Модал редактирования сообщения -->
    <div v-if="showEditModal" class="modal-overlay" @click="closeEditModal">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h2>Редактировать сообщение</h2>
          <button @click="closeEditModal" class="modal-close">&times;</button>
        </div>

        <div class="modal-body">
          <div class="form-field">
            <label>Ключ сообщения</label>
            <input
              :value="editForm.key"
              type="text"
              class="form-input"
              disabled
              style="background: #f9fafb; color: #6b7280"
            />
          </div>

          <div class="form-field">
            <label>Язык</label>
            <input
              :value="editForm.locale.toUpperCase()"
              type="text"
              class="form-input"
              disabled
              style="background: #f9fafb; color: #6b7280"
            />
          </div>

          <div class="form-field">
            <label>Содержимое сообщения *</label>
            <input
              type="file"
              accept="video/*"
              @change="
                (e) => {
                  editForm.contentFile = (e.target as HTMLInputElement).files?.[0] || null;
                }
              "
              v-if="editForm.content.startsWith('http') || editForm.content.startsWith('blob')"
            />
            <video
              v-if="editForm.content.startsWith('http') || editForm.content.startsWith('blob')"
              controls
              :src="editForm.contentPreview || editForm.content"
            ></video>
            <textarea
              v-else
              v-model="editForm.content"
              class="form-textarea"
              rows="6"
              placeholder="Введите текст сообщения (поддерживается HTML разметка)..."
            ></textarea>
          </div>

          <div class="form-field">
            <label>Описание</label>
            <input
              v-model="editForm.description"
              type="text"
              class="form-input"
              placeholder="Краткое описание назначения сообщения..."
            />
          </div>
        </div>

        <div class="modal-footer">
          <button @click="closeEditModal" class="btn-secondary">Отмена</button>
          <button @click="saveEditMessage" class="btn-primary">Сохранить</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';
import { useBotMessagesStore } from '../stores/bot-messages';

// Типы данных
interface BotMessage {
  key: string;
  locale: string;
  content: string;
  description?: string;
  source: 'database' | 'default';
  isActive: boolean;
  updatedAt?: string;
}

// Реальные ключевые сообщения которые используются в bot handlers (актуализировано по всем handlers)
const IMPORTANT_MESSAGE_KEYS = [
  // Приветствие и старт (start.handler.ts)
  'greeting.auto_registered',
  'greeting.referral_bonus',

  // Анализ фотографий (analyze.handler.ts)
  'scenes.analysis.send_face_photo',
  'scenes.analysis.skip_palms_button',
  'scenes.analysis.send_palms_optional',
  'scenes.analysis.skip_second_palm_button',
  'scenes.analysis.complete_analysis_button',
  'scenes.analysis.send_second_palm_optional',
  'scenes.analysis.face_only_uploaded',
  'scenes.analysis.photos_uploaded',
  'scenes.analysis.session_completed',
  'scenes.analysis.face_only_uploaded',
  'scenes.analysis.photos_uploaded',

  // Онбординг (onboarding.handler.ts)
  'onboarding.processingFeelings',
  'onboarding.feelsMessageDeclined',
  'onboarding.triggerMessage',
  'onboarding.miniAppButton',
  'onboarding.miniAppMessage',
  'onboarding.final',
  'onboarding.readyToStartSurvey',
  'onboarding.readyToStartButton',
  'onboarding.shareWithFriendsButton',
  'onboarding.makeRepostButton',
  'onboarding.purchaseParticipationButton',
  'onboarding.shareMessage',
  'onboarding.shareText',
  'onboarding.backButton',
  'onboarding.repostMessage',
  'onboarding.repostCheckButton',
  'onboarding.repostSuccessMessage',
  'onboarding.repostAlreadyActivated',
  'onboarding.photoRequest',
  'onboarding.completed',
  'onboarding.purchaseMessage',
  'onboarding.custom_answer_request',
  'onboarding.processing_voice_message',
  'onboarding.voice_question',
  'onboarding.voice_processing_error_retry',
  'onboarding.survey_results_header',
  'onboarding.voice_message_footer',
  'onboarding.answer_fallback',
  'onboarding.custom_answer_option',
  'onboarding.survey.q1.text',
  'onboarding.survey.q1.question_title',
  'onboarding.survey.q2.text',
  'onboarding.survey.q2.question_title',
  'onboarding.survey.q3.text',
  'onboarding.survey.q3.question_title',
  'onboarding.survey.q4.text',
  'onboarding.survey.q4.question_title',
  'onboarding.survey.results_header',
  'onboarding.survey.voice_message_prefix',
  'onboarding.middleware.use_survey_buttons',
  'onboarding.middleware.voice_message_required',
  'onboarding.middleware.text_answer_required',
  'onboarding.mainConclusion',
  'onboarding.readyButton',
  'onboarding.finalChoices',

  // Ошибки (все handlers)
  'errors.general',
  'errors.account_banned',
  'errors.user_not_found',
  'errors.photo_failed',
  'errors.analysis_creation_failed',
  'errors.photo_validation_failed',
  'errors.face_photo_validation_failed',
  'errors.palm_photo_validation_failed',

  // Варианты ответов для вопросов
  'onboarding.survey.q1.options.0',
  'onboarding.survey.q1.options.1',
  'onboarding.survey.q1.options.2',
  'onboarding.survey.q1.options.3',
  'onboarding.survey.q2.options.0',
  'onboarding.survey.q2.options.1',
  'onboarding.survey.q2.options.2',
  'onboarding.survey.q2.options.3',
  'onboarding.survey.q2.options.4',
  'onboarding.survey.q3.options.0',
  'onboarding.survey.q3.options.1',
  'onboarding.survey.q3.options.2',
  'onboarding.survey.q3.options.3',
  'onboarding.survey.q3.options.4',
  'onboarding.survey.q4.options.0',
  'onboarding.survey.q4.options.1',
  'onboarding.survey.q4.options.2',
  'onboarding.survey.q4.options.3',
  'onboarding.survey.q4.options.4',
  'onboarding.voice_question',
  'onboarding.backToQuestionButton',

  'videos.analysis_processing',
  'mini_app.loading_title',
  'mini_app.loading_subtitle',
  'mini_app.report_title',
  'mini_app.report_subtitle',
];

// Store
const botMessagesStore = useBotMessagesStore();

// Реактивные данные
const loading = ref(false);
const error = ref('');
const successMessage = ref('');
const messages = ref<BotMessage[]>([]);
const searchQuery = ref('');
const selectedLocale = ref('');

// Модал создания
const showCreateModal = ref(false);
const createForm = ref({
  key: '',
  locale: 'ru',
  content: '',
  description: '',
});

// Модал редактирования
const showEditModal = ref(false);
const editForm = ref<{
  key: string;
  locale: string;
  content: string;
  contentFile: File | null;
  description: string;
  contentPreview: string;
}>({
  key: '',
  locale: '',
  content: '',
  contentFile: null,
  description: '',
  contentPreview: '',
});

// Дебаунс для поиска
let searchTimeout: number | null = null;

// Удалена функция loadDefaultMessages - теперь всё загружается через основной API

// Методы
const loadMessages = async () => {
  try {
    loading.value = true;
    error.value = '';

    // Теперь серверная часть возвращает все важные сообщения (дефолтные + из БД)
    botMessagesStore.updateFilterOptions({
      page: 1,
      limit: 100,
      locale: selectedLocale.value || undefined,
      search: searchQuery.value || undefined,
    });

    await botMessagesStore.fetchMessages();

    // Фильтруем только важные ключи для безопасности
    const allMessages = botMessagesStore.getMessages.filter((msg) => IMPORTANT_MESSAGE_KEYS.includes(msg.key));

    messages.value = allMessages;
  } catch (err: any) {
    error.value = 'Ошибка загрузки сообщений: ' + err.message;
    console.error('Error loading bot messages:', err);
    messages.value = [];
  } finally {
    loading.value = false;
  }
};

const debouncedSearch = () => {
  if (searchTimeout) {
    clearTimeout(searchTimeout);
  }
  searchTimeout = setTimeout(() => {
    loadMessages();
  }, 500);
};

/**
 * Открывает модал редактирования сообщения
 */
const editMessage = async (message: BotMessage) => {
  editForm.value = {
    key: message.key,
    locale: message.locale,
    content: message.content,
    contentFile: null,
    description: message.description || '',
    contentPreview: '',
  };
  showEditModal.value = true;
};

watch(
  () => editForm.value.contentFile,
  (newFile) => {
    if (editForm.value.contentPreview) {
      URL.revokeObjectURL(editForm.value.contentPreview);
    }

    if (newFile) {
      editForm.value.contentPreview = URL.createObjectURL(newFile);
    } else {
      editForm.value.contentPreview = '';
    }
  },
);

/**
 * Закрывает модал редактирования
 */
const closeEditModal = () => {
  showEditModal.value = false;
};

/**
 * Сохраняет изменения сообщения
 */
const saveEditMessage = async () => {
  try {
    if (!editForm.value.content) {
      error.value = 'Содержимое сообщения обязательно для заполнения';
      return;
    }

    await botMessagesStore.updateMessage(editForm.value.key, editForm.value.locale, {
      content: editForm.value.content,
      description: editForm.value.description,
      contentFile: editForm.value.contentFile,
    });

    successMessage.value = 'Сообщение успешно обновлено!';
    setTimeout(() => {
      successMessage.value = '';
    }, 3000);

    closeEditModal();
    await loadMessages(); // Перезагружаем
  } catch (err: any) {
    error.value = 'Ошибка обновления сообщения: ' + err.message;
  }
};

const deleteMessage = async (message: BotMessage) => {
  try {
    if (confirm(`Вы уверены что хотите сбросить сообщение "${message.key}" к значению по умолчанию?`)) {
      await botMessagesStore.deleteMessage(message.key, message.locale);

      successMessage.value = 'Сообщение сброшено к значению по умолчанию!';
      setTimeout(() => {
        successMessage.value = '';
      }, 3000);

      await loadMessages(); // Перезагружаем
    }
  } catch (err: any) {
    error.value = 'Ошибка удаления сообщения: ' + err.message;
  }
};

const getPreviewText = (content: string) => {
  if (content.startsWith('http')) {
    return content;
  }

  const maxLength = 150;
  const textContent = content.replace(/<[^>]*>/g, '');
  if (textContent.length <= maxLength) {
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

/**
 * Открывает модал создания нового сообщения
 */
const openCreateModal = () => {
  // Сбрасываем форму
  createForm.value = {
    key: '',
    locale: 'ru',
    content: '',
    description: '',
  };
  showCreateModal.value = true;
};

/**
 * Закрывает модал создания
 */
const closeCreateModal = () => {
  showCreateModal.value = false;
};

/**
 * Создает новое сообщение
 */
const createMessage = async () => {
  try {
    if (!createForm.value.key || !createForm.value.content) {
      error.value = 'Заполните обязательные поля (ключ и содержимое)';
      return;
    }

    await botMessagesStore.createMessage(createForm.value);

    successMessage.value = 'Сообщение успешно создано!';
    setTimeout(() => {
      successMessage.value = '';
    }, 3000);

    closeCreateModal();
    await loadMessages(); // Перезагружаем список
  } catch (err: any) {
    error.value = 'Ошибка создания сообщения: ' + err.message;
  }
};

// Инициализация
onMounted(() => {
  loadMessages();
});
</script>

<style scoped>
.bot-messages-view {
  padding: 24px;
  max-width: 1200px;
  margin: 0 auto;
}

/* Header Section */
.header-section {
  margin-bottom: 32px;
}

.page-title {
  font-size: 28px;
  font-weight: 700;
  color: #1f2937;
  margin: 0 0 8px 0;
}

.page-description {
  font-size: 16px;
  color: #6b7280;
  margin: 0;
  line-height: 1.5;
}

/* Filters Section */
.filters-section {
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 20px;
  margin-bottom: 24px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.filters-row {
  display: flex;
  gap: 16px;
  align-items: center;
  flex-wrap: wrap;
}

.search-field {
  flex: 1;
  min-width: 250px;
}

.search-input {
  width: 100%;
  padding: 10px 14px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 14px;
  transition:
    border-color 0.2s,
    box-shadow 0.2s;
}

.search-input:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.locale-select {
  padding: 10px 14px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 14px;
  background: white;
  min-width: 130px;
}

.create-btn,
.refresh-btn {
  padding: 10px 20px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.2s;
  cursor: pointer;
}

.create-btn {
  background: #3b82f6;
  color: white;
  border: none;
}

.create-btn:hover {
  background: #2563eb;
}

.refresh-btn {
  background: #f9fafb;
  color: #374151;
  border: 1px solid #d1d5db;
}

.refresh-btn:hover:not(:disabled) {
  background: #f3f4f6;
}

.refresh-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Messages */
.error-message {
  background: #fef2f2;
  border: 1px solid #fecaca;
  color: #dc2626;
  padding: 12px 16px;
  border-radius: 8px;
  margin-bottom: 20px;
}

.success-message {
  background: #f0fdf4;
  border: 1px solid #bbf7d0;
  color: #16a34a;
  padding: 12px 16px;
  border-radius: 8px;
  margin-bottom: 20px;
}

.loading-state {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 60px;
  gap: 12px;
  color: #6b7280;
}

.loading-spinner {
  width: 24px;
  height: 24px;
  border: 2px solid #e5e7eb;
  border-top: 2px solid #3b82f6;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.empty-state {
  text-align: center;
  padding: 60px 20px;
  color: #6b7280;
}

.empty-icon {
  font-size: 48px;
  margin-bottom: 16px;
}

.empty-state h3 {
  font-size: 18px;
  color: #374151;
  margin: 0 0 8px 0;
}

.empty-state p {
  margin: 0;
  font-size: 14px;
}

/* Message Cards */
.messages-list {
  display: grid;
  gap: 16px;
}

.message-card {
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 20px;
  transition:
    border-color 0.2s,
    box-shadow 0.2s;
}

.message-card:hover {
  border-color: #d1d5db;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
}

.message-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 12px;
}

.message-meta {
  flex: 1;
}

.message-key {
  font-size: 16px;
  font-weight: 600;
  color: #1f2937;
  margin: 0 0 8px 0;
  font-family: 'Monaco', 'Consolas', monospace;
}

.message-badges {
  display: flex;
  gap: 8px;
}

.locale-badge,
.source-badge {
  padding: 3px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 500;
  text-transform: uppercase;
}

.locale-badge.locale-ru {
  background: #dbeafe;
  color: #1d4ed8;
}

.locale-badge.locale-en {
  background: #f3e8ff;
  color: #7c3aed;
}

.source-badge.source-database {
  background: #dcfce7;
  color: #16a34a;
}

.source-badge.source-default {
  background: #f1f5f9;
  color: #64748b;
}

.message-actions {
  display: flex;
  gap: 8px;
}

.edit-btn,
.delete-btn {
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.edit-btn {
  background: #f8fafc;
  color: #475569;
  border: 1px solid #e2e8f0;
}

.edit-btn:hover {
  background: #f1f5f9;
  border-color: #cbd5e1;
}

.delete-btn {
  background: #fef2f2;
  color: #dc2626;
  border: 1px solid #fecaca;
}

.delete-btn:hover {
  background: #fee2e2;
}

.message-description {
  font-size: 14px;
  color: #6b7280;
  margin-bottom: 12px;
  font-style: italic;
}

.message-preview {
  margin-top: 12px;
}

.content-preview {
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 14px;
  font-size: 14px;
  line-height: 1.5;
  color: #374151;
  margin-bottom: 8px;
}

.content-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
  color: #9ca3af;
}

/* Responsive */
@media (max-width: 768px) {
  .bot-messages-view {
    padding: 16px;
  }

  .filters-row {
    flex-direction: column;
    align-items: stretch;
  }

  .search-field {
    min-width: auto;
  }

  .message-header {
    flex-direction: column;
    gap: 12px;
  }

  .message-actions {
    align-self: flex-start;
  }
}

/* Modal Styles */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: white;
  border-radius: 12px;
  max-width: 600px;
  width: 90%;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow:
    0 20px 25px -5px rgba(0, 0, 0, 0.1),
    0 10px 10px -5px rgba(0, 0, 0, 0.04);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px;
  border-bottom: 1px solid #e5e7eb;
}

.modal-header h2 {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  color: #1f2937;
}

.modal-close {
  background: none;
  border: none;
  font-size: 24px;
  color: #9ca3af;
  cursor: pointer;
  padding: 0;
  line-height: 1;
  transition: color 0.2s;
}

.modal-close:hover {
  color: #6b7280;
}

.modal-body {
  padding: 24px;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 20px 24px;
  border-top: 1px solid #e5e7eb;
}

.form-field {
  margin-bottom: 20px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.form-field label {
  display: block;
  margin-bottom: 6px;
  font-size: 14px;
  font-weight: 500;
  color: #374151;
}

.form-select,
.form-input,
.form-textarea {
  width: 100%;
  padding: 10px 14px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 14px;
  transition:
    border-color 0.2s,
    box-shadow 0.2s;
}

.form-select:focus,
.form-input:focus,
.form-textarea:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.form-textarea {
  resize: vertical;
  min-height: 80px;
}

.btn-primary,
.btn-secondary {
  padding: 10px 20px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-primary {
  background: #3b82f6;
  color: white;
  border: none;
}

.btn-primary:hover {
  background: #2563eb;
}

.btn-secondary {
  background: #f9fafb;
  color: #374151;
  border: 1px solid #d1d5db;
}

.btn-secondary:hover {
  background: #f3f4f6;
}
</style>
