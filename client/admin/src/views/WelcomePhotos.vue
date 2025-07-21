<template>
  <div class="photos-view">
    <!-- Заголовок страницы -->
    <div class="header-section">
      <h1 class="page-title">Управление фотографиями приветствия</h1>
      <p class="page-description">
        Фотографии, которые отправляются пользователям в приветственном сообщении. Можно загружать, редактировать
        порядок отображения и активировать/деактивировать фотографии.
      </p>
    </div>

    <!-- Статистика -->
    <div v-if="stats" class="stats-section">
      <div class="stats-grid">
        <div class="stat-card">
          <h3>Всего фотографий</h3>
          <div class="stat-value">{{ stats.total }}</div>
        </div>
        <div class="stat-card">
          <h3>Активных</h3>
          <div class="stat-value">{{ stats.active }}</div>
        </div>
        <div class="stat-card">
          <h3>Неактивных</h3>
          <div class="stat-value">{{ stats.inactive }}</div>
        </div>
        <div class="stat-card">
          <h3>Общий размер</h3>
          <div class="stat-value">{{ formatFileSize(stats.totalSizeBytes) }}</div>
        </div>
      </div>
    </div>

    <!-- Фильтры и действия -->
    <div class="filters-section">
      <div class="filters-row">
        <div class="search-field">
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Поиск по названию или описанию..."
            class="search-input"
            @input="debouncedSearch"
          />
        </div>
        <div class="filter-field">
          <select v-model="activeFilter" class="filter-select" @change="loadPhotos">
            <option value="">Все фотографии</option>
            <option value="true">Только активные</option>
            <option value="false">Только неактивные</option>
          </select>
        </div>
        <button @click="openUploadModal" class="upload-btn">Загрузить фотографию</button>
        <button @click="loadPhotos" class="refresh-btn" :disabled="loading">
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

    <!-- Список фотографий -->
    <div v-if="loading" class="loading-state">
      <div class="loading-spinner"></div>
      <span>Загрузка фотографий...</span>
    </div>
    <div v-else-if="photos.length === 0" class="empty-state">
      <div class="empty-icon">🖼️</div>
      <h3>Фотографии приветствия не найдены</h3>
      <p>Загрузите первую фотографию приветствия, чтобы она отображалась в приветственных сообщениях пользователям.</p>
      <button @click="openUploadModal" class="upload-btn-primary">Загрузить фотографию</button>
    </div>
    <div v-else class="photos-list">
      <div v-for="photo in photos" :key="photo.id" class="photo-card">
        <div class="photo-preview">
          <img :src="getPhotoUrl(photo.filePath)" :alt="photo.title" class="photo-image" @error="handleImageError" />
          <div class="photo-overlay">
            <span class="photo-order">{{ photo.order }}</span>
            <span v-if="photo.isActive" class="status-active">Активна</span>
            <span v-else class="status-inactive">Неактивна</span>
          </div>
        </div>
        <div class="photo-info">
          <h3 class="photo-title">{{ photo.title }}</h3>
          <p v-if="photo.description" class="photo-description">{{ photo.description }}</p>
          <div class="photo-meta">
            <span class="meta-item">{{ photo.fileName }}</span>
            <span class="meta-item">{{ formatFileSize(photo.fileSize) }}</span>
            <span class="meta-item">{{ formatDate(photo.createdAt) }}</span>
          </div>
        </div>
        <div class="photo-actions">
          <button @click="editPhoto(photo)" class="edit-btn">Редактировать</button>
          <button @click="togglePhotoActive(photo)" class="toggle-btn" :class="{ active: photo.isActive }">
            {{ photo.isActive ? 'Деактивировать' : 'Активировать' }}
          </button>
          <button @click="deletePhoto(photo)" class="delete-btn">Удалить</button>
        </div>
      </div>
    </div>

    <!-- Пагинация -->
    <div v-if="totalPages > 1" class="pagination">
      <button @click="changePage(currentPage - 1)" :disabled="currentPage <= 1" class="page-btn">Назад</button>
      <span class="page-info">Страница {{ currentPage }} из {{ totalPages }}</span>
      <button @click="changePage(currentPage + 1)" :disabled="currentPage >= totalPages" class="page-btn">
        Вперед
      </button>
    </div>

    <!-- Модал загрузки фотографии -->
    <div v-if="showUploadModal" class="modal-overlay" @click="closeUploadModal">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h2>Загрузить фотографию приветствия</h2>
          <button @click="closeUploadModal" class="modal-close">&times;</button>
        </div>

        <div class="modal-body">
          <div class="upload-zone" @drop="handleFileDrop" @dragover.prevent @dragenter.prevent>
            <input ref="fileInput" type="file" accept="image/*" style="display: none" @change="handleFileSelect" />
            <div v-if="!selectedFile" class="upload-prompt" @click="selectFile">
              <div class="upload-icon">📁</div>
              <p>Нажмите чтобы выбрать файл или перетащите изображение сюда</p>
              <p class="upload-hint">Поддерживаются форматы: JPG, PNG, WebP (макс. 10MB)</p>
            </div>
            <div v-else class="file-preview">
              <img v-if="filePreview" :src="filePreview" alt="Preview" class="preview-image" />
              <div class="file-info">
                <p class="file-name">{{ selectedFile.name }}</p>
                <p class="file-size">{{ formatFileSize(selectedFile.size) }}</p>
                <button @click="clearFile" class="clear-file-btn">Очистить</button>
              </div>
            </div>
          </div>

          <div class="form-field">
            <label>Название фотографии *</label>
            <input
              v-model="uploadForm.title"
              type="text"
              class="form-input"
              placeholder="Например: Основная фотография приветствия"
            />
          </div>

          <div class="form-field">
            <label>Описание (необязательно)</label>
            <textarea
              v-model="uploadForm.description"
              class="form-textarea"
              rows="3"
              placeholder="Краткое описание назначения фотографии..."
            ></textarea>
          </div>

          <div class="form-field">
            <label class="checkbox-label">
              <input v-model="uploadForm.isActive" type="checkbox" />
              Активна (отображается пользователям)
            </label>
          </div>

          <div class="form-field">
            <label>Порядок отображения</label>
            <input
              v-model.number="uploadForm.order"
              type="number"
              min="0"
              max="100"
              class="form-input"
              placeholder="0"
            />
          </div>
        </div>

        <div class="modal-footer">
          <button @click="closeUploadModal" class="btn-secondary">Отмена</button>
          <button @click="uploadPhoto" class="btn-primary" :disabled="!selectedFile || !uploadForm.title">
            Загрузить
          </button>
        </div>
      </div>
    </div>

    <!-- Модал редактирования фотографии -->
    <div v-if="showEditModal" class="modal-overlay" @click="closeEditModal">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h2>Редактировать фотографию</h2>
          <button @click="closeEditModal" class="modal-close">&times;</button>
        </div>

        <div class="modal-body">
          <div class="form-field">
            <label>Название фотографии *</label>
            <input v-model="editForm.title" type="text" class="form-input" />
          </div>

          <div class="form-field">
            <label>Описание</label>
            <textarea v-model="editForm.description" class="form-textarea" rows="3"></textarea>
          </div>

          <div class="form-field">
            <label class="checkbox-label">
              <input v-model="editForm.isActive" type="checkbox" />
              Активна (отображается пользователям)
            </label>
          </div>

          <div class="form-field">
            <label>Порядок отображения</label>
            <input v-model.number="editForm.order" type="number" min="0" max="100" class="form-input" />
          </div>
        </div>

        <div class="modal-footer">
          <button @click="closeEditModal" class="btn-secondary">Отмена</button>
          <button @click="saveEditPhoto" class="btn-primary">Сохранить</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { welcomePhotosApi } from '../api';
import type {
  WelcomePhoto,
  WelcomePhotoFilterOptions,
  CreateWelcomePhotoRequest,
  UpdateWelcomePhotoRequest,
  WelcomePhotoStats,
} from '../types';

// Реактивные данные
const loading = ref(false);
const error = ref('');
const successMessage = ref('');
const photos = ref<WelcomePhoto[]>([]);
const stats = ref<WelcomePhotoStats | null>(null);
const searchQuery = ref('');
const activeFilter = ref('');

// Пагинация
const currentPage = ref(1);
const limit = ref(12);
const totalPages = ref(0);

// Модал загрузки
const showUploadModal = ref(false);
const selectedFile = ref<File | null>(null);
const filePreview = ref<string | null>(null);
const fileInput = ref<HTMLInputElement | null>(null);
const uploadForm = ref<CreateWelcomePhotoRequest>({
  title: '',
  description: '',
  isActive: true,
  order: 0,
});

// Модал редактирования
const showEditModal = ref(false);
const editingPhoto = ref<WelcomePhoto | null>(null);
const editForm = ref<UpdateWelcomePhotoRequest>({
  title: '',
  description: '',
  isActive: true,
  order: 0,
});

// Дебаунс для поиска
let searchTimeout: number | null = null;

// Методы
const loadPhotos = async () => {
  try {
    loading.value = true;
    error.value = '';

    const options: WelcomePhotoFilterOptions = {
      page: currentPage.value,
      limit: limit.value,
      search: searchQuery.value || undefined,
      isActive: activeFilter.value ? activeFilter.value === 'true' : undefined,
    };

    const response = await welcomePhotosApi.getWelcomePhotos(options);
    photos.value = response.photos;
    totalPages.value = response.totalPages;
  } catch (err: any) {
    error.value = 'Ошибка загрузки фотографий: ' + err.message;
    console.error('Error loading welcome photos:', err);
  } finally {
    loading.value = false;
  }
};

const loadStats = async () => {
  try {
    stats.value = await welcomePhotosApi.getWelcomePhotosStats();
  } catch (err: any) {
    console.error('Error loading stats:', err);
  }
};

const debouncedSearch = () => {
  if (searchTimeout) {
    clearTimeout(searchTimeout);
  }
  searchTimeout = setTimeout(() => {
    currentPage.value = 1;
    loadPhotos();
  }, 500);
};

const changePage = (page: number) => {
  currentPage.value = page;
  loadPhotos();
};

// Файловые операции
const selectFile = () => {
  fileInput.value?.click();
};

const handleFileSelect = (event: Event) => {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  if (file) {
    setSelectedFile(file);
  }
};

const handleFileDrop = (event: DragEvent) => {
  event.preventDefault();
  const file = event.dataTransfer?.files[0];
  if (file && file.type.startsWith('image/')) {
    setSelectedFile(file);
  }
};

const setSelectedFile = (file: File) => {
  selectedFile.value = file;

  // Создаем превью
  const reader = new FileReader();
  reader.onload = (e) => {
    filePreview.value = e.target?.result as string;
  };
  reader.readAsDataURL(file);
};

const clearFile = () => {
  selectedFile.value = null;
  filePreview.value = null;
  if (fileInput.value) {
    fileInput.value.value = '';
  }
};

// Модалы
const openUploadModal = () => {
  uploadForm.value = {
    title: '',
    description: '',
    isActive: true,
    order: 0,
  };
  showUploadModal.value = true;
};

const closeUploadModal = () => {
  showUploadModal.value = false;
  clearFile();
};

const uploadPhoto = async () => {
  try {
    if (!selectedFile.value || !uploadForm.value.title) {
      error.value = 'Заполните обязательные поля и выберите файл';
      return;
    }

    const response = await welcomePhotosApi.uploadWelcomePhoto(selectedFile.value, uploadForm.value);

    successMessage.value = response.message;
    setTimeout(() => {
      successMessage.value = '';
    }, 3000);

    closeUploadModal();
    await loadPhotos();
    await loadStats();
  } catch (err: any) {
    error.value = 'Ошибка загрузки фотографии: ' + err.message;
  }
};

const editPhoto = (photo: WelcomePhoto) => {
  editingPhoto.value = photo;
  editForm.value = {
    title: photo.title,
    description: photo.description,
    isActive: photo.isActive,
    order: photo.order,
  };
  showEditModal.value = true;
};

const closeEditModal = () => {
  showEditModal.value = false;
  editingPhoto.value = null;
};

const saveEditPhoto = async () => {
  try {
    if (!editingPhoto.value || !editForm.value.title) {
      error.value = 'Заполните обязательные поля';
      return;
    }

    await welcomePhotosApi.updateWelcomePhoto(editingPhoto.value.id, editForm.value);

    successMessage.value = 'Фотография успешно обновлена!';
    setTimeout(() => {
      successMessage.value = '';
    }, 3000);

    closeEditModal();
    await loadPhotos();
    await loadStats();
  } catch (err: any) {
    error.value = 'Ошибка обновления фотографии: ' + err.message;
  }
};

const togglePhotoActive = async (photo: WelcomePhoto) => {
  try {
    await welcomePhotosApi.updateWelcomePhoto(photo.id, {
      isActive: !photo.isActive,
    });

    successMessage.value = `Фотография ${!photo.isActive ? 'активирована' : 'деактивирована'}!`;
    setTimeout(() => {
      successMessage.value = '';
    }, 3000);

    await loadPhotos();
    await loadStats();
  } catch (err: any) {
    error.value = 'Ошибка изменения статуса фотографии: ' + err.message;
  }
};

const deletePhoto = async (photo: WelcomePhoto) => {
  try {
    if (!confirm(`Вы уверены что хотите удалить фотографию "${photo.title}"?`)) {
      return;
    }

    await welcomePhotosApi.deleteWelcomePhoto(photo.id);

    successMessage.value = 'Фотография успешно удалена!';
    setTimeout(() => {
      successMessage.value = '';
    }, 3000);

    await loadPhotos();
    await loadStats();
  } catch (err: any) {
    error.value = 'Ошибка удаления фотографии: ' + err.message;
  }
};

// Утилиты
const getPhotoUrl = (filePath: string) => {
  // Преобразуем относительный путь в абсолютный URL
  const baseUrl = window.location.origin;
  return `${baseUrl}/${filePath}`;
};

const handleImageError = (event: Event) => {
  const img = event.target as HTMLImageElement;
  img.src =
    'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjE1MCIgdmlld0JveD0iMCAwIDIwMCAxNTAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIyMDAiIGhlaWdodD0iMTUwIiBmaWxsPSIjRjNGNEY2Ii8+CjxwYXRoIGQ9Ik0xMDAgNzVMMTI1IDEwMEg3NUwxMDAgNzVaIiBmaWxsPSIjOUNBM0FGIi8+CjxjaXJjbGUgY3g9IjE1MCIgY3k9IjQwIiByPSIxMCIgZmlsbD0iIzlDQTNBRiIvPgo8L3N2Zz4K';
};

const formatFileSize = (bytes: number) => {
  const sizes = ['Б', 'КБ', 'МБ', 'ГБ'];
  if (bytes === 0) return '0 Б';
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return Math.round((bytes / Math.pow(1024, i)) * 100) / 100 + ' ' + sizes[i];
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
  loadPhotos();
  loadStats();
});
</script>

<style scoped>
.photos-view {
  padding: 24px;
  max-width: 1400px;
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

/* Stats Section */
.stats-section {
  margin-bottom: 32px;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 20px;
}

.stat-card {
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 20px;
  text-align: center;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.stat-card h3 {
  font-size: 14px;
  font-weight: 500;
  color: #6b7280;
  margin: 0 0 8px 0;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.stat-value {
  font-size: 24px;
  font-weight: 700;
  color: #1f2937;
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

.filter-select {
  padding: 10px 14px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 14px;
  background: white;
  min-width: 150px;
}

.upload-btn,
.refresh-btn {
  padding: 10px 20px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.2s;
  cursor: pointer;
}

.upload-btn {
  background: #3b82f6;
  color: white;
  border: none;
}

.upload-btn:hover {
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
  margin: 0 0 20px 0;
  font-size: 14px;
}

.upload-btn-primary {
  background: #3b82f6;
  color: white;
  border: none;
  padding: 12px 24px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.upload-btn-primary:hover {
  background: #2563eb;
}

/* Photos Grid */
.photos-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 24px;
  margin-bottom: 32px;
}

.photo-card {
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  transition: box-shadow 0.2s;
}

.photo-card:hover {
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
}

.photo-preview {
  position: relative;
  height: 200px;
  overflow: hidden;
}

.photo-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.photo-overlay {
  position: absolute;
  top: 8px;
  right: 8px;
  display: flex;
  gap: 8px;
}

.photo-order {
  background: rgba(0, 0, 0, 0.7);
  color: white;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
}

.status-active {
  background: #10b981;
  color: white;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
}

.status-inactive {
  background: #ef4444;
  color: white;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
}

.photo-info {
  padding: 16px;
}

.photo-title {
  font-size: 16px;
  font-weight: 600;
  color: #1f2937;
  margin: 0 0 8px 0;
}

.photo-description {
  font-size: 14px;
  color: #6b7280;
  margin: 0 0 12px 0;
  line-height: 1.4;
}

.photo-meta {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.meta-item {
  font-size: 12px;
  color: #9ca3af;
}

.photo-actions {
  padding: 16px;
  border-top: 1px solid #f3f4f6;
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.edit-btn,
.toggle-btn,
.delete-btn {
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  border: 1px solid;
}

.edit-btn {
  background: #f8fafc;
  color: #475569;
  border-color: #e2e8f0;
}

.edit-btn:hover {
  background: #f1f5f9;
}

.toggle-btn {
  background: #fef3c7;
  color: #92400e;
  border-color: #fde68a;
}

.toggle-btn.active {
  background: #dcfce7;
  color: #166534;
  border-color: #bbf7d0;
}

.toggle-btn:hover {
  opacity: 0.8;
}

.delete-btn {
  background: #fef2f2;
  color: #dc2626;
  border-color: #fecaca;
}

.delete-btn:hover {
  background: #fee2e2;
}

/* Pagination */
.pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 16px;
  margin-top: 32px;
}

.page-btn {
  padding: 8px 16px;
  border: 1px solid #d1d5db;
  background: white;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
}

.page-btn:hover:not(:disabled) {
  background: #f3f4f6;
}

.page-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.page-info {
  font-size: 14px;
  color: #6b7280;
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
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
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

/* Upload Zone */
.upload-zone {
  border: 2px dashed #d1d5db;
  border-radius: 8px;
  padding: 24px;
  text-align: center;
  margin-bottom: 20px;
  transition: border-color 0.2s;
}

.upload-zone:hover {
  border-color: #3b82f6;
}

.upload-prompt {
  cursor: pointer;
}

.upload-icon {
  font-size: 48px;
  margin-bottom: 16px;
}

.upload-hint {
  font-size: 12px;
  color: #9ca3af;
  margin: 8px 0 0 0;
}

.file-preview {
  display: flex;
  align-items: center;
  gap: 16px;
}

.preview-image {
  width: 100px;
  height: 100px;
  object-fit: cover;
  border-radius: 8px;
}

.file-info {
  flex: 1;
}

.file-name {
  font-weight: 500;
  margin: 0 0 4px 0;
}

.file-size {
  color: #6b7280;
  margin: 0 0 8px 0;
  font-size: 14px;
}

.clear-file-btn {
  background: #ef4444;
  color: white;
  border: none;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
}

/* Form Fields */
.form-field {
  margin-bottom: 20px;
}

.form-field label {
  display: block;
  margin-bottom: 6px;
  font-size: 14px;
  font-weight: 500;
  color: #374151;
}

.checkbox-label {
  display: flex !important;
  align-items: center;
  gap: 8px;
  cursor: pointer;
}

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

.btn-primary:hover:not(:disabled) {
  background: #2563eb;
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-secondary {
  background: #f9fafb;
  color: #374151;
  border: 1px solid #d1d5db;
}

.btn-secondary:hover {
  background: #f3f4f6;
}

/* Responsive */
@media (max-width: 768px) {
  .photos-view {
    padding: 16px;
  }

  .filters-row {
    flex-direction: column;
    align-items: stretch;
  }

  .search-field {
    min-width: auto;
  }

  .photos-list {
    grid-template-columns: 1fr;
  }

  .photo-actions {
    flex-direction: column;
  }

  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>
