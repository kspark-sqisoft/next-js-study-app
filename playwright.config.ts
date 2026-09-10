// Playwright E2E 설정.
// 공식 문서 권장대로 "프로덕션 빌드" 를 대상으로 테스트한다 (npm run build && npm run start).
// webServer 옵션이 서버를 직접 띄우고 준비될 때까지 기다린 뒤 테스트를 시작한다.
import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.E2E_PORT ?? 3100); // 개발 서버(3000)와 겹치지 않게. 다른 워크트리와 동시에 돌릴 때는 E2E_PORT 로 바꾼다
const E2E_DB = "data/e2e.db"; // 개발 DB(data/app.db)와 분리. git 에는 올라가지 않는다 (/data/*.db)
const E2E_DB_URL = `file:./${E2E_DB}`; // Prisma 는 DATABASE_URL 형식을 쓴다

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false, // 같은 DB 를 공유하므로 파일 간 순차 실행
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  timeout: 30_000,
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure", // 실패 시 npx playwright show-trace 로 재생 가능
  },
  projects: [
    {
      name: "chrome",
      // 시스템에 설치된 Chrome 을 사용 (브라우저 다운로드 불필요).
      // 없으면 `npx playwright install chromium` 후 channel 줄을 지우면 된다.
      use: { ...devices["Desktop Chrome"], channel: "chrome" },
    },
  ],
  webServer: {
    // 1) E2E 전용 DB 를 샘플 데이터로 초기화 → 2) 빌드 → 3) 프로덕션 서버 시작
    // E2E DB 파일을 지우고 → 마이그레이션 적용 → 시드 → 빌드 → 서버.
    // `prisma migrate reset` 대신 파일 삭제 + `migrate deploy` 를 쓴다. reset 은 파괴적 명령이라 Prisma 가
    // 자동화 도구(AI 에이전트 포함)에서 실행되면 확인을 요구하고, 테스트 파이프라인은 그런 확인 없이 돌아야 한다.
    command: `node -e "for (const f of ['${E2E_DB}','${E2E_DB}-journal']) require('fs').rmSync(f, { force: true })" && npm run db:migrate && npm run db:seed && npm run build && npm run start -- -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    env: { DATABASE_PATH: E2E_DB, DATABASE_URL: E2E_DB_URL },
    timeout: 240_000, // 빌드 시간 포함
    reuseExistingServer: false,
    stdout: "ignore",
    stderr: "pipe",
  },
});
