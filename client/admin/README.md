# Vue 3 + TypeScript + Vite

This template should help get you started developing with Vue 3 and TypeScript in Vite. The template uses Vue 3 `<script setup>` SFCs, check out the [script setup docs](https://v3.vuejs.org/api/sfc-script-setup.html#sfc-script-setup) to learn more.

Learn more about the recommended Project Setup and IDE Support in the [Vue Docs TypeScript Guide](https://vuejs.org/guide/typescript/overview.html#project-setup).

# Admin Panel

Administrative interface for managing the Telegram bot system with comprehensive tools for content management, user administration, and system monitoring.

## Features

### 🤖 Bot Messages Management 🆕

- **Real-time editing**: Edit all bot messages without code deployment
- **HTML support**: Rich text formatting with full HTML markup support
- **Multi-language**: Manage messages in Russian and English
- **Search & filter**: Quickly find messages by key or content
- **Import/Export**: Import messages from locale files to database
- **Live preview**: See how messages will appear in Telegram
- **✅ Actualized message keys**: Shows only messages actually used in bot handlers
- **🔄 Updated message list**: Removed legacy keys, added new onboarding and photo analysis messages

### 👥 User Management

- **User dashboard**: View all registered users with detailed profiles
- **Credit management**: Add/remove analysis credits
- **Ban/unban**: User moderation tools
- **Subscription tracking**: Monitor active subscriptions and referrals
- **✅ Enhanced user profiles**: Detailed view with survey answers, AI analysis, and hypothesis
- **🔄 Updated analysis structure**: Shows diagnostic survey (4 questions) + voice message, single block hypothesis from OpenAI

### 📊 Analytics & Monitoring

- **Dashboard statistics**: Real-time metrics and KPIs
- **Funnel analytics**: Track user conversion through onboarding
- **Analysis reports**: Monitor photo analysis success rates

### 🎯 Prompt Management

- **LLM prompts**: Manage OpenAI and DeepSeek prompts
- **Version control**: Track prompt changes and rollbacks
- **Provider switching**: Easy switching between AI providers

### 💡 Offer Management

- **User suggestions**: Review and respond to user feedback
- **Approval workflow**: Approve/reject feature requests
- **Communication**: Direct response to users through the system

## Quick Start

### Access URLs

- **Development**: http://localhost:5175/panel/
- **Production**: https://your-domain.com/panel/

### Authentication

The admin panel requires JWT authentication:

1. **Login endpoint**: `/api/auth/login`
2. **Provide admin password** (set in environment variables)
3. **Receive JWT token** valid for 24 hours
4. **All API requests** require `Authorization: Bearer <token>` header

### Navigation

- **Dashboard**: Overview statistics and metrics
- **Users**: User management and moderation
- **Analyzes**: Analysis monitoring and reports
- **🆕 Bot Messages**: Content management for all bot messages
- **Prompts**: AI prompt management for OpenAI/DeepSeek
- **Offers**: User suggestion and feedback management

### Bot Messages Management Guide 🆕

#### Accessing Bot Messages

1. Navigate to **"Сообщения бота"** in the sidebar
2. Use search bar to find specific messages
3. Filter by language (Russian/English)
4. Browse with pagination

#### Editing Messages

1. **Click message** to open edit dialog
2. **Edit content** with HTML support
3. **Preview changes** in real-time
4. **Save** - changes apply immediately to bot

#### HTML Formatting

Support for rich text formatting:

```html
<b>Bold text</b>
<i>Italic text</i>
<u>Underline</u>
<code>Monospace</code>
<a href="URL">Links</a>
<blockquote>Quotes</blockquote>
```

#### Import from Locale Files

1. Click **"Import from locale files"**
2. Select language (ru/en)
3. Choose to overwrite existing or skip
4. Monitor import progress and results

#### Message Priority System

Messages are loaded in this order:

1. **Database** (edited through admin panel)
2. **Locale files** (ru.json/en.json)
3. **Key fallback** (if nothing found)

## Railway Deployment

This project is configured for deployment on Railway with Nginx.

### Prerequisites

- [Railway CLI](https://docs.railway.app/develop/cli)
- Docker installed locally (for testing)

### Deployment Steps

1. **Login to Railway**

```bash
railway login
```

2. **Link to your Railway project**

```bash
railway link
```

3. **Set environment variables**

```bash
railway variables set VITE_API_URL=https://your-api-url.com/api
```

4. **Deploy to Railway**

```bash
railway up
```

The application will be deployed using the Dockerfile and Nginx configuration.

### Local Testing

To test the Docker build locally:

```bash
docker build -t admin-panel .
docker run -p 8080:80 admin-panel
```

Then visit `http://localhost:8080/admin/`

## Development

```bash
# Install dependencies
yarn install

# Start development server
yarn dev

# Build for production
yarn build
```
