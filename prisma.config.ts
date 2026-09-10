// Prisma CLI 설정 (Prisma 7). 스키마 위치, 마이그레이션 폴더, DB 연결 문자열.
// .env 의 DATABASE_URL 을 읽는다. Node 24 내장 loadEnvFile 로 .env 를 읽어 dotenv 패키지가 필요 없다.
import { defineConfig, env } from "prisma/config";

try {
  process.loadEnvFile(".env");
} catch {
  // .env 가 없으면 (CI 등) 환경변수만 쓴다
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts", // `prisma db seed` / `prisma migrate reset` 이 실행하는 시드 명령
  },
  datasource: { url: env("DATABASE_URL") },
});
