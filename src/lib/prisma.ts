// Prisma Client 싱글턴. main 브랜치의 src/lib/db.ts(node:sqlite 연결)를 대체한다.
//
// [main 과 비교]
// - db.ts:      new DatabaseSync(경로) 로 파일을 열고, ensureSchema() 로 테이블까지 만들었다.
// - prisma.ts:  new PrismaClient({ adapter }) 만 만든다. 테이블은 `npm run db:migrate` 가 미리 만들어 둔다.
//               연결 시점에 스키마를 만지지 않는 것이 ORM + 마이그레이션 방식의 기본 태도다.
//
// [Prisma 7 의 어댑터]
// Prisma 7 은 DB 드라이버를 직접 포함하지 않고 "어댑터" 로 받는다. SQLite 는 better-sqlite3 어댑터를 쓴다.
// (node:sqlite 는 아직 Prisma 어댑터가 없다. 그래서 이 브랜치에서는 better-sqlite3 네이티브 모듈이 설치된다)
//
// [싱글턴]
// 개발 모드 HMR 로 이 모듈이 다시 로드돼도 클라이언트가 중복 생성되지 않도록 globalThis 에 캐시한다 (db.ts 와 같은 이유).
// 서버 전용. 클라이언트 컴포넌트에서 import 하면 빌드 에러.
import "server-only";
import path from "node:path";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@/generated/prisma/client"; // `prisma generate` 가 만든 클라이언트 (git 에는 없음)

// 연결 문자열. Prisma 는 "file:경로" 형식(DATABASE_URL)을 쓴다.
// 없으면 main 브랜치와 같은 DATABASE_PATH 를 절대 경로로 바꿔 쓴다 → 같은 data/app.db 파일을 공유한다.
const url =
  process.env.DATABASE_URL ??
  `file:${path.resolve(/* turbopackIgnore: true */ process.cwd(), process.env.DATABASE_PATH ?? "data/app.db")}`;

function createPrismaClient() {
  const adapter = new PrismaBetterSqlite3({ url }); // 실제 SQLite 드라이버
  return new PrismaClient({ adapter }); // 쿼리 빌더 + 타입. 첫 쿼리 때 연결이 열린다 (lazy)
}

const globalForPrisma = globalThis as unknown as { __prisma?: PrismaClient };

// 이미 만들어진 클라이언트가 있으면 재사용, 없으면 새로 생성
export const prisma: PrismaClient = globalForPrisma.__prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.__prisma = prisma;
}
