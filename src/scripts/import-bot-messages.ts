#!/usr/bin/env ts-node

import * as fs from 'fs';
import * as path from 'path';
import { PrismaClient } from '@prisma/client';

/**
 * Скрипт для импорта дефолтных сообщений бота из локалей в базу данных
 *
 * Использование:
 * npm run import:bot-messages
 *
 * Опции через переменные окружения:
 * LOCALE - импортировать только для указанного языка (ru|en)
 * OVERWRITE - перезаписать существующие кастомные сообщения (true|false)
 * DRY_RUN - только показать что будет сделано, без изменений в БД (true|false)
 */

const prisma = new PrismaClient();

// Конфигурация
const config = {
  locale: process.env.LOCALE as 'ru' | 'en' | undefined,
  overwrite: process.env.OVERWRITE === 'true',
  dryRun: process.env.DRY_RUN === 'true',
  verbose: process.env.VERBOSE === 'true',
};

// Пути к файлам локалей
const localesDir = path.join(__dirname, '../bot/i18n/locales');
const localeFiles = {
  ru: path.join(localesDir, 'ru.json'),
  en: path.join(localesDir, 'en.json'),
};

// Ключи сообщений, которые относятся к боту (не системные)
const botMessagePrefixes = [
  'greeting.',
  'onboarding.',
  'commands.',
  'keyboard.',
  'errors.',
  'scenes.balance.',
  'scenes.referral.',
  'support.',
  'notifications.',
  'analysis.',
  'timer.',
  'feelings.',
  'hypothesis.',
  'video.',
  'photo.',
];

interface LocaleData {
  [key: string]: any;
}

interface MessageToImport {
  key: string;
  locale: string;
  content: string;
  description: string;
}

/**
 * Загружает и парсит файл локали
 */
function loadLocaleFile(locale: 'ru' | 'en'): LocaleData | null {
  try {
    const filePath = localeFiles[locale];
    if (!fs.existsSync(filePath)) {
      console.warn(`⚠️  Файл локали ${filePath} не найден`);
      return null;
    }

    const content = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(content);

    if (config.verbose) {
      console.log(`✅ Загружен файл локали: ${filePath}`);
    }

    return data;
  } catch (error) {
    console.error(`❌ Ошибка загрузки файла локали ${locale}:`, error);
    return null;
  }
}

/**
 * Рекурсивно извлекает все ключи из объекта локали
 */
function flattenLocaleObject(obj: any, prefix: string = ''): Record<string, string> {
  const result: Record<string, string> = {};

  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;

    if (typeof value === 'string') {
      result[fullKey] = value;
    } else if (typeof value === 'object' && value !== null) {
      Object.assign(result, flattenLocaleObject(value, fullKey));
    }
  }

  return result;
}

/**
 * Проверяет, относится ли ключ к сообщениям бота
 */
function isBotMessageKey(key: string): boolean {
  return botMessagePrefixes.some((prefix) => key.startsWith(prefix));
}

/**
 * Генерирует описание для сообщения на основе ключа
 */
function generateDescription(key: string, locale: string): string {
  const parts = key.split('.');
  const section = parts[0];
  const subsection = parts[1];

  const descriptions: Record<string, string> = {
    greeting: `Приветственные сообщения (${locale.toUpperCase()})`,
    onboarding: `Сообщения онбординга (${locale.toUpperCase()})`,
    commands: `Команды бота (${locale.toUpperCase()})`,
    keyboard: `Кнопки клавиатуры (${locale.toUpperCase()})`,
    errors: `Сообщения об ошибках (${locale.toUpperCase()})`,
    scenes: `Сцены бота (${locale.toUpperCase()})`,
    support: `Сообщения поддержки (${locale.toUpperCase()})`,
    notifications: `Уведомления (${locale.toUpperCase()})`,
    analysis: `Сообщения анализа (${locale.toUpperCase()})`,
    timer: `Сообщения таймера (${locale.toUpperCase()})`,
    feelings: `Сообщения о чувствах (${locale.toUpperCase()})`,
    hypothesis: `Сообщения гипотез (${locale.toUpperCase()})`,
    video: `Сообщения видео (${locale.toUpperCase()})`,
    photo: `Сообщения фото (${locale.toUpperCase()})`,
  };

  if (subsection) {
    return `${descriptions[section] || section} - ${subsection}`;
  }

  return descriptions[section] || `Сообщение бота: ${key} (${locale.toUpperCase()})`;
}

/**
 * Извлекает сообщения бота из файла локали
 */
function extractBotMessages(locale: 'ru' | 'en'): MessageToImport[] {
  const localeData = loadLocaleFile(locale);
  if (!localeData) {
    return [];
  }

  const flattenedMessages = flattenLocaleObject(localeData);
  const botMessages: MessageToImport[] = [];

  for (const [key, content] of Object.entries(flattenedMessages)) {
    if (isBotMessageKey(key)) {
      botMessages.push({
        key,
        locale,
        content,
        description: generateDescription(key, locale),
      });
    }
  }

  return botMessages;
}

/**
 * Проверяет существование сообщения в базе данных
 */
async function messageExists(key: string, locale: string): Promise<boolean> {
  const existing = await prisma.prompt.findUnique({
    where: {
      key_locale: {
        key,
        locale,
      },
    },
  });

  return !!existing;
}

/**
 * Импортирует сообщение в базу данных
 */
async function importMessage(message: MessageToImport): Promise<boolean> {
  try {
    if (config.dryRun) {
      console.log(`🔍 [DRY RUN] Импорт: ${message.key}:${message.locale}`);
      return true;
    }

    const exists = await messageExists(message.key, message.locale);

    if (exists && !config.overwrite) {
      if (config.verbose) {
        console.log(`⏭️  Пропущено (уже существует): ${message.key}:${message.locale}`);
      }
      return false;
    }

    await prisma.prompt.upsert({
      where: {
        key_locale: {
          key: message.key,
          locale: message.locale,
        },
      },
      update: {
        content: message.content,
        description: message.description,
        isActive: true,
        updatedAt: new Date(),
      },
      create: {
        key: message.key,
        locale: message.locale,
        content: message.content,
        description: message.description,
        provider: 'BOT_MESSAGE',
        isActive: true,
      },
    });

    console.log(`✅ Импортировано: ${message.key}:${message.locale}`);
    return true;
  } catch (error) {
    console.error(`❌ Ошибка импорта ${message.key}:${message.locale}:`, error);
    return false;
  }
}

/**
 * Основная функция импорта
 */
async function main() {
  console.log('🚀 Запуск импорта сообщений бота из локалей в базу данных\n');

  // Показываем конфигурацию
  console.log('⚙️  Конфигурация:');
  console.log(`   Язык: ${config.locale || 'все языки'}`);
  console.log(`   Перезапись: ${config.overwrite ? 'да' : 'нет'}`);
  console.log(`   Тестовый запуск: ${config.dryRun ? 'да' : 'нет'}`);
  console.log(`   Подробный вывод: ${config.verbose ? 'да' : 'нет'}\n`);

  const locales: ('ru' | 'en')[] = config.locale ? [config.locale] : ['ru', 'en'];
  let totalImported = 0;
  let totalSkipped = 0;
  let totalErrors = 0;

  for (const locale of locales) {
    console.log(`📁 Обработка локали: ${locale.toUpperCase()}`);

    const messages = extractBotMessages(locale);
    console.log(`   Найдено сообщений: ${messages.length}`);

    if (messages.length === 0) {
      console.log(`   ⚠️  Сообщения не найдены для локали ${locale}\n`);
      continue;
    }

    let imported = 0;
    let skipped = 0;
    let errors = 0;

    for (const message of messages) {
      try {
        const wasImported = await importMessage(message);
        if (wasImported) {
          imported++;
        } else {
          skipped++;
        }
      } catch (error) {
        errors++;
        console.error(`   ❌ Ошибка обработки ${message.key}:`, error);
      }
    }

    console.log(`   📊 Результат для ${locale.toUpperCase()}:`);
    console.log(`      Импортировано: ${imported}`);
    console.log(`      Пропущено: ${skipped}`);
    console.log(`      Ошибок: ${errors}\n`);

    totalImported += imported;
    totalSkipped += skipped;
    totalErrors += errors;
  }

  // Итоговая статистика
  console.log('📈 Итоговая статистика:');
  console.log(`   Всего импортировано: ${totalImported}`);
  console.log(`   Всего пропущено: ${totalSkipped}`);
  console.log(`   Всего ошибок: ${totalErrors}`);

  if (config.dryRun) {
    console.log('\n🔍 Это был тестовый запуск. Для реального импорта уберите переменную DRY_RUN');
  } else if (totalImported > 0) {
    console.log('\n✅ Импорт успешно завершён!');
  } else {
    console.log('\n⚠️  Ничего не было импортировано');
  }
}

// Запуск скрипта
if (require.main === module) {
  main()
    .catch((error) => {
      console.error('💥 Критическая ошибка скрипта:', error);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}

export { main as importBotMessages };
