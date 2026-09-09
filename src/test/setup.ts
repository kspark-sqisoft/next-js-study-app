// 모든 테스트 파일이 실행되기 전에 한 번씩 실행된다 (vitest.config.mts 의 setupFiles).
// Vitest 는 테스트 파일마다 모듈을 새로 로드하므로, 여기서 정한 환경변수는 그 파일에만 적용된다.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll } from "vitest";

// 1. DB: 테스트 파일마다 별도의 임시 SQLite 파일을 쓴다. 개발용 data/app.db 는 절대 건드리지 않는다.
//    src/lib/db.ts 가 처음 import 될 때 이 값을 읽으므로, import 보다 먼저 설정되어야 한다.
const dbPath = path.join(os.tmpdir(), `next-study-test-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}.db`);
process.env.DATABASE_PATH = dbPath;

// 2. 세션 서명 키: 테스트용 고정 값. 실제 .env 값과 무관하다.
process.env.SESSION_SECRET = "test-secret-not-for-production";

afterAll(() => {
  for (const suffix of ["", "-wal", "-shm"]) {
    try { fs.rmSync(dbPath + suffix, { force: true }); } catch {}
  }
});

// 3. jest-dom: toBeInTheDocument(), toHaveValue() 같은 DOM 전용 matcher 를 expect 에 추가
import "@testing-library/jest-dom/vitest";

// 4. 테스트마다 렌더링한 DOM 을 정리한다. (Vitest 에서 globals 를 안 켜면 자동 정리가 되지 않는다)
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";
afterEach(() => cleanup());
