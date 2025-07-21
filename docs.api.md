# Admin API Documentation

Complete REST API documentation for the Face Analysis Bot admin panel.

## Base URL

```
http://localhost:4001/admin
```

## Authentication

The API uses JWT (JSON Web Token) authentication. You must first authenticate to receive a token, then include it in subsequent requests.

### Admin Login

```http
POST /auth/login
```

**Request Body:**

```typescript
interface LoginDto {
  password: string;
}
```

**Example Request:**

```json
{
  "password": "your_admin_password"
}
```

**Response:**

```typescript
interface LoginResponse {
  access_token: string;
  expires_in: string;
}
```

**Example Response:**

```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expires_in": "24h"
}
```

### Using the Token

Include the JWT token in the Authorization header for all admin API requests:

```http
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Example with curl:**

```bash
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
     http://localhost:4001/admin/dashboard
```

### Token Expiration

Tokens expire based on the `JWT_EXPIRES_IN` environment variable (default: 24h). When a token expires, you'll receive a 401 Unauthorized response and need to login again.

---

## 📊 Dashboard

### Get Dashboard Statistics

Get comprehensive statistics for the admin dashboard.

```http
GET /dashboard
```

**Headers:**

```
Authorization: Bearer YOUR_JWT_TOKEN
```

**Response:**

```typescript
interface DashboardStats {
  totalUsers: number;
  activeUsers: number;
  bannedUsers: number;
  usersLast30Days: number;
  totalAnalyzes: number;
  completedAnalyzes: number;
  pendingAnalyzes: number;
  failedAnalyzes: number;
  analyzesLast30Days: number;
}
```

**Example Response:**

```json
{
  "totalUsers": 1250,
  "activeUsers": 1180,
  "bannedUsers": 70,
  "usersLast30Days": 145,
  "totalAnalyzes": 3420,
  "completedAnalyzes": 3200,
  "pendingAnalyzes": 45,
  "failedAnalyzes": 175,
  "analyzesLast30Days": 890
}
```

---

## 💳 Payment Webhook

### Handle Payment Webhook

Process payment notifications from the payment microservice.

```http
POST /user/webhook
```

**Headers:**

```
x-api-key: YOUR_API_KEY
Content-Type: application/json
```

**Request Body:**

```typescript
interface PaymentWebhookDto {
  paymentId: string;
  userId: string;
  status: 'PAID' | 'PENDING' | 'FAILED';
  amount: number;
  generationsAdded: number;
}
```

**Example Request:**

```json
{
  "paymentId": "pay_123456789",
  "userId": "123456789",
  "status": "PAID",
  "amount": 10.0,
  "generationsAdded": 5
}
```

**Response:**

```json
{
  "success": true,
  "message": "Payment processed successfully"
}
```

**Error Responses:**

- `401 Unauthorized` - Invalid API key
- `400 Bad Request` - Invalid data or user not found

---

## 👥 User Management

### Get Users List

Get paginated list of users with filtering and search capabilities.

```http
GET /users?page=1&limit=50&search=john&sortBy=createdAt&sortDirection=desc
```

**Headers:**

```
Authorization: Bearer YOUR_JWT_TOKEN
```

**Query Parameters:**

| Parameter       | Type            | Required | Default     | Description                               |
| --------------- | --------------- | -------- | ----------- | ----------------------------------------- |
| `page`          | number          | No       | 1           | Page number for pagination                |
| `limit`         | number          | No       | 50          | Number of items per page                  |
| `search`        | string          | No       | -           | Search by username, telegram ID, or email |
| `sortBy`        | string          | No       | 'createdAt' | Field to sort by                          |
| `sortDirection` | 'asc' \| 'desc' | No       | 'desc'      | Sort direction                            |
| `funnelAction`  | string          | No       | -           | Filter by user funnel action              |

**Response:**

```typescript
interface PaginatedUsers {
  users: UserWithStats[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface UserWithStats {
  id: string;
  telegramId: string;
  telegramUsername?: string;
  telegramChatId?: string;
  email?: string;
  analysisCredits: number;
  language: 'EN' | 'RU';
  referralCode: string;
  role: 'USER' | 'ADMIN';
  isBanned: boolean;
  banReason?: string;
  bannedAt?: string;
  isBotBlocked?: boolean;
  botBlockedAt?: string;
  isSubscribed?: boolean;
  freeGenerationsGranted?: boolean;
  funnelAction?:
    | 'BOT_JOINED'
    | 'WAITING_FIRST_PHOTO'
    | 'GOT_FIRST_AN'
    | 'INVITED_FRIEND_1'
    | 'INVITED_FRIENDS_3'
    | 'FIRST_PAID';
  createdAt: string;
  updatedAt: string;
  analyzesCount: number;
  referralsCount: number;
}
```

**Example Response:**

```json
{
  "users": [
    {
      "id": "cuid123456",
      "telegramId": "123456789",
      "telegramUsername": "john_doe",
      "telegramChatId": "123456789",
      "email": "john@example.com",
      "analysisCredits": 5,
      "language": "EN",
      "referralCode": "REF123456",
      "role": "USER",
      "isBanned": false,
      "banReason": null,
      "bannedAt": null,
      "isSubscribed": true,
      "freeGenerationsGranted": false,
      "funnelAction": "ANALYSIS_COMPLETED",
      "createdAt": "2024-01-15T10:30:00Z",
      "updatedAt": "2024-01-15T10:30:00Z",
      "analyzesCount": 12,
      "referralsCount": 3
    }
  ],
  "total": 1250,
  "page": 1,
  "limit": 50,
  "totalPages": 25
}
```

### Get User Details

Get detailed information about a specific user.

```http
GET /users/{id}
```

**Headers:**

```
Authorization: Bearer YOUR_JWT_TOKEN
```

**Path Parameters:**

| Parameter | Type   | Required | Description |
| --------- | ------ | -------- | ----------- |
| `id`      | string | Yes      | User ID     |

**Response:**

```typescript
interface UserDetails {
  id: string;
  telegramId: string;
  telegramUsername?: string;
  telegramChatId?: string;
  email?: string;
  analysisCredits: number;
  language: 'EN' | 'RU';
  referralCode: string;
  role: 'USER' | 'ADMIN';
  isBanned: boolean;
  banReason?: string;
  bannedAt?: string;
  botBlocked?: boolean;
  botBlockedAt?: string;
  isSubscribed?: boolean;
  freeGenerationsGranted?: boolean;
  funnelAction?:
    | 'START'
    | 'ONBOARDING_COMPLETE'
    | 'ANALYSIS_START'
    | 'ANALYSIS_COMPLETE'
    | 'SUBSCRIPTION_PURCHASE'
    | 'REFERRAL_INVITE'
    | 'BOT_JOINED'
    | 'WAITING_FIRST_PHOTO'
    | 'GOT_FIRST_AN'
    | 'INVITED_FRIEND_1'
    | 'INVITED_FRIENDS_3'
    | 'FIRST_PAID';
  createdAt: string;
  updatedAt: string;
  referrals: Array<{
    id: string;
    invitedUser: {
      id: string;
      telegramUsername?: string;
      createdAt: string;
    };
  }>;
  analyses: Array<{
    id: string;
    type: string;
    status: string;
    createdAt: string;
  }>;
}
```

### Update User

Update user information.

```http
PUT /users/{id}
```

**Headers:**

```
Authorization: Bearer YOUR_JWT_TOKEN
```

**Path Parameters:**

| Parameter | Type   | Required | Description |
| --------- | ------ | -------- | ----------- |
| `id`      | string | Yes      | User ID     |

**Request Body:**

```typescript
interface UpdateUserDto {
  telegramUsername?: string;
  telegramChatId?: string;
  email?: string;
  analysisCredits?: number;
  language?: 'EN' | 'RU';
  role?: 'USER' | 'ADMIN';
  isBanned?: boolean;
  banReason?: string;
  botBlocked?: boolean;
  botBlockedAt?: string | null;
  isSubscribed?: boolean;
  freeGenerationsGranted?: boolean;
  funnelAction?:
    | 'START'
    | 'ONBOARDING_COMPLETE'
    | 'ANALYSIS_START'
    | 'ANALYSIS_COMPLETE'
    | 'SUBSCRIPTION_PURCHASE'
    | 'REFERRAL_INVITE'
    | 'BOT_JOINED'
    | 'WAITING_FIRST_PHOTO'
    | 'GOT_FIRST_AN'
    | 'INVITED_FRIEND_1'
    | 'INVITED_FRIENDS_3'
    | 'FIRST_PAID';
}
```

**Example Request:**

```json
{
  "analysisCredits": 10,
  "language": "EN",
  "role": "USER",
  "isSubscribed": true,
  "funnelAction": "PAYMENT_MADE"
}
```

**Response:** Updated user object (same structure as User Details)

### Ban User

Ban a user with optional reason.

```http
POST /users/{id}/ban
```

**Headers:**

```
Authorization: Bearer YOUR_JWT_TOKEN
```

**Path Parameters:**

| Parameter | Type   | Required | Description |
| --------- | ------ | -------- | ----------- |
| `id`      | string | Yes      | User ID     |

**Request Body:**

```typescript
interface BanUserDto {
  reason?: string;
}
```

**Example Request:**

```json
{
  "reason": "Violation of terms of service"
}
```

**Response:**

```json
{
  "id": "cuid123456",
  "telegramId": "123456789",
  "isBanned": true,
  "banReason": "Violation of terms of service",
  "bannedAt": "2024-01-15T10:30:00Z"
}
```

### Unban User

Remove ban from a user.

```http
POST /users/{id}/unban
```

**Headers:**

```
Authorization: Bearer YOUR_JWT_TOKEN
```

**Path Parameters:**

| Parameter | Type   | Required | Description |
| --------- | ------ | -------- | ----------- |
| `id`      | string | Yes      | User ID     |

**Response:**

```json
{
  "id": "cuid123456",
  "telegramId": "123456789",
  "isBanned": false,
  "banReason": null,
  "bannedAt": null
}
```

### Add Credits to User

Add analysis credits to a user's account.

```http
POST /users/{id}/credits
```

**Headers:**

```
Authorization: Bearer YOUR_JWT_TOKEN
```

**Path Parameters:**

| Parameter | Type   | Required | Description |
| --------- | ------ | -------- | ----------- |
| `id`      | string | Yes      | User ID     |

**Request Body:**

```typescript
interface AddCreditsDto {
  amount: number; // Minimum: 1
}
```

**Example Request:**

```json
{
  "amount": 5
}
```

**Response:**

```json
{
  "id": "cuid123456",
  "analysisCredits": 15,
  "updatedAt": "2024-01-15T10:30:00Z"
}
```

### Get User Analyses

Get paginated list of analyses for a specific user.

```http
GET /users/{id}/analyzes?page=1&limit=10
```

**Headers:**

```
Authorization: Bearer YOUR_JWT_TOKEN
```

**Path Parameters:**

| Parameter | Type   | Required | Description |
| --------- | ------ | -------- | ----------- |
| `id`      | string | Yes      | User ID     |

**Query Parameters:**

| Parameter | Type   | Required | Default | Description    |
| --------- | ------ | -------- | ------- | -------------- |
| `page`    | number | No       | 1       | Page number    |
| `limit`   | number | No       | 10      | Items per page |

**Response:**

```typescript
interface PaginatedAnalyzes {
  analyses: AnalyzeWithUser[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
```

---

## 📈 Analysis Management

### Get All Analyses

Get paginated list of all analyses with advanced filtering.

```http
GET /analyzes?page=1&limit=20&search=portrait&status=COMPLETED&type=QUICK_PORTRAIT&userId=cuid123
```

**Headers:**

```
Authorization: Bearer YOUR_JWT_TOKEN
```

**Query Parameters:**

| Parameter       | Type             | Required | Default     | Description                           |
| --------------- | ---------------- | -------- | ----------- | ------------------------------------- |
| `page`          | number           | No       | 1           | Page number                           |
| `limit`         | number           | No       | 20          | Items per page                        |
| `search`        | string           | No       | -           | Search in analysis text and user info |
| `sortBy`        | string           | No       | 'createdAt' | Field to sort by                      |
| `sortDirection` | 'asc' \| 'desc'  | No       | 'desc'      | Sort direction                        |
| `status`        | ProcessingStatus | No       | -           | Filter by status                      |
| `type`          | AnalyzeType      | No       | -           | Filter by analysis type               |
| `userId`        | string           | No       | -           | Filter by user ID                     |

**Processing Status Values:**

- `PENDING` - Queued for processing
- `PROCESSING` - Currently being analyzed
- `COMPLETED` - Successfully completed
- `FAILED` - Analysis failed

**Analysis Type Values:**

- `DEFAULT` - Единственный поддерживаемый тип анализа

**Response:**

```typescript
interface PaginatedAnalyzes {
  analyses: AnalyzeWithUser[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface AnalyzeWithUser {
  id: string;
  userId: string;
  type: AnalyzeType;
  status: ProcessingStatus;
  inputPhotoUrl: string[];
  analysisResultText?: string;
  summaryText?: string;
  postcardImageUrl?: string;
  errorMessage?: string;
  cost: number;
  createdAt: string;
  updatedAt: string;
  user: {
    id: string;
    telegramUsername?: string;
    telegramId: string;
  };
}
```

**Example Response:**

```json
{
  "analyses": [
    {
      "id": "analyze123",
      "userId": "cuid123456",
      "type": "DEFAULT",
      "status": "COMPLETED",
      "inputPhotoUrl": ["https://example.com/photo1.jpg"],
      "analysisResultText": "Detailed analysis results...",
      "summaryText": "Summary of the analysis...",
      "postcardImageUrl": "https://example.com/postcard.jpg",
      "errorMessage": null,
      "cost": 1,
      "createdAt": "2024-01-15T10:30:00Z",
      "updatedAt": "2024-01-15T10:35:00Z",
      "user": {
        "id": "cuid123456",
        "telegramUsername": "john_doe",
        "telegramId": "123456789"
      }
    }
  ],
  "total": 3420,
  "page": 1,
  "limit": 20,
  "totalPages": 171
}
```

### Get Analysis Details

Get detailed information about a specific analysis.

```http
GET /analyzes/{id}
```

**Headers:**

```
Authorization: Bearer YOUR_JWT_TOKEN
```

**Path Parameters:**

| Parameter | Type   | Required | Description |
| --------- | ------ | -------- | ----------- |
| `id`      | string | Yes      | Analysis ID |

**Response:** Single `AnalyzeWithUser` object (same structure as in list response)

### Get System Statistics

Get system-wide statistics (same as dashboard).

```http
GET /stats
```

**Headers:**

```
Authorization: Bearer YOUR_JWT_TOKEN
```

**Response:** Same as `/dashboard` endpoint

---

## 📊 Analyze Statistics Management

_**DEPRECATED**: Эндпоинты статистики анализов удалены в v3, метрики больше не собираются._

---

## 💡 Offer Management

### Get All Offers

Get paginated list of all user suggestions with advanced filtering.

```http
GET /offers?page=1&limit=20&search=dark mode&status=PENDING&userId=cuid123
```

**Headers:**

```
Authorization: Bearer YOUR_JWT_TOKEN
```

**Query Parameters:**

| Parameter       | Type            | Required | Default     | Description                             |
| --------------- | --------------- | -------- | ----------- | --------------------------------------- |
| `page`          | number          | No       | 1           | Page number                             |
| `limit`         | number          | No       | 20          | Items per page                          |
| `search`        | string          | No       | -           | Search in offer text and admin response |
| `sortBy`        | string          | No       | 'createdAt' | Field to sort by                        |
| `sortDirection` | 'asc' \| 'desc' | No       | 'desc'      | Sort direction                          |
| `status`        | OfferStatus     | No       | -           | Filter by offer status                  |
| `userId`        | string          | No       | -           | Filter by user ID                       |

**Offer Status Values:**

- `PENDING` - Waiting for admin review
- `APPROVED` - Approved by admin
- `REJECTED` - Rejected by admin

**Response:**

```typescript
interface PaginatedOffersResponse {
  offers: OfferResponse[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface OfferResponse {
  id: string;
  title: string;
  description: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  adminResponse?: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
  user?: {
    id: string;
    telegramUsername?: string;
    telegramId: string;
  };
}
```

**Example Response:**

```json
{
  "offers": [
    {
      "id": "offer123",
      "title": "Добавить темную тему",
      "description": "Добавить темную тему в интерфейс бота для улучшения UX",
      "status": "PENDING",
      "adminResponse": null,
      "userId": "cuid123456",
      "createdAt": "2024-01-15T10:30:00Z",
      "updatedAt": "2024-01-15T10:30:00Z",
      "user": {
        "id": "cuid123456",
        "telegramUsername": "john_doe",
        "telegramId": "123456789"
      }
    }
  ],
  "total": 150,
  "page": 1,
  "limit": 20,
  "totalPages": 8
}
```

### Get Offer Details

Get detailed information about a specific offer.

```http
GET /offers/{id}
```

**Headers:**

```
Authorization: Bearer YOUR_JWT_TOKEN
```

**Path Parameters:**

| Parameter | Type   | Required | Description |
| --------- | ------ | -------- | ----------- |
| `id`      | string | Yes      | Offer ID    |

**Response:** Single `OfferResponse` object (same structure as in list response)

### Create New Offer

Create a new user suggestion.

```http
POST /offers
```

**Headers:**

```
Authorization: Bearer YOUR_JWT_TOKEN
```

**Request Body:**

```typescript
interface CreateOfferDto {
  title: string;
  description: string;
  userId: string;
}
```

**Example Request:**

```json
{
  "title": "Добавить темную тему",
  "description": "Добавить темную тему в интерфейс бота для улучшения UX",
  "userId": "cuid123456"
}
```

**Response:** Created `OfferResponse` object

### Update Offer

Update offer information (typically used for admin responses).

```http
PUT /offers/{id}
```

**Headers:**

```
Authorization: Bearer YOUR_JWT_TOKEN
```

**Path Parameters:**

| Parameter | Type   | Required | Description |
| --------- | ------ | -------- | ----------- |
| `id`      | string | Yes      | Offer ID    |

**Request Body:**

```typescript
interface UpdateOfferDto {
  status?: 'PENDING' | 'APPROVED' | 'REJECTED';
  adminResponse?: string;
}
```

**Example Request:**

```json
{
  "status": "APPROVED",
  "adminResponse": "Great idea! We will implement this feature in the next update."
}
```

**Response:** Updated `OfferResponse` object

### Approve Offer

Approve a user suggestion.

```http
POST /offers/{id}/approve
```

**Headers:**

```
Authorization: Bearer YOUR_JWT_TOKEN
```

**Path Parameters:**

| Parameter | Type   | Required | Description |
| --------- | ------ | -------- | ----------- |
| `id`      | string | Yes      | Offer ID    |

**Request Body:**

```typescript
interface ApproveOfferDto {
  adminResponse?: string;
}
```

**Example Request:**

```json
{
  "adminResponse": "Excellent suggestion! We will prioritize this feature."
}
```

**Response:** Updated `OfferResponse` object with status set to `APPROVED`

### Reject Offer

Reject a user suggestion.

```http
POST /offers/{id}/reject
```

**Headers:**

```
Authorization: Bearer YOUR_JWT_TOKEN
```

**Path Parameters:**

| Parameter | Type   | Required | Description |
| --------- | ------ | -------- | ----------- |
| `id`      | string | Yes      | Offer ID    |

**Request Body:**

```typescript
interface RejectOfferDto {
  adminResponse?: string;
}
```

**Example Request:**

```json
{
  "adminResponse": "Thank you for the suggestion, but this is not feasible at the moment due to technical constraints."
}
```

**Response:** Updated `OfferResponse` object with status set to `REJECTED`

### Delete Offer

Delete an offer permanently.

```http
DELETE /offers/{id}
```

**Headers:**

```
Authorization: Bearer YOUR_JWT_TOKEN
```

**Path Parameters:**

| Parameter | Type   | Required | Description |
| --------- | ------ | -------- | ----------- |
| `id`      | string | Yes      | Offer ID    |

**Response:** 204 No Content

### Get Offer Statistics

Get comprehensive statistics about user offers.

```http
GET /offers/stats
```

**Headers:**

```
Authorization: Bearer YOUR_JWT_TOKEN
```

**Response:**

```typescript
interface OfferStats {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  last30Days: number;
}
```

**Example Response:**

```json
{
  "total": 150,
  "pending": 45,
  "approved": 85,
  "rejected": 20,
  "last30Days": 32
}
```

---

## 🎯 Prompt Management

Управление промптами для LLM сервисов (OpenAI и DeepSeek) через административную панель с поддержкой fallback на значения по умолчанию.

### Get All Prompts

Получить список всех промптов с пагинацией и фильтрацией.

```http
GET /admin/prompts?page=1&limit=20&provider=openai&search=analysis
```

**Headers:**

```
Authorization: Bearer YOUR_JWT_TOKEN
```

**Query Parameters:**

| Parameter  | Type   | Required | Default | Description                                    |
| ---------- | ------ | -------- | ------- | ---------------------------------------------- |
| `page`     | number | No       | 1       | Номер страницы для пагинации                   |
| `limit`    | number | No       | 20      | Количество элементов на странице               |
| `provider` | string | No       | -       | Фильтр по провайдеру ('openai' или 'deepseek') |
| `search`   | string | No       | -       | Поиск по содержимому или описанию промптов     |

**Response:**

```typescript
interface PaginatedPromptsResponse {
  prompts: PromptResponse[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface PromptResponse {
  key: string;
  content: string;
  description?: string;
  provider: string;
  source: 'database' | 'default';
  isActive: boolean;
  updatedAt?: Date;
}
```

**Example Response:**

```json
{
  "prompts": [
    {
      "key": "openai_main_analysis",
      "content": "Ты древний китайский физиогномист...",
      "description": "Основной промпт для анализа фотографий лица и ладони через физиогномику и хиромантию",
      "provider": "openai",
      "source": "default",
      "isActive": true
    },
    {
      "key": "deepseek_feelings_analysis",
      "content": "Проанализируй следующий текст...",
      "description": "Анализ текста о чувствах пользователя после просмотра результатов",
      "provider": "deepseek",
      "source": "database",
      "isActive": true,
      "updatedAt": "2024-01-15T10:30:00Z"
    }
  ],
  "total": 5,
  "page": 1,
  "limit": 20,
  "totalPages": 1
}
```

### Get Prompt by Key

Получить конкретный промпт по его ключу.

```http
GET /admin/prompts/{key}
```

**Headers:**

```
Authorization: Bearer YOUR_JWT_TOKEN
```

**Path Parameters:**

| Parameter | Type   | Required | Description                                     |
| --------- | ------ | -------- | ----------------------------------------------- |
| `key`     | string | Yes      | Ключ промпта (например, 'openai_main_analysis') |

**Response:**

```typescript
interface PromptResponse {
  key: string;
  content: string;
  description?: string;
  provider: string;
  source: 'database' | 'default';
  isActive: boolean;
  updatedAt?: Date;
}
```

**Example Response:**

```json
{
  "key": "openai_main_analysis",
  "content": "Ты древний китайский физиогномист познавший современную физиогномику...",
  "description": "Основной промпт для анализа фотографий лица и ладони",
  "provider": "openai",
  "source": "default",
  "isActive": true
}
```

### Update Prompt

Обновить содержимое промпта. Промпт сохраняется в базе данных и получает приоритет над значением по умолчанию.

```http
PUT /admin/prompts/{key}
```

**Headers:**

```
Authorization: Bearer YOUR_JWT_TOKEN
```

**Path Parameters:**

| Parameter | Type   | Required | Description  |
| --------- | ------ | -------- | ------------ |
| `key`     | string | Yes      | Ключ промпта |

**Request Body:**

```typescript
interface UpdatePromptDto {
  content: string;
  description?: string;
}
```

**Example Request:**

```json
{
  "content": "Обновленный промпт для анализа фотографий с новыми инструкциями...",
  "description": "Улучшенный промпт с дополнительными указаниями"
}
```

**Response:**

```typescript
interface PromptResponse {
  key: string;
  content: string;
  description?: string;
  provider: string;
  source: 'database';
  isActive: boolean;
  updatedAt: Date;
}
```

**Example Response:**

```json
{
  "key": "openai_main_analysis",
  "content": "Обновленный промпт для анализа фотографий с новыми инструкциями...",
  "description": "Улучшенный промпт с дополнительными указаниями",
  "provider": "openai",
  "source": "database",
  "isActive": true,
  "updatedAt": "2024-01-15T14:30:00Z"
}
```

### Available Prompt Keys

Система поддерживает следующие ключи промптов:

| Key                                | Provider | Description                                               |
| ---------------------------------- | -------- | --------------------------------------------------------- |
| `openai_main_analysis`             | openai   | Основной промпт для анализа фотографий через физиогномику |
| `openai_summary`                   | openai   | Промпт для создания краткого резюме анализа               |
| `deepseek_feelings_analysis`       | deepseek | Анализ текста о чувствах пользователя                     |
| `deepseek_block_hypothesis`        | deepseek | Создание блок-гипотезы на основе анализа                  |
| `deepseek_second_order_hypothesis` | deepseek | Создание альтернативной гипотезы второго порядка          |

### Prompt Sources

- **`database`**: Промпт сохранен в базе данных и имеет приоритет над значением по умолчанию
- **`default`**: Используется значение по умолчанию из констант приложения

### Validation Rules

- Содержимое промпта должно быть от 10 до 50,000 символов
- Описание не должно превышать 500 символов
- Ключ промпта должен существовать в системе
- Только активные промпты используются в производстве

---

## 🤖 Bot Messages Management

Управление сообщениями бота через административную панель с поддержкой fallback на локальные файлы и HTML разметки.

### Система приоритетов

Сообщения бота загружаются в следующем порядке приоритета:

1. **База данных** - если сообщение найдено в таблице `Prompt` → используется из БД
2. **Локальные файлы** - если нет в БД → используется из файлов `ru.json`/`en.json`
3. **Ключ** - если вообще ничего не найдено → возвращается сам ключ

### Integration with I18nService

Система интегрирована с `I18nService` через новые асинхронные методы:

```typescript
// Старый синхронный способ (только локальные файлы)
const message = this.i18nService.t('onboarding.welcomeMessage', locale);

// Новый асинхронный способ (БД + локальные файлы)
const message = await this.i18nService.tAsync('onboarding.welcomeMessage', locale);
```

### Get All Bot Messages

Получить список всех доступных сообщений бота с пагинацией и фильтрацией.

```http
GET /api/admin/bot-messages?page=1&limit=20&locale=ru&search=onboarding
```

**Headers:**

```
Authorization: Bearer YOUR_JWT_TOKEN
```

**Query Parameters:**

| Parameter | Type   | Required | Default | Description                              |
| --------- | ------ | -------- | ------- | ---------------------------------------- |
| `page`    | number | No       | 1       | Номер страницы для пагинации             |
| `limit`   | number | No       | 20      | Количество элементов на странице         |
| `locale`  | string | No       | -       | Фильтр по языку ('ru' или 'en')          |
| `search`  | string | No       | -       | Поиск по ключу или содержимому сообщений |

**Response:**

```typescript
interface PaginatedBotMessagesResponse {
  messages: BotMessageResponse[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface BotMessageResponse {
  key: string;
  locale: string;
  content: string;
  isHtml?: boolean;
  source: 'database' | 'locale';
  updatedAt?: Date;
}
```

**Example Response:**

```json
{
  "messages": [
    {
      "key": "onboarding.welcomeMessage",
      "locale": "ru",
      "content": "Добро пожаловать! Давайте начнем ваш путь к самопознанию...",
      "isHtml": true,
      "source": "database",
      "updatedAt": "2024-01-15T10:30:00Z"
    },
    {
      "key": "greeting.auto_registered",
      "locale": "ru",
      "content": "Привет, {name}! Готов узнать о себе что-то новое?",
      "isHtml": false,
      "source": "locale"
    }
  ],
  "total": 85,
  "page": 1,
  "limit": 20,
  "totalPages": 5
}
```

### Get Bot Message by Key and Locale

Получить конкретное сообщение бота по ключу и языку.

```http
GET /api/admin/bot-messages/{key}/{locale}
```

**Headers:**

```
Authorization: Bearer YOUR_JWT_TOKEN
```

**Path Parameters:**

| Parameter | Type   | Required | Description                                            |
| --------- | ------ | -------- | ------------------------------------------------------ |
| `key`     | string | Yes      | Ключ сообщения (например, 'onboarding.welcomeMessage') |
| `locale`  | string | Yes      | Язык сообщения ('ru' или 'en')                         |

**Response:**

```typescript
interface BotMessageResponse {
  key: string;
  locale: string;
  content: string;
  isHtml?: boolean;
  source: 'database' | 'locale';
  updatedAt?: Date;
}
```

**Example Response:**

```json
{
  "key": "onboarding.welcomeMessage",
  "locale": "ru",
  "content": "Добро пожаловать! <b>Давайте начнем</b> ваш путь к самопознанию...",
  "isHtml": true,
  "source": "database",
  "updatedAt": "2024-01-15T10:30:00Z"
}
```

### Update Bot Message

Обновить содержимое сообщения бота. Сообщение сохраняется в базе данных и получает приоритет над локальным файлом.

```http
PUT /api/admin/bot-messages/{key}/{locale}
```

**Headers:**

```
Authorization: Bearer YOUR_JWT_TOKEN
```

**Path Parameters:**

| Parameter | Type   | Required | Description                    |
| --------- | ------ | -------- | ------------------------------ |
| `key`     | string | Yes      | Ключ сообщения                 |
| `locale`  | string | Yes      | Язык сообщения ('ru' или 'en') |

**Request Body:**

```typescript
interface UpdateBotMessageDto {
  content: string;
  isHtml?: boolean;
}
```

**Example Request:**

```json
{
  "content": "Добро пожаловать! <b>Давайте начнем</b> ваш путь к <em>самопознанию</em>...",
  "isHtml": true
}
```

**Response:**

```typescript
interface BotMessageResponse {
  key: string;
  locale: string;
  content: string;
  isHtml?: boolean;
  source: 'database';
  updatedAt: Date;
}
```

**Example Response:**

```json
{
  "key": "onboarding.welcomeMessage",
  "locale": "ru",
  "content": "Добро пожаловать! <b>Давайте начнем</b> ваш путь к <em>самопознанию</em>...",
  "isHtml": true,
  "source": "database",
  "updatedAt": "2024-01-15T14:30:00Z"
}
```

### Create New Bot Message

Создать новое сообщение бота в базе данных.

```http
POST /api/admin/bot-messages
```

**Headers:**

```
Authorization: Bearer YOUR_JWT_TOKEN
```

**Request Body:**

```typescript
interface CreateBotMessageDto {
  key: string;
  locale: string;
  content: string;
  isHtml?: boolean;
}
```

**Example Request:**

```json
{
  "key": "custom.newFeatureAnnouncement",
  "locale": "ru",
  "content": "🎉 <b>Новая функция!</b> Теперь вы можете получать персональные рекомендации.",
  "isHtml": true
}
```

**Response:** Созданный объект `BotMessageResponse`

### Delete Bot Message

Удалить сообщение бота из базы данных. После удаления будет использоваться fallback из локального файла.

```http
DELETE /api/admin/bot-messages/{key}/{locale}
```

**Headers:**

```
Authorization: Bearer YOUR_JWT_TOKEN
```

**Path Parameters:**

| Parameter | Type   | Required | Description                    |
| --------- | ------ | -------- | ------------------------------ |
| `key`     | string | Yes      | Ключ сообщения                 |
| `locale`  | string | Yes      | Язык сообщения ('ru' или 'en') |

**Response:** 204 No Content

### Import Default Messages

Импортировать сообщения по умолчанию из локальных файлов в базу данных.

```http
POST /api/admin/bot-messages/import-defaults
```

**Headers:**

```
Authorization: Bearer YOUR_JWT_TOKEN
```

**Request Body:**

```typescript
interface ImportDefaultMessagesDto {
  locale?: string; // 'ru' или 'en', по умолчанию оба
  overwrite?: boolean; // Перезаписать существующие, по умолчанию false
  filter?: string; // Фильтр по префиксу ключа (например, 'onboarding.')
}
```

**Example Request:**

```json
{
  "locale": "ru",
  "overwrite": false,
  "filter": "onboarding."
}
```

**Response:**

```typescript
interface ImportResult {
  imported: number;
  skipped: number;
  failed: number;
  messages: Array<{
    key: string;
    locale: string;
    status: 'imported' | 'skipped' | 'failed';
    error?: string;
  }>;
}
```

**Example Response:**

```json
{
  "imported": 25,
  "skipped": 5,
  "failed": 0,
  "messages": [
    {
      "key": "onboarding.welcomeMessage",
      "locale": "ru",
      "status": "imported"
    },
    {
      "key": "onboarding.timerMessage",
      "locale": "ru",
      "status": "skipped"
    }
  ]
}
```

### HTML Support

Все сообщения бота поддерживают HTML разметку для богатого форматирования:

#### Поддерживаемые HTML теги

- `<b></b>` или `<strong></strong>` - жирный текст
- `<i></i>` или `<em></em>` - курсив
- `<u></u>` - подчеркивание
- `<s></s>` или `<del></del>` - зачеркивание
- `<code></code>` - моноширинный шрифт
- `<pre></pre>` - форматированный текст
- `<a href="URL"></a>` - ссылки
- `<blockquote></blockquote>` - цитаты

#### Пример с HTML разметкой

```json
{
  "content": "🎉 <b>Добро пожаловать!</b>\n\nТеперь вы можете:\n• <i>Анализировать фотографии</i>\n• <u>Получать персональные рекомендации</u>\n• <a href=\"https://example.com\">Читать наши статьи</a>\n\n<blockquote>Путь к самопознанию начинается здесь!</blockquote>",
  "isHtml": true
}
```

### Integration with Bot Handlers

Все существующие обработчики бота автоматически используют новую систему:

#### Методы интеграции

```typescript
// В OnboardingHandler
const welcomeMessage = await this.i18nService.tAsync('onboarding.welcomeMessage', locale);
await ctx.reply(welcomeMessage, { parse_mode: 'HTML' });

// В StartHandler
const greetingMessage = await this.i18nService.tAsync('greeting.auto_registered', locale, {
  name: user.telegramUsername || 'Друг',
});
await ctx.reply(greetingMessage, { parse_mode: 'HTML' });
```

#### Поддерживаемые ключи сообщений

Система поддерживает все ключи из локальных файлов:

| Категория       | Примеры ключей                                                                    |
| --------------- | --------------------------------------------------------------------------------- |
| **Приветствие** | `greeting.auto_registered`, `greeting.welcome_back`                               |
| **Онбординг**   | `onboarding.welcomeMessage`, `onboarding.timerMessage`, `onboarding.feelsMessage` |
| **Ошибки**      | `errors.general`, `errors.account_banned`, `errors.no_credits`                    |
| **Клавиатура**  | `keyboard.analysis`, `keyboard.balance`, `keyboard.help`                          |
| **Сцены**       | `scenes.analysis.send_photos`, `scenes.balance.info`                              |
| **Поддержка**   | `support.menu.title`, `support.help.info`                                         |

### Caching and Performance

- **Кэширование**: Сообщения кэшируются на 5 минут для повышения производительности
- **Fallback**: Быстрый fallback на локальные файлы при недоступности БД
- **Batch Loading**: Эффективная загрузка множественных сообщений одним запросом

### Validation Rules

- Ключ сообщения должен соответствовать паттерну: `^[a-zA-Z0-9._-]+$`
- Содержимое сообщения не должно превышать 4096 символов (лимит Telegram)
- HTML разметка валидируется на наличие поддерживаемых тегов
- Язык должен быть 'ru' или 'en'

---

## 🚨 Error Responses

All endpoints may return the following error responses:

### 400 Bad Request

```json
{
  "statusCode": 400,
  "message": "Validation failed",
  "error": "Bad Request"
}
```

### 401 Unauthorized

```json
{
  "statusCode": 401,
  "message": "Unauthorized",
  "error": "Unauthorized"
}
```

### 403 Forbidden

```json
{
  "statusCode": 403,
  "message": "Forbidden resource",
  "error": "Forbidden"
}
```

### 404 Not Found

```json
{
  "statusCode": 404,
  "message": "User not found",
  "error": "Not Found"
}
```

### 500 Internal Server Error

```json
{
  "statusCode": 500,
  "message": "Internal server error",
  "error": "Internal Server Error"
}
```

---

## 📝 Frontend Integration Examples

### React/TypeScript Example

```typescript
// API Client with JWT Authentication
class AdminApiClient {
  private baseUrl = 'http://localhost:4001';
  private token: string | null = null;

  async login(password: string): Promise<string> {
    const response = await fetch(`${this.baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });

    if (!response.ok) {
      throw new Error('Login failed');
    }

    const data = await response.json();
    this.token = data.access_token;
    return this.token;
  }

  private getAuthHeaders() {
    if (!this.token) {
      throw new Error('Not authenticated. Please login first.');
    }
    return {
      Authorization: `Bearer ${this.token}`,
      'Content-Type': 'application/json',
    };
  }

  async getUsers(params: GetUsersQueryDto): Promise<PaginatedUsers> {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        searchParams.append(key, String(value));
      }
    });

    const response = await fetch(`${this.baseUrl}/admin/users?${searchParams}`, {
      headers: this.getAuthHeaders(),
    });

    if (response.status === 401) {
      throw new Error('Token expired. Please login again.');
    }

    return response.json();
  }

  async banUser(userId: string, reason?: string): Promise<User> {
    const response = await fetch(`${this.baseUrl}/admin/users/${userId}/ban`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify({ reason }),
    });

    if (response.status === 401) {
      throw new Error('Token expired. Please login again.');
    }

    return response.json();
  }

  async addCredits(userId: string, amount: number): Promise<User> {
    const response = await fetch(`${this.baseUrl}/admin/users/${userId}/credits`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify({ amount }),
    });

    if (response.status === 401) {
      throw new Error('Token expired. Please login again.');
    }

    return response.json();
  }

  // Analyze Statistics Methods
  async getAnalyzeStatistics(params: GetAnalyzeStatisticsQueryDto): Promise<PaginatedAnalyzeStatistics> {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        searchParams.append(key, String(value));
      }
    });

    const response = await fetch(`${this.baseUrl}/admin/analyze-statistics?${searchParams}`, {
      headers: this.getAuthHeaders(),
    });

    if (response.status === 401) {
      throw new Error('Token expired. Please login again.');
    }

    return response.json();
  }

  async getAggregatedStatistics(params: {
    analyzeType?: AnalyzeType;
    dateFrom?: string;
    dateTo?: string;
  }): Promise<AnalyzeStatisticAggregated[]> {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        searchParams.append(key, String(value));
      }
    });

    const response = await fetch(`${this.baseUrl}/admin/analyze-statistics/aggregated?${searchParams}`, {
      headers: this.getAuthHeaders(),
    });

    if (response.status === 401) {
      throw new Error('Token expired. Please login again.');
    }

    return response.json();
  }

  async incrementStatistic(data: IncrementStatisticDto): Promise<AnalyzeStatisticResponse> {
    const response = await fetch(`${this.baseUrl}/admin/analyze-statistics/increment`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(data),
    });

    if (response.status === 401) {
      throw new Error('Token expired. Please login again.');
    }

    return response.json();
  }

  // Prompt Management Methods
  async getPrompts(params: GetPromptsQueryDto): Promise<PaginatedPromptsResponse> {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        searchParams.append(key, String(value));
      }
    });

    const response = await fetch(`${this.baseUrl}/admin/prompts?${searchParams}`, {
      headers: this.getAuthHeaders(),
    });

    if (response.status === 401) {
      throw new Error('Token expired. Please login again.');
    }

    return response.json();
  }

  async getPrompt(key: string): Promise<PromptResponse> {
    const response = await fetch(`${this.baseUrl}/admin/prompts/${key}`, {
      headers: this.getAuthHeaders(),
    });

    if (response.status === 401) {
      throw new Error('Token expired. Please login again.');
    }

    return response.json();
  }

  async updatePrompt(key: string, data: UpdatePromptDto): Promise<PromptResponse> {
    const response = await fetch(`${this.baseUrl}/admin/prompts/${key}`, {
      method: 'PUT',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(data),
    });

    if (response.status === 401) {
      throw new Error('Token expired. Please login again.');
    }

    return response.json();
  }
}

// Usage example
const apiClient = new AdminApiClient();

// Login first
await apiClient.login('your_admin_password');

// Then use authenticated endpoints
const users = await apiClient.getUsers({ page: 1, limit: 50 });

// Get analyze statistics with date filtering
const stats = await apiClient.getAnalyzeStatistics({
  page: 1,
  limit: 20,
  analyzeType: 'FAST_ANALYZE',
  dateFrom: '2024-01-01',
  dateTo: '2024-01-31',
});

// Get aggregated statistics for business insights
const aggregated = await apiClient.getAggregatedStatistics({
  analyzeType: 'FAST_ANALYZE',
  dateFrom: '2024-01-01',
  dateTo: '2024-01-31',
});

// Increment metrics (for bot integration)
await apiClient.incrementStatistic({
  analyzeType: 'FAST_ANALYZE',
  metric: 'selectClickCount',
});

// Get prompts with filtering
const prompts = await apiClient.getPrompts({
  page: 1,
  limit: 20,
  provider: 'openai',
  search: 'analysis',
});

// Get specific prompt
const prompt = await apiClient.getPrompt('openai_main_analysis');

// Update prompt content
await apiClient.updatePrompt('openai_main_analysis', {
  content: 'Новый улучшенный промпт для анализа...',
  description: 'Обновленное описание промпта',
});
```

### Vue.js Example

```typescript
// Composable with JWT Authentication
export function useAdminApi() {
  const baseUrl = 'http://localhost:4001';
  const token = ref<string | null>(null);

  const login = async (password: string) => {
    const { data } = await $fetch<{ access_token: string }>(`${baseUrl}/auth/login`, {
      method: 'POST',
      body: { password },
    });

    token.value = data.access_token;
    return token.value;
  };

  const getAuthHeaders = () => {
    if (!token.value) {
      throw new Error('Not authenticated. Please login first.');
    }
    return {
      Authorization: `Bearer ${token.value}`,
    };
  };

  const getUsers = async (params: GetUsersQueryDto) => {
    try {
      const { data } = await $fetch<PaginatedUsers>(`${baseUrl}/admin/users`, {
        query: params,
        headers: getAuthHeaders(),
      });
      return data;
    } catch (error) {
      if (error.status === 401) {
        token.value = null;
        throw new Error('Token expired. Please login again.');
      }
      throw error;
    }
  };

  const getDashboard = async () => {
    try {
      const { data } = await $fetch<DashboardStats>(`${baseUrl}/admin/dashboard`, {
        headers: getAuthHeaders(),
      });
      return data;
    } catch (error) {
      if (error.status === 401) {
        token.value = null;
        throw new Error('Token expired. Please login again.');
      }
      throw error;
    }
  };

  const getAnalyzeStatistics = async (params: GetAnalyzeStatisticsQueryDto) => {
    try {
      const { data } = await $fetch<PaginatedAnalyzeStatistics>(`${baseUrl}/admin/analyze-statistics`, {
        query: params,
        headers: getAuthHeaders(),
      });
      return data;
    } catch (error) {
      if (error.status === 401) {
        token.value = null;
        throw new Error('Token expired. Please login again.');
      }
      throw error;
    }
  };

  const getAggregatedStatistics = async (params: { analyzeType?: AnalyzeType; dateFrom?: string; dateTo?: string }) => {
    try {
      const { data } = await $fetch<AnalyzeStatisticAggregated[]>(`${baseUrl}/admin/analyze-statistics/aggregated`, {
        query: params,
        headers: getAuthHeaders(),
      });
      return data;
    } catch (error) {
      if (error.status === 401) {
        token.value = null;
        throw new Error('Token expired. Please login again.');
      }
      throw error;
    }
  };

  const getPrompts = async (params: GetPromptsQueryDto) => {
    try {
      const { data } = await $fetch<PaginatedPromptsResponse>(`${baseUrl}/admin/prompts`, {
        query: params,
        headers: getAuthHeaders(),
      });
      return data;
    } catch (error) {
      if (error.status === 401) {
        token.value = null;
        throw new Error('Token expired. Please login again.');
      }
      throw error;
    }
  };

  const getPrompt = async (key: string) => {
    try {
      const { data } = await $fetch<PromptResponse>(`${baseUrl}/admin/prompts/${key}`, {
        headers: getAuthHeaders(),
      });
      return data;
    } catch (error) {
      if (error.status === 401) {
        token.value = null;
        throw new Error('Token expired. Please login again.');
      }
      throw error;
    }
  };

  const updatePrompt = async (key: string, data: UpdatePromptDto) => {
    try {
      const response = await $fetch<PromptResponse>(`${baseUrl}/admin/prompts/${key}`, {
        method: 'PUT',
        body: data,
        headers: getAuthHeaders(),
      });
      return response;
    } catch (error) {
      if (error.status === 401) {
        token.value = null;
        throw new Error('Token expired. Please login again.');
      }
      throw error;
    }
  };

  return {
    login,
    getUsers,
    getDashboard,
    getAnalyzeStatistics,
    getAggregatedStatistics,
    getPrompts,
    getPrompt,
    updatePrompt,
    isAuthenticated: computed(() => !!token.value),
  };
}
```

---

## 📈 Business Intelligence with Analyze Statistics

The analyze statistics API provides powerful insights into user behavior and engagement patterns.

### Key Metrics Explained

| Metric               | Description                            | Business Value                                   |
| -------------------- | -------------------------------------- | ------------------------------------------------ |
| `selectClickCount`   | User clicks on analyze type selection  | Measures user interest in specific analyze types |
| `startAnalyzeCount`  | Successful analyze process starts      | Indicates actual engagement and photo uploads    |
| `aiChatRequestCount` | Requests to chat about analyze results | Shows satisfaction and engagement with results   |

### Conversion Rates

- **Conversion Rate** = `startAnalyzeCount` ÷ `selectClickCount`

  - Shows what percentage of interested users actually complete the analyze
  - Low rates might indicate UI/UX issues or technical problems

- **AI Engagement Rate** = `aiChatRequestCount` ÷ `startAnalyzeCount`
  - Shows what percentage of users want to discuss their results
  - High rates indicate quality analyze results and user satisfaction

### Dashboard Implementation Example

```typescript
// Get comprehensive statistics for dashboard
const getDashboardStats = async () => {
  const dateFrom = '2024-01-01';
  const dateTo = '2024-01-31';

  // Get all analyze types aggregated data
  const allStats = await apiClient.getAggregatedStatistics({
    dateFrom,
    dateTo,
  });

  // Calculate overall metrics
  const totalClicks = allStats.reduce((sum, stat) => sum + stat.totalSelectClicks, 0);
  const totalStarts = allStats.reduce((sum, stat) => sum + stat.totalStartAnalyze, 0);
  const totalChats = allStats.reduce((sum, stat) => sum + stat.totalAiChatRequests, 0);

  const overallConversionRate = totalStarts / totalClicks;
  const overallEngagementRate = totalChats / totalStarts;

  // Find top performing analyze types
  const topPerforming = allStats.sort((a, b) => b.totalStartAnalyze - a.totalStartAnalyze).slice(0, 5);

  // Find analyze types with low conversion rates (need attention)
  const needsAttention = allStats
    .filter((stat) => stat.conversionRate < 0.5)
    .sort((a, b) => a.conversionRate - b.conversionRate);

  return {
    overview: {
      totalClicks,
      totalStarts,
      totalChats,
      overallConversionRate,
      overallEngagementRate,
    },
    topPerforming,
    needsAttention,
  };
};
```

### Real-time Tracking Integration

For bot integration, use the increment endpoint to track user actions:

```typescript
// In your bot handlers
class AnalyzeStatisticTracker {
  constructor(private apiClient: AdminApiClient) {}

  async trackSelectClick(analyzeType: AnalyzeType) {
    await this.apiClient.incrementStatistic({
      analyzeType,
      metric: 'selectClickCount',
    });
  }

  async trackAnalyzeStart(analyzeType: AnalyzeType) {
    await this.apiClient.incrementStatistic({
      analyzeType,
      metric: 'startAnalyzeCount',
    });
  }

  async trackAiChatRequest(analyzeType: AnalyzeType) {
    await this.apiClient.incrementStatistic({
      analyzeType,
      metric: 'aiChatRequestCount',
    });
  }
}

// Usage in bot handlers
const tracker = new AnalyzeStatisticTracker(apiClient);

// When user selects an analyze type
await tracker.trackSelectClick('FAST_ANALYZE');

// When user uploads photo and starts analyze
await tracker.trackAnalyzeStart('FAST_ANALYZE');

// When user requests AI chat about results
await tracker.trackAiChatRequest('FAST_ANALYZE');
```

### Chart Data Preparation

```typescript
// Prepare data for charts in admin panel
const prepareChartData = async (analyzeType?: AnalyzeType) => {
  const stats = await apiClient.getAnalyzeStatistics({
    analyzeType,
    sortBy: 'date',
    sortDirection: 'asc',
    limit: 30, // Last 30 days
  });

  return {
    // Line chart data for trends
    lineChartData: {
      labels: stats.data.map((s) => s.date),
      datasets: [
        {
          label: 'Select Clicks',
          data: stats.data.map((s) => s.selectClickCount),
          borderColor: 'rgb(59, 130, 246)',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
        },
        {
          label: 'Analyze Starts',
          data: stats.data.map((s) => s.startAnalyzeCount),
          borderColor: 'rgb(16, 185, 129)',
          backgroundColor: 'rgba(16, 185, 129, 0.1)',
        },
        {
          label: 'AI Chat Requests',
          data: stats.data.map((s) => s.aiChatRequestCount),
          borderColor: 'rgb(245, 101, 101)',
          backgroundColor: 'rgba(245, 101, 101, 0.1)',
        },
      ],
    },

    // Bar chart data for conversion rates
    conversionRates: stats.data.map((s) => ({
      date: s.date,
      rate: s.startAnalyzeCount / s.selectClickCount || 0,
    })),
  };
};
```

---

## 🔄 Pagination Helper

All paginated endpoints follow the same structure. Here's a helper for handling pagination:

```typescript
interface PaginationParams {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: string;
  sortDirection?: 'asc' | 'desc';
}

interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

function buildPaginationQuery(params: PaginationParams): string {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      searchParams.append(key, String(value));
    }
  });

  return searchParams.toString();
}
```

---

## 📱 Mobile App Integration

For mobile applications, consider:

1. **Token Storage**: Store JWT tokens securely using device keychain/keystore
2. **Token Refresh**: Implement automatic token refresh before expiration
3. **Caching**: Implement local caching for dashboard statistics
4. **Pagination**: Use infinite scroll with smaller page sizes (10-20 items)
5. **Real-time Updates**: Consider WebSocket for real-time analysis status updates
6. **Offline Support**: Cache user lists for offline viewing

---

## 🛠️ Development Tools

### Postman Collection

Import this collection for easy API testing:

```json
{
  "info": {
    "name": "Face Bot Admin API",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "variable": [
    {
      "key": "baseUrl",
      "value": "http://localhost:4001"
    },
    {
      "key": "token",
      "value": ""
    }
  ],
  "auth": {
    "type": "bearer",
    "bearer": [
      {
        "key": "token",
        "value": "{{token}}",
        "type": "string"
      }
    ]
  }
}
```

### Swagger/OpenAPI

Access interactive API documentation at:

```
http://localhost:4001/api/docs
```

This provides a complete interface for testing all endpoints with automatic request/response validation.

---

## 🚀 Performance Considerations

1. **Authentication**: JWT tokens reduce server load compared to session-based auth
2. **Token Expiration**: Configure appropriate expiration times (24h recommended)
3. **Pagination**: Always use pagination for large datasets
4. **Filtering**: Use specific filters to reduce response size
5. **Caching**: Consider caching dashboard statistics (TTL: 5 minutes)
6. **Rate Limiting**: Implement rate limiting for production use

---

## 📋 Changelog

### v3.4.1

- **📸 Media Groups поддержка**: Исправлена обработка нескольких фотографий, отправленных одновременно в Telegram
- **🔄 Восстановление онбординга**: Исправлена проблема с восстановлением опроса с правильного шага после перезагрузки бота
- **🛡️ OnboardingMiddleware**: Включен middleware для корректной обработки кастомных ответов в опросе
- **🌐 Частичная локализация**: Перенесены критические сообщения об ошибках в систему i18n, сохранен контент опросов в коде для стабильности
- **🐛 Исправления**: Устранены проблемы с порядком сообщений при загрузке фото, корректная обработка текстовых ответов, правильное состояние при перезапуске

### v3.4.0

- **🤖 Система управления сообщениями бота**: Реализована полная система управления всеми сообщениями бота через админ панель
- **Новые API эндпоинты**: Добавлены 6 эндпоинтов для управления bot-messages (/api/admin/bot-messages)
- **BotMessageService**: Создан новый сервис с fallback логикой (БД → локальные файлы → ключ)
- **I18nService обновления**: Добавлены асинхронные методы `tAsync()` и `translateAsync()` с поддержкой БД
- **Интеграция с обработчиками**: Все существующие обработчики (StartHandler, OnboardingHandler) обновлены для использования новой системы
- **HTML поддержка**: Полная поддержка HTML разметки в сообщениях с валидацией тегов
- **Система приоритетов**: База данных имеет приоритет над локальными файлами
- **Админ панель**: Добавлен раздел "Сообщения бота" с поиском, фильтрацией и редактированием
- **Кэширование**: 5-минутное кэширование сообщений для повышения производительности
- **Fallback механизм**: Надежный fallback на локальные файлы при недоступности БД
- **Импорт утилита**: Возможность импорта существующих сообщений из locale файлов в БД
- **База данных**: Расширена модель Prompt полем `locale` с поддержкой композитного ключа `[key, locale]`

### v3.3.0

- **Кнопка пропуска таймера**: Добавлена кнопка "⚡ Поделиться результатом сейчас" для досрочного завершения 3-минутного ожидания
- **OnboardingHandler**: Реализован метод `handleSkipTimer()` для обработки пропуска таймера с корректным переходом к следующему этапу
- **Typing статус**: Создан утилитарный класс `TypingStatusUtil` для управления визуальным индикатором "печатает..."
- **Улучшенный UX**: Добавлен typing статус во время анализа ощущений, создания блок-гипотезы, обработки фото и генерации второй гипотезы
- **Перенос на OpenAI o3**: Блок-гипотезы теперь создаются через OpenAI o3 модель с Reasoning API вместо DeepSeek
- **OpenAI сервис**: Добавлены методы `createBlockHypothesis()` и `createSecondOrderHypothesis()` с настройкой `reasoning: { effort: 'medium' }`
- **Промпты для OpenAI**: Добавлены новые ключи `OPENAI_BLOCK_HYPOTHESIS` и `OPENAI_SECOND_ORDER_HYPOTHESIS` в систему промптов
- **BotModule**: Интегрирован OpenAIModule для поддержки новой функциональности создания гипотез
- **Улучшения таймера**: Исправлены проблемы с корректным удалением сообщений таймера при различных сценариях завершения
- **Локализация**: Добавлены ключи `skipTimerButton` и `skipTimerProcessing` на русском и английском языках для кнопки пропуска

### v3.2.0

- **Система бесплатных подписок**: Реализована централизованная система управления бесплатными подписками на месяц
- **UserService**: Добавлен метод `grantFreeSubscription()` с проверкой идемпотентности для предотвращения дублирования подписок
- **ReferralService**: Обновлена логика рефералов - при приглашении 7 друзей пользователь получает месяц подписки вместо кредитов
- **OnboardingHandler**: Исправлен метод `handleRepostCheck()` для корректного предоставления подписки за репост видео
- **AnalysisCheckMiddleware**: Добавлена проверка активной подписки для обхода списания кредитов при анализах
- **AnalyzeService**: Интегрирована логика пропуска списания кредитов для пользователей с активной подпиской
- **MarketingCronService**: Добавлена ежедневная cron-задача `expireSubscriptions()` для автоматического истечения подписок
- **BalanceHandler**: Обновлено отображение баланса с информацией об активной подписке и дате истечения
- **Локализация**: Добавлены новые ключи `repostAlreadyActivated`, `subscriptionGrantedMessage`, `infoWithSubscription` на русском и английском языках
- **Уведомления**: Обновлена система уведомлений для корректного отображения сообщений о предоставлении подписок

### v3.1.0

- **Система управления промптами**: Добавлена полная система управления промптами LLM сервисов
- **Новые эндпоинты**: GET /admin/prompts, GET /admin/prompts/:key, PUT /admin/prompts/:key
- **База данных**: Добавлена модель Prompt с полями key, content, description, provider, isActive
- **Fallback логика**: Приоритет базы данных над константами по умолчанию
- **Кэширование**: 5-минутный TTL для промптов с автоматической инвалидацией
- **Админ панель**: Vue.js интерфейс для редактирования промптов с поиском и фильтрацией
- **Интеграция**: OpenAI и DeepSeek сервисы интегрированы с PromptService

### v3.0.0

- **Упрощение архитектуры**: Удален тип анализа, теперь только DEFAULT
- **Обновление User модели**: Добавлены поля isBotBlocked/botBlockedAt
- **Обновление Offer модели**: Заменён text на title/description
- **Удаление статистики**: Эндпоинты analyze-statistics deprecated
- **Обновление funnelAction**: Расширен список действий воронки продаж

### v2.0.0

- **JWT Authentication**: Replaced basic auth with secure JWT tokens
- **Enhanced Security**: Role-based access control
- **Token Management**: Configurable expiration and refresh

### v1.0.0

- Initial API release
- User management endpoints
- Analysis management endpoints
- Dashboard statistics
- Comprehensive filtering and pagination

---

## 📱 Mini App API

Telegram Mini App API для расширенного онбординга пользователей с интерактивным веб-интерфейсом.

### Base URL для мини-приложения

```
http://localhost:4200/app
```

### Инициализация мини-приложения

Проверяет подпись Telegram и возвращает данные пользователя для отображения в мини-приложении.

```http
POST /api/mini-app/init
```

**Headers:**

```
Content-Type: application/json
```

**Request Body:**

```typescript
interface InitMiniAppDto {
  initData: string; // Telegram init data string с подписью
}
```

**Example Request:**

```json
{
  "initData": "query_id=AAHdF6IQAAAAAN0XohDhrOrc&user=%7B%22id%22%3A279058397..."
}
```

**Response:**

```typescript
interface MiniAppInitResponse {
  success: boolean;
  user: {
    id: string;
    telegramId: string;
    username?: string;
    language: 'EN' | 'RU';
    pipelineState: string;
  };
  analysis?: {
    id: string;
    type: string;
    status: string;
    analysisResultText?: string;
    createdAt: string;
  };
  userInfo?: {
    id: string;
    description?: string;
    feelings?: string;
    feelingsAnalysis?: string;
  };
}
```

**Example Response:**

```json
{
  "success": true,
  "user": {
    "id": "cuid123456",
    "telegramId": "123456789",
    "username": "john_doe",
    "language": "EN",
    "pipelineState": "MINI_APP_OPENED"
  },
  "analysis": {
    "id": "analyze123",
    "type": "DEFAULT",
    "status": "COMPLETED",
    "analysisResultText": "Detailed analysis results...",
    "createdAt": "2024-01-15T10:30:00Z"
  },
  "userInfo": {
    "id": "userinfo123",
    "description": "Analysis description from OpenAI Vision API",
    "feelings": null,
    "feelingsAnalysis": null
  }
}
```

**Error Responses:**

- `401 Unauthorized` - Неверная подпись Telegram
- `400 Bad Request` - Некорректные данные инициализации

### Отслеживание действий пользователя

Записывает действия пользователя в мини-приложении для аналитики и управления потоком онбординга.

```http
POST /api/mini-app/track
```

**Headers:**

```
Content-Type: application/json
```

**Request Body:**

```typescript
interface MiniAppDataDto {
  userId: string; // Telegram user ID
  action: 'opened' | 'closed' | 'button_clicked';
  buttonId?: string; // ID кнопки при action = 'button_clicked'
  timestamp: number; // Unix timestamp
}
```

**Example Request:**

```json
{
  "userId": "123456789",
  "action": "closed",
  "buttonId": "continue",
  "timestamp": 1705312200000
}
```

**Response:**

```json
{
  "success": true
}
```

### Статические файлы мини-приложения

Мини-приложение обслуживается как статические файлы по следующим маршрутам:

```http
GET /app                # Главная HTML страница
GET /app/styles.css     # CSS стили с поддержкой Telegram тем
GET /app/script.js      # JavaScript логика приложения
```

### Безопасность мини-приложения

#### Валидация подписи Telegram

Все запросы к API мини-приложения проверяют подпись Telegram через HMAC-SHA256:

1. Извлекается `hash` из `initData`
2. Создается строка для проверки из отсортированных параметров
3. Вычисляется HMAC-SHA256 с секретным ключом на основе bot token
4. Сравнивается с переданным hash

#### CORS настройки

Для production настроены ограничения CORS:

```typescript
// Разрешенные домены для мини-приложения
const corsOptions = {
  origin: ['https://web.telegram.org', 'https://telegram.org'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Telegram-Init-Data'],
};
```

### Интеграция с онбордингом

Мини-приложение интегрировано в единый пайплайн онбординга:

1. **Открытие**: Пользователь нажимает кнопку "Открыть результаты анализа" в боте
2. **Инициализация**: Мини-приложение вызывает `/api/mini-app/init` с Telegram данными
3. **Отображение**: Показываются результаты анализа фотографий из UserInfo
4. **Закрытие**: При нажатии "Продолжить" отправляется событие `closed`
5. **Продолжение**: Автоматически запускается следующий этап онбординга (создание гипотезы)

### Уведомления через очередь

При закрытии мини-приложения отправляется уведомление через Redis:

```typescript
interface MiniAppClosedNotification {
  type: 'mini_app_closed';
  userId: string;
  chatId: string;
  data: {
    userId: string;
    telegramUserId: string;
    nextAction: 'send_miniapp_finish';
  };
}
```

Это уведомление обрабатывается `NotificationHandlerService` и автоматически запускает `OnboardingHandler.handleMiniAppFinish()`.

### Frontend интеграция

#### JavaScript API

Мини-приложение использует Telegram Web App API:

```javascript
// Инициализация
const tg = window.Telegram.WebApp;
tg.ready();
tg.expand();

// Загрузка данных
const response = await fetch('/api/mini-app/init', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ initData: tg.initData }),
});

// Отслеживание действий
await fetch('/api/mini-app/track', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    userId: tg.initDataUnsafe.user?.id,
    action: 'closed',
    timestamp: Date.now(),
  }),
});

// Закрытие приложения
tg.close();
```

#### Поддержка тем Telegram

CSS использует переменные Telegram для автоматической адаптации к теме:

```css
body {
  background: var(--tg-theme-bg-color, #ffffff);
  color: var(--tg-theme-text-color, #000000);
}

.button {
  background: var(--tg-theme-button-color, #3390ec);
  color: var(--tg-theme-button-text-color, #ffffff);
}
```

### Мониторинг и аналитика

Все действия в мини-приложении логируются для аналитики:

- **Открытие**: Время загрузки и инициализации
- **Взаимодействие**: Нажатия кнопок и навигация
- **Закрытие**: Завершение сессии и переход к следующему этапу
- **Ошибки**: Проблемы с загрузкой или валидацией

### Архитектура файлов

```
src/core/modules/mini-app/
├── mini-app.module.ts        # NestJS модуль с зависимостями
├── mini-app.controller.ts    # API эндпоинты + статические файлы
├── mini-app.service.ts       # Бизнес-логика + уведомления
├── static/                   # Статические файлы приложения
│   ├── index.html           # HTML страница с Telegram интеграцией
│   ├── styles.css           # CSS с поддержкой тем Telegram
│   └── script.js            # JavaScript с API интеграцией
└── README.md                # Техническая документация
```

---

## 🔄 Система восстановления состояния онбординга

В версии 3.2.0 добавлена комплексная система восстановления состояния онбординга, которая позволяет пользователям продолжить процесс с того места, где они остановились.

### Принцип работы

Когда пользователь запускает бота командой `/start`, система:

1. **Проверяет текущее состояние** - анализирует поле `pipelineState` пользователя
2. **Восстанавливает контекст** - определяет, на каком этапе онбординга находится пользователь
3. **Воспроизводит состояние** - отправляет то же сообщение/интерфейс, что и до перезапуска
4. **Продолжает процесс** - пользователь может продолжить с того же места

### Поддерживаемые состояния

| Состояние             | Описание                   | Действие при восстановлении                               |
| --------------------- | -------------------------- | --------------------------------------------------------- |
| `WAITING_PHOTOS`      | Ожидание фотографий        | Повторная отправка запроса фото                           |
| `PHOTOS_RECEIVED`     | Анализ прерван/не завершён | Сброс состояния и повторный запрос фото                   |
| `ANALYSIS_COMPLETED`  | Анализ завершён            | Отправка сообщения с таймером                             |
| `TIMER_STARTED`       | Таймер активен             | Восстановление отображения таймера или переход к чувствам |
| `WAITING_FEELINGS`    | Ожидание описания чувств   | Повторная отправка запроса чувств                         |
| `FEELINGS_RECEIVED`   | Чувства получены           | Отправка триггерного сообщения                            |
| `MINI_APP_OPENED`     | Мини-приложение открыто    | Повторная отправка кнопки мини-приложения                 |
| `CREATING_HYPOTHESIS` | Создание гипотезы          | Сообщение о создании + продолжение процесса               |
| `HYPOTHESIS_SENT`     | Гипотеза отправлена        | Повторная отправка гипотезы с кнопками                    |
| `HYPOTHESIS_REJECTED` | Гипотеза отклонена         | Сообщение с кнопкой повтора                               |
| `FINAL_MESSAGE_SENT`  | Финальное сообщение        | Повторная отправка финального сообщения                   |
| `ONBOARDING_COMPLETE` | Онбординг завершён         | Сообщение о завершении                                    |

### Обработка таймеров

Система интеллектуально обрабатывает состояние таймеров:

- **Активный таймер** - восстанавливает отображение с текущим временем
- **Истёкший таймер** - автоматически завершает и переходит к следующему этапу
- **Отсутствующий таймер** - создаёт новый или переходит дальше

#### Улучшения работы таймера (v3.2.1)

- **Точный интервал обновления**: Таймер обновляется строго каждые 4.5 секунды
- **Автоматическое удаление**: Сообщение с таймером автоматически удаляется по завершению
- **Надёжная очистка**: Множественные механизмы удаления сообщения при разных сценариях:
  - При естественном окончании таймера в `startTimerUpdates`
  - При обнаружении истёкшего таймера в `resumeTimerState`
  - При переходе к следующему этапу в `sendFeelingsMessage`
- **Graceful error handling**: Ошибки удаления сообщений не блокируют процесс онбординга
- **Исправление состояния PHOTOS_RECEIVED**: При восстановлении состояния `PHOTOS_RECEIVED` (анализ прерван) система теперь сбрасывает состояние на `WAITING_PHOTOS` и запрашивает фото повторно, вместо показа сообщения "анализ в процессе"

### Защитный механизм (Middleware)

Добавлен middleware, который:

- **Фильтрует сообщения** - принимает только релевантные для текущего состояния
- **Предотвращает сбои** - блокирует случайные команды во время онбординга
- **Автоматически восстанавливает** - при любом взаимодействии проверяет состояние

### Новые локализационные ключи

Добавлены ключи для resume функциональности:

```json
{
  "onboarding": {
    "photoRequest": "Сделай фото своего лица и раскрытых ладоней...",
    "processingPhotos": "⏳ Обрабатываем твои фотографии...",
    "completed": "🎉 Твой онбординг завершён! Теперь ты можешь пользоваться всеми функциями бота."
  }
}
```

### Техническая реализация

#### Новые методы в OnboardingHandler

- `resumeOnboarding(ctx, user)` - основной метод восстановления состояния
- `resumeTimerState(ctx, userId)` - восстановление состояния таймера
- `isTimerExpired(timer)` - проверка истечения таймера
- `recreateTimerMessage(ctx, userId, timer)` - воссоздание сообщения таймера

#### Расширения TimerService

- `isTimerExpired(timer)` - утилита проверки истечения таймера
- `getTimerByUserId(userId)` - получение таймера включая истёкшие
- `cleanupExpiredTimer(userId)` - очистка истёкших таймеров

#### Улучшения в StartHandler

- Проверка `pipelineState` перед сбросом состояния
- Автоматический вызов `resumeOnboarding()` для активных пользователей
- Установка `WAITING_PHOTOS` только для новых/завершивших пользователей

### Обработка краевых случаев

- **Некорректные состояния** - безопасный fallback к началу онбординга
- **Отсутствующие данные** - попытка восстановления или переход к следующему этапу
- **Ошибки восстановления** - graceful degradation с базовыми сообщениями
- **Множественные сессии** - атомарные операции предотвращают конфликты

### Логирование и отладка

Все операции восстановления подробно логируются:

```
User 123 has active pipeline state: TIMER_STARTED, resuming onboarding
Timer message recreated for user 123
User 123 is in active onboarding state: WAITING_FEELINGS
```

Это обеспечивает простую диагностику проблем и мониторинг использования.

---
