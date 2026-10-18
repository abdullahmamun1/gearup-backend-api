-- Phase 12: Bangla. The language of each user's interface and emails, and of
-- emails to newsletter subscribers and contact-form senders. Additive only;
-- everyone starts in English.

-- CreateEnum
CREATE TYPE "Locale" AS ENUM ('en', 'bn');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "locale" "Locale" NOT NULL DEFAULT 'en';

-- AlterTable
ALTER TABLE "subscribers" ADD COLUMN     "locale" "Locale" NOT NULL DEFAULT 'en';

-- AlterTable
ALTER TABLE "contact_messages" ADD COLUMN     "locale" "Locale" NOT NULL DEFAULT 'en';
