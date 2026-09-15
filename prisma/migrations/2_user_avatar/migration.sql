-- AlterTable: 사용자 아바타 (프로필 페이지). main 의 schema.ts 는 hasColumn 으로 같은 컬럼을 추가한다
ALTER TABLE "users" ADD COLUMN "avatar_path" TEXT;
