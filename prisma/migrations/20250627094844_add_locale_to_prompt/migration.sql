/*
  Добавляем поле locale в модель Prompt для поддержки многоязычности
  
  Изменения:
  - Добавляется поле locale с дефолтным значением 'ru'
  - Удаляется уникальный индекс на поле key
  - Создается составной уникальный индекс на [key, locale]
  - Добавляется индекс на поле locale
  - Все существующие записи обновляются со значением locale = 'ru'
*/

-- Добавляем поле locale с дефолтным значением 'ru'
ALTER TABLE "Prompt" ADD COLUMN "locale" TEXT NOT NULL DEFAULT 'ru';

-- Обновляем все существующие записи, устанавливаем locale = 'ru'
UPDATE "Prompt" SET "locale" = 'ru' WHERE "locale" IS NULL;

-- Удаляем старый уникальный индекс на поле key
DROP INDEX "Prompt_key_key";

-- Создаем новый составной уникальный индекс на [key, locale]
CREATE UNIQUE INDEX "Prompt_key_locale_key" ON "Prompt"("key", "locale");

-- Создаем индекс на поле locale для быстрого поиска
CREATE INDEX "Prompt_locale_idx" ON "Prompt"("locale"); 