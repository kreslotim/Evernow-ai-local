import { Language } from '@prisma/client';

export function mapLanguageCode(telegramLangCode?: string): Language {
  if (!telegramLangCode) return Language.RU;

  const langCode = telegramLangCode.toLowerCase();
  if (langCode.startsWith('en')) return Language.EN;
  if (langCode.startsWith('ru')) return Language.RU;

  // Default to Russian for unsupported languages
  return Language.RU;
}

export function getLocaleFromLanguage(language: Language): string {
  // return language === Language.EN ? 'en' : 'ru';
  return 'ru';
}
