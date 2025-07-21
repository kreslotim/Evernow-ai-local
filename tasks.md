Проанализировал два репозитория:

Evernow-ai - основное приложение с Telegram ботом на NestJS:

Имеет базовую систему пользователей с analysisCredits и subscriptionActive

Есть PaymentService для HTTP-запросов к микросервису

Уже существует webhook endpoint /api/user/webhook для уведомлений о платежах

AnalysisCheckMiddleware проверяет кредиты перед анализом

Keyboard service пока закомментирован, нужно восстановить для UI

robokassa-payment-service - микросервис платежей на Fastify:

Полноценная система подписок с Robokassa

API для создания/управления подписками

Webhook'и для обработки платежей

notifyBotOfPayment уведомляет бот через HTTP

Основная задача - связать системы для оформления платных подписок в боте.

Approach
Интеграция будет происходить через расширение существующих сервисов в Evernow-ai для работы с подписками из robokassa-payment-service. Создам новые методы в PaymentService, обновлю middleware для проверки подписок, добавлю bot handlers для управления подписками и настрою синхронизацию данных через webhook'и. Подход минимизирует изменения в существующей архитектуре.

Mermaid Diagram

✅ Evernow-ai/src/bot/services/payment.service.ts

M

References
Расширить PaymentService для работы с подписками:

Добавить методы для работы с подписками:

createSubscription(userId: string, username: string, planId: string) - создание подписки

getSubscriptionStatus(userId: string) - получение статуса подписки

cancelSubscription(subscriptionId: string, userId: string) - отмена подписки

pauseSubscription(subscriptionId: string, userId: string) - приостановка подписки

resumeSubscription(subscriptionId: string, userId: string) - возобновление подписки

getSubscriptionPlans(botName: string) - получение доступных планов

Добавить интерфейсы для подписок:

SubscriptionPlan - план подписки

Subscription - подписка пользователя

CreateSubscriptionResponse - ответ при создании подписки

Все методы должны использовать существующий httpClient с базовым URL и API ключом

Добавить обработку ошибок и логирование для каждого метода

✅ Evernow-ai/src/bot/services/subscription.service.ts

M

References
Обновить SubscriptionService для работы с платными подписками:

Переименовать существующий метод checkChannelSubscriptions в checkChannelSubscriptions (оставить как есть)

Добавить новый метод checkPaidSubscription(userId: string) который:

Вызывает PaymentService.getSubscriptionStatus(userId)

Проверяет активность подписки

Возвращает статус подписки и дату истечения

Добавить метод requiresSubscription(ctx: Context) который:

Проверяет платную подписку через checkPaidSubscription

Если подписка неактивна, показывает сообщение с кнопкой "Оформить подписку"

Возвращает boolean - можно ли продолжать

Обновить интерфейс SubscriptionResult для поддержки платных подписок

Добавить методы для получения информации о тарифных планах

✅ Evernow-ai/src/bot/middleware/analysis-check.middleware.ts

M

References
Обновить middleware для проверки платных подписок:

Добавить инъекцию SubscriptionService в конструктор

В методе getMiddleware() после получения пользователя добавить проверку платной подписки:

Вызвать subscriptionService.checkPaidSubscription(user.id)

Если подписка активна, установить ctx.canAnalyze = true и ctx.hasActiveSubscription = true

Если подписка неактивна, проверить кредиты как fallback

Обновить сообщение о недостатке кредитов:

Добавить кнопку "Оформить подписку" которая вызывает subscription_plans

Изменить текст сообщения для указания на возможность подписки

Сохранить существующие кнопки для покупки кредитов и рефералов

Добавить логирование для отслеживания проверок подписки

✅ Evernow-ai/src/bot/handlers/subscription.handler.ts

N

References
Создать новый handler для управления подписками:

Создать класс SubscriptionHandler с инъекциями:

PaymentService

SubscriptionService

UserService

I18nService

Logger

Реализовать методы:

handleSubscriptionPlans(ctx) - показать доступные тарифные планы

handleCreateSubscription(ctx, planId) - создать подписку и показать ссылку на оплату

handleSubscriptionStatus(ctx) - показать текущий статус подписки

handleCancelSubscription(ctx) - отменить подписку с подтверждением

handlePauseSubscription(ctx) - приостановить подписку

handleResumeSubscription(ctx) - возобновить подписку

Каждый метод должен:

Проверять права пользователя

Обрабатывать ошибки

Показывать соответствующие сообщения и кнопки

Логировать действия пользователя

Использовать i18n для всех сообщений

Добавить декоратор @Injectable()

✅ Evernow-ai/src/bot/bot.module.ts

M

References
Обновить BotModule для поддержки подписок:

Добавить SubscriptionHandler в providers

Добавить SubscriptionHandler в exports если необходимо

Убедиться что все зависимости (PaymentService, SubscriptionService) доступны

Обновить импорты для включения нового handler'а

✅ Evernow-ai/src/bot/services/bot.service.ts

M

References
Обновить BotService для обработки команд подписки:

Добавить инъекцию SubscriptionHandler в конструктор

В методе setupBot() добавить обработчики команд:

/subscription или /sub - показать статус подписки

/plans - показать тарифные планы

Callback query handlers для:

subscription_plans - показать планы

subscription_status - показать статус

create_subscription:planId - создать подписку

cancel_subscription - отменить подписку

pause_subscription - приостановить

resume_subscription - возобновить

Обновить обработку текстовых сообщений для кнопки "Подписка"

Добавить обработку ошибок для всех новых handlers

Логировать все действия пользователей с подписками

✅ Evernow-ai/src/core/modules/user/user.service.ts

M

References
Расширить UserService для работы с подписками:

Добавить методы для управления подписками:

activateSubscription(userId: string, subscriptionData: any) - активировать подписку

deactivateSubscription(userId: string) - деактивировать подписку

extendSubscription(userId: string, endDate: Date) - продлить подписку

updateSubscriptionStatus(userId: string, isActive: boolean, expiryDate?: Date) - обновить статус

Обновить метод для обработки платежных уведомлений:

Добавить поддержку подписочных платежей

Различать разовые платежи и подписки

Обновлять поля subscriptionActive и subscriptionExpiry

Добавить методы для проверки подписки:

hasActiveSubscription(userId: string) - проверка активности

getSubscriptionInfo(userId: string) - получение информации о подписке

Обновить логику начисления кредитов для подписчиков

Добавить логирование всех операций с подписками

✅ Evernow-ai/src/common/dtos/payment.dto.ts

M

References
Расширить PaymentWebhookDto для поддержки подписок:

Добавить опциональные поля для подписок:

subscriptionId?: string - ID подписки

subscriptionType?: string - тип подписки

subscriptionDays?: number - количество дней подписки

isRecurring?: boolean - является ли платеж рекуррентным

recurringToken?: string - токен для рекуррентных платежей

Создать новый DTO для уведомлений о подписках:

SubscriptionWebhookDto с полями:

subscriptionId, userId, status, planId

startDate, endDate, nextBillingDate

isActive, autoRenew

Добавить валидацию для новых полей

Обновить ApiProperty декораторы с примерами

Добавить enum для статусов подписки

✅ Evernow-ai/src/core/modules/user/user.controller.ts

M

References
Обновить UserController для обработки уведомлений о подписках:

Обновить метод handlePaymentWebhook для поддержки подписочных платежей:

Проверять поле isRecurring в webhookData

Если это подписочный платеж, вызывать userService.activateSubscription или extendSubscription

Обрабатывать поля subscriptionDays и subscriptionType

Добавить новый endpoint handleSubscriptionWebhook для уведомлений о статусе подписки:

POST /api/user/subscription-webhook

Принимать SubscriptionWebhookDto

Обновлять статус подписки пользователя

Отправлять уведомления пользователю о изменениях

Добавить валидацию API ключа для нового endpoint

Обновить Swagger документацию

Добавить обработку ошибок и логирование

✅ Evernow-ai/src/bot/i18n/locales/ru.json

M

References
Добавить переводы для функциональности подписок:

Добавить секцию "subscription" с переводами:

Названия кнопок: "Подписка", "Тарифные планы", "Мой статус", "Отменить", "Приостановить", "Возобновить"

Сообщения о статусе: "Подписка активна", "Подписка неактивна", "Подписка приостановлена"

Сообщения об ошибках: "Ошибка создания подписки", "Подписка не найдена"

Сообщения подтверждения: "Подписка успешно отменена", "Подписка приостановлена"

Описания планов и цен

Обновить секцию "keyboard" для новых кнопок

Добавить сообщения для процесса оплаты

Добавить тексты для уведомлений о платежах

Обеспечить консистентность с существующими переводами

✅ Evernow-ai/src/bot/i18n/locales/en.json

M

References
Добавить английские переводы для функциональности подписок:

Перевести все тексты из ru.json на английский язык

Добавить секцию "subscription" с английскими переводами

Обновить секцию "keyboard" для новых кнопок на английском

Добавить английские сообщения для процесса оплаты

Добавить английские тексты для уведомлений о платежах

Обеспечить соответствие структуры с русской версией

✅ Evernow-ai/.env.example

M

References
Добавить переменные окружения для интеграции с payment service:

Добавить переменные для подписок:

DEFAULT_SUBSCRIPTION_PLAN_ID= - ID плана подписки по умолчанию

SUBSCRIPTION_BOT_NAME=evernow_ai - имя бота в payment service

ENABLE_PAID_SUBSCRIPTIONS=true - включить платные подписки

Убедиться что существуют:

PAYMENT_SERVICE_API_URL= - URL микросервиса платежей

PAYMENT_SERVICE_API_KEY= - API ключ для доступа к микросервису

Добавить комментарии с описанием каждой переменной

Указать примеры значений для development и production

✅ Evernow-ai/src/core/modules/config/config.service.ts

M

References
Добавить методы для получения конфигурации подписок:

Добавить методы:

getDefaultSubscriptionPlanId(): string - получить ID плана по умолчанию

getSubscriptionBotName(): string - получить имя бота для payment service

isPaidSubscriptionsEnabled(): boolean - проверить включены ли платные подписки

Обновить существующие методы если необходимо:

Убедиться что getPaymentServiceApiUrl() и getPaymentServiceApiKey() работают корректно

Добавить валидацию для новых переменных окружения

Добавить значения по умолчанию где это уместно

Обновить JSDoc комментарии для новых методов

✅ robokassa-payment-service/src/utils/botNotify.utils.ts

M

References
Обновить функцию уведомления бота для поддержки подписок:

Обновить функцию notifyBotOfPayment для поддержки подписочных платежей:

Добавить проверку поля isRecurring в payment

Для рекуррентных платежей использовать endpoint /api/user/subscription-webhook

Для обычных платежей использовать существующий endpoint /api/user/webhook

Добавить новую функцию notifyBotOfSubscriptionChange:

Принимать данные о подписке (subscription, status change)

Отправлять уведомление на /api/user/subscription-webhook

Включать информацию о статусе, датах, плане

Обновить payload для подписочных уведомлений:

Добавить поля subscriptionId, subscriptionType, subscriptionDays

Добавить isRecurring, recurringToken

Улучшить обработку ошибок и логирование

Добавить retry логику для неуспешных уведомлений

✅ robokassa-payment-service/src/services/subscription.service.ts

M

References
Обновить subscription service для уведомления бота о изменениях подписки:

В функции createSubscription после создания подписки:

Вызывать notifyBotOfSubscriptionChange для уведомления о новой подписке

В функциях cancelSubscription, pauseSubscription, resumeSubscription:

Добавить вызовы notifyBotOfSubscriptionChange после изменения статуса

Передавать актуальную информацию о подписке

В функции processRecurringPayment при успешном платеже:

Обновить вызов notifyBotOfPayment для передачи информации о подписке

Убедиться что передаются поля isRecurring=true, subscriptionId, subscriptionDays

Добавить обработку ошибок уведомлений:

Логировать неуспешные уведомления

Не прерывать основной процесс при ошибках уведомления

Обновить импорты для новых функций уведомления

✅ robokassa-payment-service/.env.example

M

Add file or resource
Обновить переменные окружения для интеграции с ботом:

Убедиться что существуют переменные для уведомления бота:

Проверить наличие переменных для Bot записей в БД

Добавить примеры URL и API ключей для Evernow-ai бота

Добавить комментарии:

Объяснить как настроить интеграцию с ботом

Указать формат URL для webhook'ов

Добавить примеры для development и production

Проверить переменные Robokassa:

ROBOKASSA_LOGIN, ROBOKASSA_PASSWORD1, ROBOKASSA_PASSWORD2

APP_URL для success/fail страниц

✅ robokassa-payment-service/src/prisma/seed.ts

N

References
Создать seed скрипт для начальных данных:

Создать скрипт для заполнения начальными данными:

Создать Bot запись для "evernow_ai" с:

name: "evernow_ai"

apiUrl: URL бота из переменных окружения

apiKey: API ключ бота

Создать базовые SubscriptionPlan записи:

Месячный план (MONTHLY)

Квартальный план (QUARTERLY)

Годовой план (YEARLY)

Связать с ботом evernow_ai

Создать базовый Product для подписки:

name: "Evernow AI Subscription"

description: "Подписка на анализ фотографий"

Связать с ботом

Добавить проверки на существование записей перед созданием

Использовать переменные окружения для конфигурации

Добавить логирование процесса seed'а

Экспортировать main функцию для запуска

✅ robokassa-payment-service/package.json

M

References
Добавить скрипт для запуска seed'а:

Добавить в секцию scripts:

"seed": "ts-node src/prisma/seed.ts" - запуск seed скрипта

"db:seed": "npm run prisma:generate && npm run seed" - генерация клиента и seed

Убедиться что есть необходимые dev dependencies:

ts-node для запуска TypeScript файлов

Проверить версии prisma и @prisma/client

Добавить комментарий в README о том как запускать seed
