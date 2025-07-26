/**
 * Evernow Mini App - Core Logic with Luscher Test
 */
const isDevelopment =
  !window.location.href.includes('telegram.org') &&
  !window.location.href.includes('t.me') &&
  window.location.hostname === 'localhost';

class MiniAppManager {
  constructor() {
    this.userData = null;
    this.isPolling = false;
    this.pollInterval = null;
    this.maxRetries = 20; // ✅ Уменьшаем попытки для экономии ресурсов
    this.retryCount = 0;
    this.retryDelay = 3000; // ✅ Увеличиваем интервал с 2 до 3 секунд
    this.maxRetryDelay = 10000; // ✅ Максимальный интервал между запросами
    this.exponentialBackoff = true; // ✅ Экспоненциальное увеличение интервала
    this.isClosing = false; // Флаг для предотвращения дублирования действий при закрытии
    this.isLuscherTestActive = false; // ✅ НОВЫЙ ФЛАГ: Активен ли тест Люшера прямо сейчас
  }

  /**
   * Отправка диагностических логов на сервер
   */
  async logDiagnostic(level, action, message, metadata = {}) {
    try {
      const logData = {
        level,
        action,
        message,
        metadata: {
          ...metadata,
          timestamp: new Date().toISOString(),
          url: window.location.href,
          userAgent: navigator.userAgent,
        },
        userId: this.userData?.user?.id,
        telegramId: this.userData?.user?.telegramId,
      };

      await fetch('/api/mini-app/log', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(logData),
      });
    } catch (error) {
      // Fallback к console.log если отправка на сервер не удалась
      console.log(`[${level}] ${action}: ${message}`, metadata);
    }
  }

  async init() {
    try {
      await this.logDiagnostic('INFO', 'mini-app-init', 'Mini app initialization started');

      if (typeof window.Telegram === 'undefined' || !window.Telegram.WebApp) {
        await this.logDiagnostic('ERROR', 'telegram-api-missing', 'Telegram WebApp API not available');
        this.showError('Telegram WebApp API недоступен');
        return;
      }

      const tg = window.Telegram.WebApp;
      tg.ready();
      tg.expand();

      // Подписываемся на событие закрытия мини-аппа
      tg.onEvent('viewportChanged', (event) => {
        if (event.isStateStable && !tg.isExpanded) {
          // Мини-апп закрывается
          this.handleMiniAppClose();
        }
      });

      // Альтернативный способ отслеживания закрытия
      window.addEventListener('beforeunload', () => {
        this.handleMiniAppClose();
      });

      await this.logDiagnostic('DEBUG', 'telegram-init-data', 'Getting Telegram init data', {
        initData: tg.initData ? 'present' : 'missing',
        initDataLength: tg.initData?.length || 0,
      });

      if (!tg.initData) {
        await this.logDiagnostic('ERROR', 'init-data-missing', 'Telegram init data is missing');
        this.showError('Данные инициализации отсутствуют');
        return;
      }

      const response = await fetch('/api/mini-app/init', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          initData: tg.initData,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        await this.logDiagnostic('ERROR', 'init-request-failed', `Init request failed: ${response.status}`, {
          status: response.status,
          statusText: response.statusText,
          errorText,
        });
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      this.userData = await response.json();

      const titleResponse = await fetch(`/api/mini-app/loading-title/${this.userData.user.language.toLowerCase()}`);

      const { title, subtitle } = await titleResponse.json();

      const loadingTitleElement = document.getElementById('loading_title');
      const loadingSubtitleElement = document.getElementById('loading_subtitle');

      if (loadingSubtitleElement && loadingTitleElement) {
        loadingTitleElement.textContent = title;
        loadingSubtitleElement.textContent = subtitle;
      }

      const loadingElement = document.getElementById('loading');

      if (loadingElement) {
        loadingElement.style.display = 'flex';
      }

      await this.logDiagnostic('INFO', 'init-success', 'Mini app initialized successfully', {
        userId: this.userData.user?.id,
        telegramId: this.userData.user?.telegramId,
        hasHypothesis: !!this.userData.hypothesis,
        hasSocialCard: !!this.userData.socialCardUrl,
      });

      this.setupEventListeners();
      this.displayUserInfo();

      // ✅ ИСПРАВЛЕННАЯ ЛОГИКА: Проверяем, что показать: гипотезу или тест Люшера
      if (this.userData.hypothesis && this.userData.hypothesis.trim().length > 0) {
        // Если есть готовая гипотеза - показываем её
        await this.logDiagnostic('INFO', 'hypothesis-ready', 'Hypothesis found, displaying it');
        await this.displayHypothesis();
      } else if (this.userData.luscherTestCompleted && !this.isLuscherTestActive) {
        // ✅ ИСПРАВЛЕНИЕ: Если тест Люшера уже пройден И НЕ активен сейчас - запускаем поллинг
        await this.logDiagnostic('INFO', 'luscher-completed-polling', 'Luscher test completed, polling for hypothesis');
        await this.showAnalysisWaitingScreen();
        await this.startPollingForHypothesis();
      } else {
        // Если нет ни гипотезы, ни пройденного теста - показываем тест Люшера
        await this.logDiagnostic('INFO', 'showing-luscher-test', 'No hypothesis found, showing Luscher test');
        this.isLuscherTestActive = true; // ✅ ПОМЕЧАЕМ что тест активен
        await this.showLuscherTest();
      }

      // ВРЕМЕННО ЗАКОММЕНТИРОВАНО: Загрузка социальной карточки
      // if (this.userData.socialCardUrl) {
      //   await this.loadSocialImage();
      // } else {
      //   await this.logDiagnostic('WARN', 'social-card-missing', 'No social card URL found');
      // }
    } catch (error) {
      await this.logDiagnostic('ERROR', 'init-error', `Initialization failed: ${error.message}`, {
        error: error.message,
        stack: error.stack,
      });
      this.showError(`Ошибка инициализации: ${error.message}`);
    }
  }

  async loadSocialImage() {
    try {
      const socialCardUrl = this.userData.socialCardUrl;
      await this.logDiagnostic('DEBUG', 'social-image-load-start', 'Starting to load social image', {
        socialCardUrl,
        userId: this.userData.user?.id,
      });

      if (!socialCardUrl) {
        await this.logDiagnostic('WARN', 'social-image-no-url', 'No social card URL provided');
        return;
      }

      const userId = this.userData.user?.id;
      if (!userId) {
        await this.logDiagnostic('ERROR', 'social-image-no-user-id', 'No user ID available for image loading');
        return;
      }

      const url = `/api/mini-app/download-image/${userId}`;
      await this.logDiagnostic('DEBUG', 'social-image-url-constructed', 'Image URL constructed', { url });

      const socialImageElement = document.getElementById('social-image');
      if (!socialImageElement) {
        await this.logDiagnostic('ERROR', 'social-image-element-missing', 'Social image element not found in DOM');
        return;
      }

      // Устанавливаем обработчики событий для изображения
      socialImageElement.onload = async () => {
        await this.logDiagnostic('INFO', 'social-image-load-success', 'Social image loaded successfully', {
          url,
          naturalWidth: socialImageElement.naturalWidth,
          naturalHeight: socialImageElement.naturalHeight,
        });
        socialImageElement.style.display = 'block';
      };

      socialImageElement.onerror = async (error) => {
        await this.logDiagnostic('ERROR', 'social-image-load-error', 'Failed to load social image', {
          url,
          error: error.toString(),
        });
        socialImageElement.style.display = 'none';
      };

      // Устанавливаем src для загрузки изображения
      socialImageElement.src = url;
      await this.logDiagnostic('DEBUG', 'social-image-src-set', 'Image src attribute set', { url });
    } catch (error) {
      await this.logDiagnostic(
        'ERROR',
        'social-image-load-exception',
        `Exception loading social image: ${error.message}`,
        {
          error: error.message,
          stack: error.stack,
        },
      );
    }
  }

  setupEventListeners() {
    // Обработчик для кнопки "Поделиться"
    const shareBtn = document.getElementById('share-btn');
    if (shareBtn) {
      shareBtn.addEventListener('click', () => this.shareHypothesis());
    }

    // Обработчик для кнопки "Вернуться в бот"
    const returnBtn = document.getElementById('return-btn');
    if (returnBtn) {
      returnBtn.addEventListener('click', () => this.returnToBot());
    }

    // ВРЕМЕННО ЗАКОММЕНТИРОВАНО: Обработчик для кнопки "Скачать изображение"
    // const downloadBtn = document.getElementById('download-btn');
    // if (downloadBtn) {
    //   downloadBtn.addEventListener('click', () => this.downloadImage());
    // }

    // НЕ добавляем обработчик для copy-btn здесь, так как элемент может не существовать
    // Он будет добавлен в displayHypothesis()
  }

  /**
   * ✅ УЛУЧШЕННАЯ ВЕРСИЯ: Показывает тест Люшера
   */
  async showLuscherTest() {
    try {
      // ✅ ЗАЩИТА: Останавливаем поллинг если он был запущен
      if (this.isPolling) {
        await this.logDiagnostic('INFO', 'stopping-polling-for-luscher', 'Stopping polling to show Luscher test');
        this.stopPolling();
      }

      // ✅ ВАЖНО: Помечаем что тест Люшера теперь активен
      this.isLuscherTestActive = true;

      // Скрываем блок загрузки
      const loadingElement = document.getElementById('loading');
      if (loadingElement) {
        loadingElement.style.display = 'none';
      }

      // Показываем блок теста Люшера
      const luscherTestElement = document.getElementById('luscher-test');
      if (luscherTestElement) {
        luscherTestElement.style.display = 'block';
        await this.initializeLuscherTest();
      }

      await this.logDiagnostic('INFO', 'luscher-test-shown', 'Luscher test displayed');
    } catch (error) {
      await this.logDiagnostic('ERROR', 'show-luscher-error', `Error showing Luscher test: ${error.message}`, {
        error: error.message,
        stack: error.stack,
      });
    }
  }

  /**
   * Инициализирует тест Люшера с цветной палитрой
   */
  async initializeLuscherTest() {
    // Классические 8 цветов теста Люшера (как в оригинале)
    const luscherColors = [
      { id: 'blue', name: 'Синий', color: '#4C6DFF' },
      { id: 'green', name: 'Зеленый', color: '#2CBF8D' },
      { id: 'red', name: 'Красный', color: '#FF4F4F' },
      { id: 'yellow', name: 'Желтый', color: '#FFD633' },
      { id: 'violet', name: 'Фиолетовый', color: '#9461FF' },
      { id: 'brown', name: 'Коричневый', color: '#B68350' },
      { id: 'black', name: 'Черный', color: '#242424' },
      { id: 'grey', name: 'Серый', color: '#989898' },
    ];

    // Инициализируем состояние теста
    this.luscherState = {
      // round: 0, // Текущий круг (0 или 1)
      selections: [], // Выборы в каждом круге
      availableColors: this.shuffleArray([...luscherColors]), // Перемешанные цвета
      colors: luscherColors,
    };

    this.renderLuscherPalette();
    this.updateLuscherProgress();

    await this.logDiagnostic('INFO', 'luscher-test-initialized', 'Luscher test palette created with 8 colors');
  }

  /**
   * Перемешивает массив (алгоритм Фишера-Йетса)
   */
  shuffleArray(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  /**
   * Отрисовывает палитру цветов
   */
  renderLuscherPalette() {
    const paletteContainer = document.getElementById('palette');
    if (!paletteContainer) return;

    // Очищаем контейнер
    paletteContainer.innerHTML = '';

    // Создаем цветные элементы
    this.luscherState.availableColors.forEach((colorData) => {
      const colorChip = document.createElement('div');
      colorChip.className = 'color-chip';
      colorChip.style.backgroundColor = colorData.color;
      colorChip.dataset.colorId = colorData.id;
      colorChip.dataset.colorName = colorData.name;

      // Добавляем обработчик клика
      colorChip.addEventListener('click', (e) => this.handleColorClick(e.target));

      paletteContainer.appendChild(colorChip);
    });
  }

  /**
   * ✅ УЛУЧШЕННАЯ ВЕРСИЯ: Обновляет прогресс теста с улучшенным UI feedback
   * Добавлены визуальные индикаторы прогресса без запросов к серверу
   */
  updateLuscherProgress() {
    const progressElement = document.getElementById('progress');
    const titleElement = document.getElementById('luscher-title');
    const underTitleElement = document.getElementById('luscher-undertitle');
    const subtitleElement = document.getElementById('luscher-subtitle');

    if (!progressElement) return;

    const currentCount = this.luscherState.selections.length;
    const totalColors = 8;

    // Обновляем инструкции
    if (underTitleElement) {
      underTitleElement.textContent = `Выберите цвета от приятного к неприятному`;
    }

    // Обновляем прогресс с визуальными индикаторами
    if (subtitleElement) {
      const progressBar = `<div style="width: 100%; background: #f0f0f0; border-radius: 10px; height: 8px; margin: 5px 0;">
        <div style="width: ${(currentCount / totalColors) * 100}%; background: #4CAF50; border-radius: 10px; height: 100%; transition: width 0.3s ease;"></div>
      </div>`;

      subtitleElement.innerHTML = `${progressBar} Прогресс: ${currentCount}/${totalColors}.`;
    }

    // Добавляем пульсацию оставшимся цветам для лучшего UX
    const remainingColors = document.querySelectorAll('.color-chip:not(.disappearing)');
    remainingColors.forEach((chip, index) => {
      chip.style.animation = `pulse 2s ease-in-out ${index * 0.1}s infinite`;
    });
  }

  /**
   * ✅ ОПТИМИЗИРОВАННАЯ ВЕРСИЯ: Обрабатывает клик по цвету в тесте Люшера
   * Убраны диагностические логи для улучшения производительности
   */
  async handleColorClick(colorElement) {
    try {
      const colorId = colorElement.dataset.colorId;
      const colorName = colorElement.dataset.colorName;

      // Добавляем выбор в текущий круг
      this.luscherState.selections.push(colorId);

      // Удаляем цвет из доступных
      const colorIndex = this.luscherState.availableColors.findIndex((c) => c.id === colorId);
      if (colorIndex !== -1) {
        this.luscherState.availableColors.splice(colorIndex, 1);
      }

      // Добавляем класс для анимации исчезновения
      colorElement.classList.add('disappearing');

      // Удаляем элемент после завершения анимации
      setTimeout(() => {
        if (colorElement.parentNode) {
          colorElement.parentNode.removeChild(colorElement);
        }
      }, 400);

      // Обновляем прогресс
      this.updateLuscherProgress();

      if (this.luscherState.selections.length === 8) {
        setTimeout(() => {
          this.completeLuscherTest();
        }, 500);
      }
    } catch (error) {
      // Минимальное логирование только критических ошибок
      console.error('Error handling color click:', error);
    }
  }

  /**
   * ✅ ИСПРАВЛЕННАЯ ВЕРСИЯ: Завершает тест Люшера
   */
  async completeLuscherTest() {
    try {
      // ✅ ВАЖНО: Помечаем что тест Люшера больше не активен
      this.isLuscherTestActive = false;

      // Сохраняем результаты теста Люшера
      await this.saveLuscherResults();

      // Скрываем тест Люшера
      const luscherTestElement = document.getElementById('luscher-test');
      if (luscherTestElement) {
        luscherTestElement.style.display = 'none';
      }

      // Обновляем userData чтобы отметить что тест пройден
      this.userData.luscherTestCompleted = true;

      // Показываем экран ожидания анализа
      await this.showAnalysisWaitingScreen();

      // Проверяем, есть ли уже готовая гипотеза
      if (this.userData && this.userData.hypothesis && this.userData.hypothesis.trim().length > 0) {
        // Если гипотеза уже есть - показываем её
        await this.displayHypothesis();
      } else {
        // ✅ ЗАЩИТА: Запускаем поллинг только если он ещё не запущен
        if (!this.isPolling) {
          await this.startPollingForHypothesis();
        }
      }
    } catch (error) {
      // ✅ При ошибке тоже помечаем что тест не активен
      this.isLuscherTestActive = false;

      // Логируем критическую ошибку
      console.error('Error completing Luscher test:', error);
      await this.logDiagnostic('ERROR', 'luscher-completion-error', `Error completing Luscher test: ${error.message}`);

      // При ошибке все равно показываем экран ожидания и запускаем поллинг
      const luscherTestElement = document.getElementById('luscher-test');
      if (luscherTestElement) {
        luscherTestElement.style.display = 'none';
      }

      await this.showAnalysisWaitingScreen();

      // ✅ ЗАЩИТА: При ошибке тоже проверяем что поллинг не запущен
      if (!this.isPolling) {
        await this.startPollingForHypothesis();
      }
    }
  }

  /**
   * ✅ ОПТИМИЗИРОВАННАЯ ВЕРСИЯ: Сохраняет полные результаты теста Люшера одним запросом
   * Убраны избыточные диагностические логи
   */
  async saveLuscherResults() {
    try {
      const userId = this.userData?.user?.id;
      if (!userId) {
        console.warn('No user ID for saving Luscher results');
        return;
      }

      // Подготавливаем полные результаты теста
      const results = {
        firstRound: this.luscherState.selections,
        secondRound: [],
        timestamp: new Date().toISOString(),
        totalColors: this.luscherState.colors.length,
        completed: true,
      };

      // Отправляем результаты одним запросом
      const response = await fetch('/api/mini-app/save-luscher-result', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          result: results,
        }),
      });

      if (response.ok) {
        // Логируем только успешное завершение теста
        await this.logDiagnostic('INFO', 'luscher-test-completed', 'Luscher test completed successfully', {
          firstRoundSelections: results.firstRound.length,
          secondRoundSelections: results.secondRound.length,
          totalColors: results.totalColors,
        });
      } else {
        console.error('Failed to save Luscher results:', response.status);
        await this.logDiagnostic('ERROR', 'luscher-save-failed', `Failed to save Luscher results: ${response.status}`);
      }
    } catch (error) {
      console.error('Error saving Luscher results:', error);
      await this.logDiagnostic('ERROR', 'luscher-save-error', `Error saving Luscher results: ${error.message}`);
    }
  }

  /**
   * Показывает экран ожидания анализа
   */
  async showAnalysisWaitingScreen() {
    try {
      const loadingElement = document.getElementById('loading');

      if (loadingElement) {
        loadingElement.style.display = 'flex';
        const [videoResponse, titleResponse] = await Promise.all([
          fetch(`/api/mini-app/loading-video/${this.userData.user.language.toLowerCase()}`),
          fetch(`/api/mini-app/loading-title/${this.userData.user.language.toLowerCase()}`),
        ]);

        const videoLink = await videoResponse.text();
        const { title, subtitle } = await titleResponse.json();

        loadingElement.innerHTML = `
          <div>
            <p>${title}</p>
            <p style="font-size: 0.8rem; margin-top: 0.5rem; opacity: 0.8">${subtitle}</p>
          </div>
          <video src="${videoLink}" class="video liquid" id="video-loading" controls autoplay></video>
        `;
      }

      await this.logDiagnostic('INFO', 'analysis-waiting-shown', 'Analysis waiting screen displayed');
    } catch (error) {
      await this.logDiagnostic(
        'ERROR',
        'analysis-waiting-error',
        `Error showing analysis waiting screen: ${error.message}`,
        {
          error: error.message,
          stack: error.stack,
        },
      );
    }
  }

  displayUserInfo() {
    if (this.userData && this.userData.user) {
      const userNameElement = document.getElementById('user-name');
      if (userNameElement) {
        const displayName = this.userData.user.username || `User ${this.userData.user.telegramId}`;
        userNameElement.textContent = displayName;
      }
    }
  }

  async displayHypothesis() {
    const hypothesisContent = document.getElementById('hypothesis-content');
    const loadingElement = document.getElementById('loading');
    const reportTitle = document.getElementById('report-title');
    const reportSubtitle = document.getElementById('report-subtitle');

    console.log('test');
    const response = await fetch(`/api/mini-app/report-title/${this.userData.user.language?.toLowerCase()}`);

    const { title, subtitle } = await response.json();

    console.log(title, subtitle);

    if (hypothesisContent && this.userData.hypothesis) {
      // Показываем заголовки
      if (reportTitle) {
        reportTitle.textContent = title;
        reportTitle.style.display = 'block';
      }
      if (reportSubtitle) {
        reportSubtitle.textContent = subtitle;
        reportSubtitle.style.display = 'block';
      }

      // Разделяем гипотезу на абзацы
      const paragraphs = this.userData.hypothesis
        .replace(/\\n/g, '\n')
        .split('\n\n')
        .filter((p) => p.trim().length > 0);

      // Создаем карточки для каждого абзаца
      let cardsHTML = '';
      paragraphs.forEach((paragraph, index) => {
        const lines = paragraph.trim().split('\n');
        const title = lines[0]; // Первая строка - заголовок
        const content = lines.slice(1).join('\n').trim(); // Остальные строки - содержание

        // Обрабатываем bold форматирование в заголовке и содержимом
        const processedTitle = title
          .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
          .replace(/\*(.*?)\*/g, '<em>$1</em>');
        
        const processedContent = content 
          ? content
              .replace(/\n/g, '<br>')
              .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
              .replace(/\*(.*?)\*/g, '<em>$1</em>')
              // Специальная обработка для конкретных заголовков разделов
              .replace(/(Что отпустить с благодарностью, что взрастить)/g, '<strong>$1</strong>')
              .replace(/(Дорожная карта роста)/g, '<strong>$1</strong>')
              .replace(/(Итог)/g, '<strong>$1</strong>')
              .replace(/(Инсайты)/g, '<strong>$1</strong>')
          : '';

        cardsHTML += `
          <div class="hypothesis-item">
            <div class="card-title">${processedTitle}</div>
            ${processedContent ? `<div class="card-content">${processedContent}</div>` : ''}
          </div>
        `;
      });

      // Заполняем только область с текстом гипотезы, сохраняя кнопки
      const hypothesisTextElement = document.getElementById('hypothesis-text');
      if (hypothesisTextElement) {
        hypothesisTextElement.innerHTML = cardsHTML;
      }

      hypothesisContent.style.display = 'block';

      // Убеждаемся, что кнопки видны и работают
      console.log('Hypothesis displayed, checking buttons...');
      const returnBtn = document.getElementById('return-btn');
      const shareBtn = document.getElementById('share-btn');

      if (returnBtn) {
        console.log('✅ Return button found');
        returnBtn.style.display = 'inline-flex';
      } else {
        console.error('❌ Return button not found!');
      }

      if (shareBtn) {
        console.log('✅ Share button found');
        shareBtn.style.display = 'inline-flex';
      } else {
        console.error('❌ Share button not found!');
      }

      // ВРЕМЕННО ЗАКОММЕНТИРОВАНО: кнопка копирования
      // const copyBtn = document.getElementById('copy-btn');
      // if (copyBtn) {
      //   copyBtn.replaceWith(copyBtn.cloneNode(true));
      //   document.getElementById('copy-btn').addEventListener('click', () => this.copyHypothesisToClipboard());
      // }

      if (loadingElement) {
        loadingElement.style.display = 'none';
      }
    }
  }

  // async copyHypothesisToClipboard() {
  //   try {
  //     await this.logDiagnostic('INFO', 'copy-button-click', 'Copy button clicked');

  //     if (!this.userData || !this.userData.hypothesis) {
  //       await this.logDiagnostic('ERROR', 'copy-no-hypothesis', 'No hypothesis available to copy');
  //       this.showStatusMessage('Нет текста для копирования', 'error');
  //       return;
  //     }

  //     // Форматируем текст для копирования (убираем HTML теги)
  //     const textToCopy = this.userData.hypothesis
  //       .replace(/\\n/g, '\n')
  //       .replace(/<br\s*\/?>/gi, '\n')
  //       .replace(/<[^>]*>/g, '')
  //       .trim();

  //     await this.logDiagnostic('DEBUG', 'copy-text-prepared', 'Text prepared for copying', {
  //       originalLength: this.userData.hypothesis.length,
  //       formattedLength: textToCopy.length,
  //     });

  //     // Основной метод копирования
  //     if (navigator.clipboard && navigator.clipboard.writeText) {
  //       await navigator.clipboard.writeText(textToCopy);
  //       await this.logDiagnostic('INFO', 'copy-success-modern', 'Text copied using modern API');
  //       this.showStatusMessage('Текст скопирован!', 'success');
  //     } else {
  //       // Fallback для старых браузеров
  //       await this.logDiagnostic('DEBUG', 'copy-fallback-attempt', 'Using fallback copy method');

  //       const textArea = document.createElement('textarea');
  //       textArea.value = textToCopy;
  //       textArea.style.position = 'fixed';
  //       textArea.style.left = '-999999px';
  //       textArea.style.top = '-999999px';
  //       document.body.appendChild(textArea);
  //       textArea.focus();
  //       textArea.select();

  //       const successful = document.execCommand('copy');
  //       document.body.removeChild(textArea);

  //       if (successful) {
  //         await this.logDiagnostic('INFO', 'copy-success-fallback', 'Text copied using fallback method');
  //         this.showStatusMessage('Текст скопирован!', 'success');
  //       } else {
  //         await this.logDiagnostic('ERROR', 'copy-fallback-failed', 'Fallback copy method failed');
  //         this.showStatusMessage('Не удалось скопировать текст', 'error');
  //       }
  //     }
  //   } catch (error) {
  //     await this.logDiagnostic('ERROR', 'copy-error', `Copy failed: ${error.message}`, {
  //       error: error.message,
  //       stack: error.stack,
  //     });
  //     this.showStatusMessage('Ошибка копирования', 'error');
  //   }
  // }

  showStatusMessage(message, type = 'info') {
    const statusElement = document.getElementById('status-message');
    if (statusElement) {
      statusElement.textContent = message;
      statusElement.className = `status-message ${type}`;
      statusElement.style.display = 'block';

      setTimeout(() => {
        statusElement.style.display = 'none';
      }, 3000);
    }
  }

  // ✅ ОПТИМИЗИРОВАННАЯ и ЗАЩИЩЕННАЯ версия поллинга
  async startPollingForHypothesis() {
    if (this.isPolling) {
      await this.logDiagnostic('WARN', 'polling-already-active', 'Polling already active');
      return;
    }

    // ✅ ЗАЩИТА: Не запускаем поллинг если тест Люшера активен
    if (this.isLuscherTestActive) {
      await this.logDiagnostic('WARN', 'polling-blocked-luscher-active', 'Polling blocked: Luscher test is active');
      return;
    }

    this.isPolling = true;
    this.retryCount = 0;
    this.currentDelay = this.retryDelay; // Текущая задержка для backoff
    await this.logDiagnostic('INFO', 'polling-start', 'Started optimized polling for hypothesis');

    // Первый запрос выполняем сразу
    await this.pollForHypothesis();

    // Планируем следующий запрос
    this.scheduleNextPoll();
  }

  // ✅ НОВЫЙ МЕТОД: Планирование следующего запроса поллинга
  scheduleNextPoll() {
    if (!this.isPolling) return;

    // Вычисляем задержку с экспоненциальным backoff
    let delay = this.currentDelay;
    if (this.exponentialBackoff && this.retryCount > 3) {
      delay = Math.min(this.currentDelay * Math.pow(1.5, this.retryCount - 3), this.maxRetryDelay);
    }

    this.pollInterval = setTimeout(async () => {
      await this.pollForHypothesis();
      this.scheduleNextPoll(); // Планируем следующий запрос
    }, delay);
  }

  // ✅ ОПТИМИЗИРОВАННАЯ версия поллинга с кешированием и защитой
  async pollForHypothesis() {
    try {
      // ✅ ЗАЩИТА: Останавливаем поллинг если тест Люшера стал активен
      if (this.isLuscherTestActive) {
        await this.logDiagnostic(
          'INFO',
          'polling-stopped-luscher-active',
          'Polling stopped: Luscher test became active',
        );
        this.stopPolling();
        return;
      }

      this.retryCount++;

      // Логируем только каждый 3-й запрос для экономии ресурсов в production
      if (this.retryCount % 3 === 1 || process.env.NODE_ENV !== 'production') {
        await this.logDiagnostic('DEBUG', 'polling-attempt', `Polling attempt ${this.retryCount}/${this.maxRetries}`);
      }

      if (this.retryCount > this.maxRetries) {
        await this.logDiagnostic('ERROR', 'polling-max-retries', 'Maximum polling retries reached');
        this.stopPolling();
        this.showError('Превышено максимальное количество попыток получения гипотезы');
        return;
      }

      // ✅ Добавляем кеширование для предотвращения повторных запросов
      const cacheKey = `user-info-${this.userData.user.id}`;
      const now = Date.now();
      const cacheExpiry = 2000; // 2 секунды кеша

      // Проверяем кеш
      const cached = sessionStorage.getItem(cacheKey);
      if (cached) {
        const { data, timestamp } = JSON.parse(cached);
        if (now - timestamp < cacheExpiry) {
          // Используем кешированные данные
          if (data.hypothesis) {
            await this.logDiagnostic('INFO', 'polling-hypothesis-cached', 'Hypothesis found in cache');
            this.userData.hypothesis = data.hypothesis;
            this.stopPolling();
            await this.displayHypothesis();
            return;
          }
        }
      }

      const response = await fetch(`/api/mini-app/user-info/${this.userData.user.id}`);
      if (!response.ok) {
        await this.logDiagnostic('WARN', 'polling-request-failed', `Polling request failed: ${response.status}`);
        return;
      }

      const data = await response.json();

      if (data.isError) {
        this.stopPolling();
        return this.showError('Не удалось сгенерировать результат. Обратитесь в поддержку');
      }

      // Сохраняем в кеш
      try {
        sessionStorage.setItem(cacheKey, JSON.stringify({ data, timestamp: now }));
      } catch (e) {
        // Игнорируем ошибки кеширования
      }

      // Логируем результат только если есть изменения
      if (data.hypothesis || this.retryCount % 5 === 0) {
        await this.logDiagnostic('DEBUG', 'polling-response', 'Received polling response', {
          hasHypothesis: !!data.hypothesis,
          attempt: this.retryCount,
        });
      }

      if (data.hypothesis) {
        await this.logDiagnostic('INFO', 'polling-hypothesis-found', 'Hypothesis found via polling');
        this.userData.hypothesis = data.hypothesis;
        this.stopPolling();
        await this.displayHypothesis();
      }
    } catch (error) {
      await this.logDiagnostic('ERROR', 'polling-error', `Polling error: ${error.message}`, {
        attempt: this.retryCount,
        error: error.message,
      });
    }
  }

  // ✅ ОПТИМИЗИРОВАННАЯ версия остановки поллинга
  stopPolling() {
    if (this.pollInterval) {
      clearTimeout(this.pollInterval); // Изменено с clearInterval на clearTimeout
      this.pollInterval = null;
    }
    this.isPolling = false;
    this.retryCount = 0;
    this.currentDelay = this.retryDelay; // Сбрасываем задержку
  }

  async shareHypothesis() {
    try {
      await this.logDiagnostic('INFO', 'share-button-click', 'Share button clicked');

      if (!this.userData || !this.userData.hypothesis) {
        await this.logDiagnostic('ERROR', 'share-no-hypothesis', 'No hypothesis available to share');
        this.showError('Нет гипотезы для отправки');
        return;
      }

      const tg = window.Telegram.WebApp;
      if (!tg.initData) {
        await this.logDiagnostic('ERROR', 'share-no-init-data', 'No Telegram init data for sharing');
        this.showError('Данные Telegram недоступны');
        return;
      }

      const response = await fetch('/api/mini-app/share-hypothesis', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: this.userData.user.id,
          hypothesis: this.userData.hypothesis,
          initData: tg.initData,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        await this.logDiagnostic('ERROR', 'share-request-failed', `Share request failed: ${response.status}`, {
          status: response.status,
          errorText,
        });
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const result = await response.json();
      await this.logDiagnostic('INFO', 'share-success', 'Hypothesis shared successfully');
      this.showStatusMessage('Гипотеза отправлена в чат!', 'success');
    } catch (error) {
      await this.logDiagnostic('ERROR', 'share-error', `Share failed: ${error.message}`, {
        error: error.message,
        stack: error.stack,
      });
      this.showError(`Ошибка отправки: ${error.message}`);
    }
  }

  async downloadImage() {
    try {
      await this.logDiagnostic('INFO', 'download-button-click', 'Download button clicked');

      const userId = this.userData?.user?.id;
      if (!userId) {
        await this.logDiagnostic('ERROR', 'download-no-user-id', 'No user ID for download');
        this.showError('Не удалось определить пользователя');
        return;
      }

      const downloadUrl = `/api/mini-app/download-image/${userId}?download=true`;
      await this.logDiagnostic('DEBUG', 'download-url-created', 'Download URL created', { downloadUrl });

      // Создаем скрытую ссылку для скачивания
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `evernow_analysis_${Date.now()}.jpg`;
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      await this.logDiagnostic('INFO', 'download-initiated', 'Download initiated successfully');
      this.showStatusMessage('Скачивание началось', 'success');
    } catch (error) {
      await this.logDiagnostic('ERROR', 'download-error', `Download failed: ${error.message}`, {
        error: error.message,
        stack: error.stack,
      });
      this.showError(`Ошибка скачивания: ${error.message}`);
    }
  }

  async returnToBot() {
    try {
      // Предотвращаем дублирование если уже в процессе закрытия
      if (this.isClosing) {
        await this.logDiagnostic('WARN', 'return-button-already-closing', 'Return button clicked but already closing');
        return;
      }

      this.isClosing = true;
      await this.logDiagnostic('INFO', 'return-button-click', 'Return to bot button clicked');

      // Отправляем действие send_miniapp_finish и ждем ответа
      const response = await fetch('/api/mini-app/track', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: this.userData?.user?.id || 'unknown',
          action: 'send_miniapp_finish',
          timestamp: Date.now(),
        }),
      });

      if (!response.ok) {
        throw new Error(`Server responded with ${response.status}: ${response.statusText}`);
      }

      await this.logDiagnostic('INFO', 'hypothesis-creation-triggered', 'Hypothesis creation action sent successfully');

      // Небольшая задержка для обработки на сервере
      setTimeout(() => {
        // Закрываем мини-приложение
        if (window.Telegram && window.Telegram.WebApp) {
          window.Telegram.WebApp.close();
        }
      }, 500);
    } catch (error) {
      this.isClosing = false; // Сбрасываем флаг при ошибке
      await this.logDiagnostic('ERROR', 'return-error', `Return to bot failed: ${error.message}`, {
        error: error.message,
        stack: error.stack,
      });

      // Показываем ошибку пользователю
      this.showStatusMessage('Ошибка возврата в бот', 'error');
    }
  }

  showError(message) {
    const errorElement = document.getElementById('error');
    const waitElement = document.getElementById('loading');
    if (errorElement) {
      // errorElement.textContent = message;
      errorElement.style.display = 'flex';
      waitElement.style.display = 'none';
    }
  }

  async handleMiniAppClose() {
    try {
      // Если уже обрабатываем закрытие через кнопку, не дублируем действие
      if (this.isClosing) {
        await this.logDiagnostic(
          'INFO',
          'mini-app-closing-skip',
          'Mini app closing but action already triggered by button',
        );
        return;
      }

      await this.logDiagnostic('INFO', 'mini-app-closing', 'Mini app is closing, triggering hypothesis creation');

      // Отправляем событие о начале создания гипотезы
      await fetch('/api/mini-app/track', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: this.userData?.user?.id || 'unknown',
          action: 'send_miniapp_finish',
          timestamp: Date.now(),
        }),
      });

      await this.logDiagnostic(
        'INFO',
        'hypothesis-creation-triggered-on-close',
        'Hypothesis creation triggered on close',
      );
    } catch (error) {
      await this.logDiagnostic('ERROR', 'close-handler-error', `Error in close handler: ${error.message}`, {
        error: error.message,
        stack: error.stack,
      });
    }
  }
}

// Инициализируем приложение при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
  const app = new MiniAppManager();
  app.init();
});