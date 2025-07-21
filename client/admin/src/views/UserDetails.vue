<template>
  <div class="user-detail-container">
    <el-card class="user-info">
      <template #header>
        <div class="card-header">
          <h3>Информация о пользователе</h3>
          <div class="actions">
            <el-button type="primary" size="small" @click="showCreditsDialog"> Управление кредитами </el-button>
            <el-button :type="user?.isBanned ? 'success' : 'danger'" size="small" @click="toggleBanStatus">
              {{ user?.isBanned ? 'Разбанить' : 'Забанить' }}
            </el-button>
          </div>
        </div>
      </template>

      <div v-if="loading">Загрузка данных пользователя...</div>
      <div v-else-if="user" class="user-data">
        <!-- Основная информация -->
        <el-descriptions title="Основная информация" border>
          <el-descriptions-item label="Email">{{ user.email || 'Не указан' }}</el-descriptions-item>
          <el-descriptions-item label="Telegram ID">{{ user.telegramId }}</el-descriptions-item>
          <el-descriptions-item label="Telegram Username">{{
            user.telegramUsername || 'Не указан'
          }}</el-descriptions-item>
          <el-descriptions-item label="Telegram Chat ID">{{ user.telegramChatId || 'Не указан' }}</el-descriptions-item>
          <el-descriptions-item label="Кредиты анализа">{{ user.analysisCredits }}</el-descriptions-item>
          <el-descriptions-item label="Язык">{{ user.language === 'EN' ? 'English' : 'Русский' }}</el-descriptions-item>
          <el-descriptions-item label="Реферальный код">{{ user.referralCode }}</el-descriptions-item>
          <el-descriptions-item label="Роль">{{ user.role }}</el-descriptions-item>
          <el-descriptions-item label="Статус аккаунта">
            <el-tag :type="user.isBanned ? 'danger' : 'success'">
              {{ user.isBanned ? 'Заблокирован' : 'Активен' }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item v-if="user.isBanned" label="Причина бана">
            {{ user.banReason || 'Не указана' }}
          </el-descriptions-item>
          <el-descriptions-item v-if="user.isBanned" label="Дата бана">
            {{ formatDate(user.bannedAt) }}
          </el-descriptions-item>
          <el-descriptions-item label="Дата создания">{{ formatDate(user.createdAt) }}</el-descriptions-item>
        </el-descriptions>

        <!-- Статусы и подписка -->
        <el-descriptions title="Статусы и подписка" border class="status-section">
          <el-descriptions-item label="Заблокирован в боте">
            <el-tag :type="user.isBotBlocked ? 'danger' : 'success'">
              {{ user.isBotBlocked ? 'Да' : 'Нет' }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item v-if="user.isBotBlocked" label="Дата блокировки в боте">
            {{ formatDate(user.botBlockedAt) }}
          </el-descriptions-item>
          <el-descriptions-item label="Подписка активна">
            <el-tag :type="user.subscriptionActive ? 'success' : 'info'">
              {{ user.subscriptionActive ? 'Да' : 'Нет' }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item v-if="user.subscriptionActive" label="Подписка истекает">
            {{ formatDate(user.subscriptionExpiry) }}
          </el-descriptions-item>
          <el-descriptions-item label="Попытки загрузки фото">{{ user.photoFailureAttempts }}</el-descriptions-item>
          <el-descriptions-item label="Действие воронки">
            <el-tag v-if="user.funnelAction" type="info">{{ user.funnelAction }}</el-tag>
            <span v-else>Не указано</span>
          </el-descriptions-item>
          <el-descriptions-item label="Состояние воронки">
            <el-tag v-if="user.funnelState" type="info">{{ user.funnelState }}</el-tag>
            <span v-else>Не указано</span>
          </el-descriptions-item>
          <el-descriptions-item label="Состояние пайплайна">
            <el-tag v-if="user.pipelineState" type="warning">{{ user.pipelineState }}</el-tag>
            <span v-else>Не указано</span>
          </el-descriptions-item>
        </el-descriptions>
      </div>
    </el-card>

    <!-- AI Анализы и гипотезы -->
    <el-card v-if="user?.userInfo" class="ai-analysis">
      <template #header>
        <h3>ИИ Анализы и гипотезы</h3>
      </template>

      <!-- Описание от OpenAI Vision -->
      <div v-if="user.userInfo.description" class="analysis-section">
        <h4>Описание от OpenAI Vision API</h4>
        <el-input v-model="user.userInfo.description" type="textarea" :rows="4" readonly class="readonly-textarea" />
      </div>

      <!-- Ответы на диагностический опрос -->
      <div class="analysis-section">
        <h4>Диагностический опрос (4 вопроса)</h4>
        <div v-if="getSurveyAnswers().length > 0">
          <div v-for="(qa, index) in getSurveyAnswers()" :key="index" class="survey-item">
            <div class="survey-question">
              <strong>{{ index + 1 }}. {{ qa.question }}</strong>
            </div>
            <div class="survey-answer">
              {{ qa.answer }}
              <el-tag v-if="qa.isCustom" size="small" type="info" class="custom-tag">Свой вариант</el-tag>
            </div>
          </div>
        </div>
        <div v-else class="no-survey-data">
          <el-alert title="Диагностический опрос не пройден" type="info" :closable="false" show-icon>
            <template #default>
              <div>Пользователь еще не прошел диагностический опрос из 4 вопросов или данные отсутствуют.</div>
              <div v-if="user.userInfo?.surveyAnswers" class="debug-info">
                <strong>Отладка:</strong> Найдены surveyAnswers: {{ user.userInfo.surveyAnswers.substring(0, 100) }}...
              </div>
              <div v-else class="debug-info"><strong>Отладка:</strong> Поле surveyAnswers пустое или отсутствует</div>
            </template>
          </el-alert>
        </div>
      </div>

      <!-- Объединенные чувства (опрос + голосовое сообщение) -->
      <div v-if="user.userInfo.feelings" class="analysis-section">
        <h4>Результаты диагностического опроса + голосовое сообщение</h4>
        <el-input v-model="user.userInfo.feelings" type="textarea" :rows="6" readonly class="readonly-textarea" />
      </div>

      <!-- Блок-гипотеза (единственная гипотеза) -->
      <div v-if="user.userInfo.blockHypothesis" class="analysis-section">
        <h4>Блок-гипотеза от OpenAI</h4>
        <el-input
          v-model="user.userInfo.blockHypothesis"
          type="textarea"
          :rows="6"
          readonly
          class="readonly-textarea"
        />
      </div>

      <!-- Счетчик отклонений и тест Люшера -->
      <el-descriptions border>
        <el-descriptions-item label="Отклонений гипотезы">{{
          user.userInfo.hypothesisRejectedCount
        }}</el-descriptions-item>
        <el-descriptions-item label="Результат теста Люшера">
          <span v-if="user.userInfo.luscherTestResult">Есть данные</span>
          <span v-else>Нет данных</span>
        </el-descriptions-item>
        <el-descriptions-item label="Дата создания UserInfo">{{
          formatDate(user.userInfo.createdAt)
        }}</el-descriptions-item>
      </el-descriptions>
    </el-card>

    <!-- Текущий таймер -->
    <el-card v-if="user?.userTimer" class="timer-info">
      <template #header>
        <h3>Текущий таймер</h3>
      </template>

      <el-descriptions border>
        <el-descriptions-item label="Chat ID">{{ user.userTimer.chatId }}</el-descriptions-item>
        <el-descriptions-item label="Message ID">{{ user.userTimer.messageId || 'Не указан' }}</el-descriptions-item>
        <el-descriptions-item label="Время начала">{{ formatDate(user.userTimer.startTime) }}</el-descriptions-item>
        <el-descriptions-item label="Время окончания">{{ formatDate(user.userTimer.endTime) }}</el-descriptions-item>
        <el-descriptions-item label="Завершен">
          <el-tag :type="user.userTimer.completed ? 'success' : 'warning'">
            {{ user.userTimer.completed ? 'Да' : 'Нет' }}
          </el-tag>
        </el-descriptions-item>
      </el-descriptions>
    </el-card>

    <!-- Рефералы -->
    <el-card class="referrals" v-if="user?.referrals?.length">
      <template #header>
        <h3>Рефералы ({{ user.referrals.length }})</h3>
      </template>

      <el-table :data="user.referrals" style="width: 100%">
        <el-table-column prop="invitedUser.telegramUsername" label="Username" show-overflow-tooltip />
        <el-table-column prop="invitedUser.telegramId" label="Telegram ID" />
        <el-table-column label="Дата приглашения" width="180">
          <template #default="scope">
            {{ formatDate(scope.row.invitedUser.createdAt) }}
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- История анализов с фотографиями -->
    <el-card class="analysis-history">
      <template #header>
        <h3>История анализов с фотографиями ({{ user?.analyses?.length || 0 }})</h3>
      </template>

      <div v-if="loading">Загрузка истории...</div>
      <div v-else-if="user?.analyses?.length">
        <div v-for="analysis in user.analyses" :key="analysis.id" class="analysis-item">
          <el-card class="analysis-card" shadow="hover">
            <div class="analysis-header">
              <div>
                <strong>Анализ {{ analysis.id }}</strong>
                <el-tag :type="getStatusTag(analysis.status)" class="status-tag">
                  {{ analysis.status }}
                </el-tag>
              </div>
              <div class="analysis-date">{{ formatDate(analysis.createdAt) }}</div>
            </div>

            <!-- Фотографии -->
            <div v-if="analysis.inputPhotoUrl?.length" class="photo-section">
              <h4>Загруженные фотографии ({{ analysis.inputPhotoUrl.length }})</h4>
              <div class="photo-grid">
                <div v-for="(photoUrl, index) in analysis.inputPhotoUrl" :key="index" class="photo-item">
                  <el-image
                    :src="photoUrl"
                    :preview-src-list="analysis.inputPhotoUrl"
                    class="photo-thumbnail"
                    fit="cover"
                    loading="lazy"
                  >
                    <template #error>
                      <div class="image-error">
                        <el-icon><Picture /></el-icon>
                        <span>Фото недоступно</span>
                      </div>
                    </template>
                  </el-image>
                  <span class="photo-label">Фото {{ index + 1 }}</span>
                </div>
              </div>
            </div>

            <!-- Результаты анализа -->
            <div v-if="analysis.analysisResultText" class="result-section">
              <h4>Результат анализа от OpenAI</h4>
              <el-input
                :model-value="analysis.analysisResultText"
                type="textarea"
                :rows="6"
                readonly
                class="readonly-textarea"
              />
            </div>

            <!-- Краткое резюме -->
            <div v-if="analysis.summaryText" class="result-section">
              <h4>Краткое резюме</h4>
              <el-input
                :model-value="analysis.summaryText"
                type="textarea"
                :rows="3"
                readonly
                class="readonly-textarea"
              />
            </div>

            <!-- Открытка -->
            <div v-if="analysis.postcardImageUrl" class="postcard-section">
              <h4>Сгенерированная открытка</h4>
              <el-image
                :src="analysis.postcardImageUrl"
                class="postcard-image"
                fit="contain"
                :preview-src-list="[analysis.postcardImageUrl]"
              >
                <template #error>
                  <div class="image-error">
                    <el-icon><Picture /></el-icon>
                    <span>Открытка недоступна</span>
                  </div>
                </template>
              </el-image>
            </div>

            <!-- Ошибка -->
            <div v-if="analysis.errorMessage" class="error-section">
              <h4>Ошибка анализа</h4>
              <el-alert :title="analysis.errorMessage" type="error" :closable="false" show-icon />
            </div>

            <!-- Метаинформация -->
            <el-descriptions :column="3" size="small" class="analysis-meta">
              <el-descriptions-item label="Тип">{{ formatAnalysisType(analysis.type) }}</el-descriptions-item>
              <el-descriptions-item label="Стоимость">{{ analysis.cost }} кредитов</el-descriptions-item>
              <el-descriptions-item label="Обновлен">{{ formatDate(analysis.updatedAt) }}</el-descriptions-item>
            </el-descriptions>
          </el-card>
        </div>
      </div>
      <div v-else class="no-data">Нет истории анализов</div>
    </el-card>

    <!-- События воронки -->
    <el-card v-if="user?.funnelEvents?.length" class="funnel-events">
      <template #header>
        <h3>События воронки (последние {{ user.funnelEvents.length }})</h3>
      </template>

      <el-table :data="user.funnelEvents" style="width: 100%">
        <el-table-column prop="eventType" label="Тип события" width="200">
          <template #default="scope">
            <el-tag type="info">{{ scope.row.eventType }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="previousValue" label="Предыдущее значение" />
        <el-table-column prop="newValue" label="Новое значение" />
        <el-table-column label="Дата" width="180">
          <template #default="scope">
            {{ formatDate(scope.row.createdAt) }}
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- Диалоги остаются прежними -->
    <el-dialog title="Управление кредитами анализа" v-model="creditsDialogVisible" width="30%">
      <p>Текущие кредиты: {{ user?.analysisCredits }}</p>
      <el-form>
        <el-form-item label="Добавить кредитов">
          <el-input-number v-model="creditsAmount" :min="1" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="addCredits">Добавить кредиты</el-button>
        </el-form-item>
      </el-form>
    </el-dialog>

    <el-dialog
      :title="user?.isBanned ? 'Разбанить пользователя' : 'Забанить пользователя'"
      v-model="banDialogVisible"
      width="30%"
    >
      <el-form v-if="!user?.isBanned">
        <el-form-item label="Причина бана">
          <el-input v-model="banReason" type="textarea" />
        </el-form-item>
      </el-form>
      <span v-else>Вы уверены, что хотите разбанить этого пользователя?</span>
      <template #footer>
        <el-button @click="banDialogVisible = false">Отмена</el-button>
        <el-button type="primary" @click="confirmBanAction">Подтвердить</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { usersApi } from '../api';
import type { ExtendedUserDetailsResponse } from '../types';
import { ElMessage } from 'element-plus';
import { Picture } from '@element-plus/icons-vue';

const route = useRoute();
const router = useRouter();
const userId = route.params.id as string;

const user = ref<ExtendedUserDetailsResponse | null>(null);
const loading = ref(false);

const creditsDialogVisible = ref(false);
const creditsAmount = ref(1);

const banDialogVisible = ref(false);
const banReason = ref('');

/**
 * Валидирует ID пользователя
 * @param id - ID пользователя для проверки
 * @returns true если ID корректный
 */
const validateUserId = (id: string): boolean => {
  // Проверяем что ID не пустой и соответствует формату cuid (примерно 25 символов, alphanumeric)
  if (!id || typeof id !== 'string') {
    return false;
  }

  // cuid обычно начинается с 'c' и содержит около 25 символов
  const cuidPattern = /^c[a-z0-9]{24}$/i;
  return cuidPattern.test(id);
};

/**
 * Перенаправляет на главную панель с сообщением об ошибке
 * @param message - сообщение об ошибке
 */
const redirectToPanel = (message: string) => {
  ElMessage.error(message);
  console.error('Redirecting to panel due to error:', message);
  router.push('/').catch((err) => {
    console.error('Failed to redirect to panel:', err);
  });
};

const formatDate = (dateString?: string) => {
  if (!dateString) return 'Не указана';
  return new Date(dateString).toLocaleString('ru-RU');
};

const formatAnalysisType = (type: string) => {
  const typeMap: Record<string, string> = {
    DEFAULT: 'Стандартный анализ',
    FAST_ANALYZE: 'Быстрый анализ',
    PROFORIENTATION_ANALYZE: 'Профориентация',
    COMPATIBILITY_ANALYZE: 'Совместимость',
    KINETIC_ANALYZE: 'Кинетический анализ',
    INCOME_GROWTH_ANALYZE: 'Рост дохода',
    LOCATION_ANALYZE: 'Анализ локации',
    COUPLE_FAMILY_GROWTH_ANALYZE: 'Рост пары/семьи',
    BUSINESS_COMMUNICATION_ANALYZE: 'Бизнес-коммуникация',
    FUTURE_ANALYZE: 'Анализ будущего',
    HEALTH_ANALYZE: 'Анализ здоровья',
    CHILD_ANALYZE: 'Детский анализ',
    STRANGER_ANALYZE: 'Анализ незнакомца',
    SPIRITUALITY_ANALYZE: 'Духовность',
    COUPLE_COMPATIBILITY_ANALYZE: 'Совместимость пары',
    BUSINESS_COMPATIBILITY_ANALYZE: 'Бизнес-совместимость',
  };
  return typeMap[type] || type;
};

const getStatusTag = (status: string) => {
  switch (status) {
    case 'COMPLETED':
      return 'success';
    case 'PROCESSING':
      return 'warning';
    case 'PENDING':
      return 'info';
    case 'FAILED':
      return 'danger';
    default:
      return 'info';
  }
};

const loadUser = async () => {
  // Предварительная валидация userId
  if (!validateUserId(userId)) {
    redirectToPanel(`Некорректный ID пользователя: ${userId}`);
    return;
  }

  loading.value = true;
  try {
    user.value = await usersApi.getUserById(userId);

    // Дополнительная проверка что пользователь действительно найден
    if (!user.value) {
      redirectToPanel('Пользователь не найден');
      return;
    }

    console.log('User loaded successfully:', user.value.id);
  } catch (error: any) {
    console.error('Error loading user:', error);

    // Обработка различных типов ошибок
    if (error?.response?.status === 404) {
      redirectToPanel('Пользователь не найден');
    } else if (error?.response?.status === 500) {
      redirectToPanel('Внутренняя ошибка сервера при загрузке пользователя');
    } else if (error?.response?.status === 403) {
      redirectToPanel('Нет доступа к данным пользователя');
    } else if (error?.message?.includes('Network Error')) {
      ElMessage.error('Ошибка сети. Проверьте подключение к интернету');
    } else {
      // При критических ошибках перенаправляем на панель
      redirectToPanel('Не удалось загрузить данные пользователя');
    }
  } finally {
    loading.value = false;
  }
};

const showCreditsDialog = () => {
  creditsDialogVisible.value = true;
};

const addCredits = async () => {
  if (!user.value) return;

  try {
    await usersApi.addCredits(user.value.id, creditsAmount.value);
    ElMessage.success('Кредиты успешно добавлены');
    creditsDialogVisible.value = false;
    await loadUser(); // Refresh user data
  } catch (error: any) {
    console.error('Error adding credits:', error);

    if (error?.response?.status === 404) {
      redirectToPanel('Пользователь не найден при добавлении кредитов');
    } else {
      ElMessage.error('Не удалось добавить кредиты');
    }
  }
};

const toggleBanStatus = () => {
  banDialogVisible.value = true;
};

const confirmBanAction = async () => {
  if (!user.value) return;

  try {
    if (user.value.isBanned) {
      await usersApi.unbanUser(user.value.id);
      ElMessage.success('Пользователь разбанен');
    } else {
      await usersApi.banUser(user.value.id, banReason.value);
      ElMessage.success('Пользователь забанен');
    }
    banDialogVisible.value = false;
    banReason.value = '';
    await loadUser(); // Refresh user data
  } catch (error: any) {
    console.error('Error updating ban status:', error);

    if (error?.response?.status === 404) {
      redirectToPanel('Пользователь не найден при изменении статуса бана');
    } else {
      ElMessage.error('Не удалось обновить статус бана');
    }
  }
};

const getSurveyAnswers = () => {
  if (!user.value?.userInfo?.surveyAnswers) {
    return [];
  }

  try {
    const surveyData = JSON.parse(user.value.userInfo.surveyAnswers);
    const questions = [
      'Человек сильно подвёл. Ваша первая реакция:',
      'Какую полезную привычку вы бросаете первой при перегрузе:',
      'В сутках осталось только 30 минут свободного времени. На что потратите их:',
      'Через три года вы кричите от радости. Что именно сбылось:',
    ];

    const result: Array<{ question: string; answer: string; isCustom: boolean }> = [];

    for (let i = 1; i <= 4; i++) {
      const questionKey = `question${i}`;
      const answerData = surveyData[questionKey];

      if (answerData && questions[i - 1]) {
        result.push({
          question: questions[i - 1],
          answer: answerData.answerText || 'Нет ответа',
          isCustom: answerData.isCustom || false,
        });
      }
    }

    return result;
  } catch (error) {
    console.error('Error parsing survey answers:', error);
    return [];
  }
};

// Инициализация компонента с проверками
onMounted(() => {
  // Проверяем наличие параметра route
  if (!route.params.id) {
    redirectToPanel('Отсутствует ID пользователя в URL');
    return;
  }

  console.log('Loading user with ID:', userId);
  loadUser();
});
</script>

<style scoped>
.user-detail-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.actions {
  display: flex;
  gap: 10px;
}

.user-info,
.ai-analysis,
.timer-info,
.referrals,
.analysis-history,
.funnel-events {
  margin-bottom: 20px;
}

.status-section {
  margin-top: 20px;
}

.user-data,
.no-data {
  padding: 20px 0;
}

.no-data {
  text-align: center;
  color: #666;
}

/* ИИ анализы стили */
.analysis-section {
  margin-bottom: 20px;
}

.analysis-section h4 {
  color: #409eff;
  margin-bottom: 10px;
  font-size: 14px;
  font-weight: 600;
}

.readonly-textarea :deep(.el-textarea__inner) {
  background-color: #f5f7fa;
  color: #606266;
  resize: none;
}

/* Диагностический опрос */
.survey-item {
  background-color: #f8f9fa;
  border: 1px solid #e9ecef;
  border-radius: 6px;
  padding: 12px;
  margin-bottom: 12px;
}

.survey-question {
  color: #495057;
  font-size: 14px;
  margin-bottom: 8px;
  line-height: 1.4;
}

.survey-answer {
  color: #6c757d;
  font-size: 13px;
  font-style: italic;
  display: flex;
  align-items: center;
  gap: 8px;
}

.custom-tag {
  margin-left: auto;
}

/* Отладочная информация и отсутствие данных */
.no-survey-data {
  margin: 15px 0;
}

.debug-info {
  margin-top: 8px;
  font-size: 12px;
  color: #909399;
  font-family: 'Courier New', monospace;
  background-color: #f5f7fa;
  padding: 8px;
  border-radius: 4px;
  border-left: 3px solid #409eff;
}

/* Анализы с фотографиями */
.analysis-item {
  margin-bottom: 20px;
}

.analysis-card {
  border: 1px solid #dcdfe6;
}

.analysis-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
  padding-bottom: 10px;
  border-bottom: 1px solid #ebeef5;
}

.status-tag {
  margin-left: 10px;
}

.analysis-date {
  color: #909399;
  font-size: 14px;
}

/* Фотографии */
.photo-section {
  margin-bottom: 20px;
}

.photo-section h4 {
  color: #67c23a;
  margin-bottom: 15px;
  font-size: 14px;
  font-weight: 600;
}

.photo-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 15px;
  margin-bottom: 15px;
}

.photo-item {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.photo-thumbnail {
  width: 150px;
  height: 150px;
  border-radius: 8px;
  border: 2px solid #e4e7ed;
  overflow: hidden;
}

.photo-label {
  margin-top: 8px;
  font-size: 12px;
  color: #909399;
  text-align: center;
}

.image-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #c0c4cc;
  background-color: #f5f7fa;
}

.image-error span {
  margin-top: 5px;
  font-size: 12px;
}

/* Результаты анализа */
.result-section {
  margin-bottom: 20px;
}

.result-section h4 {
  color: #e6a23c;
  margin-bottom: 10px;
  font-size: 14px;
  font-weight: 600;
}

/* Открытка */
.postcard-section {
  margin-bottom: 20px;
}

.postcard-section h4 {
  color: #f56c6c;
  margin-bottom: 10px;
  font-size: 14px;
  font-weight: 600;
}

.postcard-image {
  max-width: 300px;
  height: auto;
  border-radius: 8px;
  border: 1px solid #e4e7ed;
}

/* Ошибки */
.error-section {
  margin-bottom: 20px;
}

.error-section h4 {
  color: #f56c6c;
  margin-bottom: 10px;
  font-size: 14px;
  font-weight: 600;
}

/* Метаинформация */
.analysis-meta {
  margin-top: 15px;
  padding-top: 15px;
  border-top: 1px solid #ebeef5;
}

/* Адаптивность */
@media (max-width: 768px) {
  .user-detail-container {
    padding: 10px;
  }

  .card-header {
    flex-direction: column;
    gap: 10px;
    align-items: stretch;
  }

  .actions {
    justify-content: center;
  }

  .photo-grid {
    grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
    gap: 10px;
  }

  .photo-thumbnail {
    width: 120px;
    height: 120px;
  }

  .postcard-image {
    max-width: 100%;
  }
}
</style>
