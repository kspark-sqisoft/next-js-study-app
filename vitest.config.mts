// Vitest 설정 (공식 문서의 "Manual Setup" 기준 + 이 프로젝트용 옵션 몇 가지)
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()], // JSX 변환
  resolve: {
    // tsconfig 의 "@/..." 경로 별칭을 테스트에서도 쓸 수 있게 (Vite 내장 기능.
    // 공식 문서는 vite-tsconfig-paths 플러그인을 쓰지만 최신 Vite 는 이 옵션으로 대체 가능)
    tsconfigPaths: true,
    alias: {
      // "server-only" 는 클라이언트 번들에서 import 되면 에러를 내는 패키지.
      // 테스트는 Node 에서 돌므로 빈 모듈로 바꿔치기한다.
      "server-only": path.resolve(import.meta.dirname, "src/test/server-only.ts"),
    },
  },
  test: {
    // 기본은 jsdom(컴포넌트 테스트용). DOM 이 필요 없는 파일은 맨 위에
    // `// @vitest-environment node` 주석으로 node 환경을 지정한다 (더 빠르고, jose 같은 Web Crypto 코드와 호환).
    environment: "jsdom",
    include: ["src/**/*.test.{ts,tsx}"], // e2e/ 는 Playwright 가 담당
    setupFiles: ["src/test/setup.ts"],
  },
});
