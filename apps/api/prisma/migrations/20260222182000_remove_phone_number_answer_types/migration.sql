-- Convert any existing NUMBER/PHONE blocks to TEXT before removing enum values
UPDATE "blocks" SET "answer_type" = 'TEXT' WHERE "answer_type" IN ('NUMBER', 'PHONE');

-- Remove enum values by recreating the type
ALTER TYPE "AnswerType" RENAME TO "AnswerType_old";
CREATE TYPE "AnswerType" AS ENUM ('TEXT', 'SINGLE_CHOICE', 'RATING');
ALTER TABLE "blocks" ALTER COLUMN "answer_type" TYPE "AnswerType" USING ("answer_type"::text::"AnswerType");
DROP TYPE "AnswerType_old";
