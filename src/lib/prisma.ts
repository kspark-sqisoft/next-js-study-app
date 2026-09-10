// Prisma Client 싱글턴. main 브랜치의 src/lib/db.ts(node:sqlite 연결)를 대체한다.
// - Prisma 7 은 DB 드라이버를 직접 포함하지 않고 "어댑터" 를 받는다. SQLite 는 better-sqlite3 어댑터를 쓴다.
// - 개발 모드 HMR 로 모듈이 다시 로드돼도 클라이언트가 중복 생성되지 않도록 globalThis 에 캐시 (db.ts 와 같은 이유).
// - 서버 전용. 클라이언트 컴포넌트에서 import 하면 빌드 에러.
import "server-only";
import path from "node:path";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@/generated/prisma/client";

// DATABASE_URL("file:./data/app.db") 이 있으면 그것을, 없으면 main 브랜치와 같은 DATABASE_PATH 를 쓴다.
const url =
  process.env.DATABASE_URL ??
  `file:${path.resolve(/* turbopackIgnore: true */ process.cwd(), process.env.DATABASE_PATH ?? "data/app.db")}`;

function createPrismaClient() {
  const adapter = new PrismaBetterSqlite3({ url });
  return new PrismaClient({ adapter });
}

const globalForPrisma = globalThis as unknown as { __prisma?: PrismaClient };

export const prisma: PrismaClient = globalForPrisma.__prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.__prisma = prisma;
}
