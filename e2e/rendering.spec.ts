// 렌더링/캐싱/스트리밍처럼 "실제 서버 + 브라우저" 가 있어야 확인되는 것들.
// async 서버 컴포넌트는 단위 테스트 도구가 지원하지 않으므로 이런 것은 E2E 로 검증한다 (공식 문서 권장).
import { expect, test } from "@playwright/test";

test("홈과 할 일 목록이 렌더링된다", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Next.js Study App")).toBeVisible();

  await page.goto("/todos");
  await expect(page.getByText("Next.js App Router 구조 살펴보기")).toBeVisible();
});

test("글 목록은 캐시되어 새로고침해도 캐시 시각이 같다 (ISR)", async ({ page }) => {
  await page.goto("/posts");
  const first = await page.locator("time").first().getAttribute("datetime");
  await page.reload();
  const second = await page.locator("time").first().getAttribute("datetime");
  expect(first).toBeTruthy();
  expect(second).toBe(first);

  // updateTag 버튼을 누르면 즉시 새 캐시가 만들어진다
  await page.getByRole("button", { name: /즉시 갱신/ }).click();
  await expect.poll(async () => page.locator("time").first().getAttribute("datetime")).not.toBe(first);
});

test("글 상세: 본문은 즉시, '다른 글' 은 스트리밍으로 나중에 채워진다", async ({ page }) => {
  await page.goto("/posts/1");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Cache Components");
  // 지연된 영역이 스트리밍으로 도착 (1.5초 지연 + 여유)
  await expect(page.getByText("1.5초 지연 후 스트리밍된 영역")).toBeVisible({ timeout: 5000 });
});

test("없는 글은 not-found.tsx 를 보여 준다", async ({ page }) => {
  await page.goto("/posts/9999");
  await expect(page.getByText("글을 찾을 수 없습니다")).toBeVisible();
  await page.goto("/posts/abc");
  await expect(page.getByText("글을 찾을 수 없습니다")).toBeVisible();
});

test("error.tsx: 렌더 중 에러를 잡고 다시 시도로 복구한다", async ({ page }) => {
  await page.goto("/posts/1");
  await page.getByRole("button", { name: /에러 발생시키기/ }).click();
  await expect(page.getByText("문제가 발생했습니다")).toBeVisible();
  await page.getByRole("button", { name: "다시 시도" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Cache Components");
});

test("클라이언트 사이드 페칭: SWR 검색이 /api/posts 를 호출한다", async ({ page }) => {
  await page.goto("/client-fetch");
  const swrSection = page.locator("section", { hasText: "1. SWR" });
  const apiCall = page.waitForResponse((r) => r.url().includes("/api/posts?q=") && r.status() === 200);
  await swrSection.getByPlaceholder("제목이나 내용으로 검색").fill("스트리밍");
  await apiCall;
  await expect(swrSection.getByRole("link", { name: "Suspense 스트리밍" })).toBeVisible();
});

test("Route Handler: /api/posts 는 JSON 을 돌려준다", async ({ request }) => {
  const res = await request.get("/api/posts?q=Cache");
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  expect(body.posts.some((p: { title: string }) => p.title.includes("Cache Components"))).toBe(true);
});
