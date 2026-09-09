// 병렬/인터셉팅 라우트(모달), template, 리다이렉트
import { expect, test } from "@playwright/test";

test("목록에서 글을 클릭하면 모달로 열리고, 새로고침하면 전체 페이지가 된다", async ({ page }) => {
  await page.goto("/posts");
  // 앞선 테스트가 글을 남길 수 있으므로 특정 제목 대신 "목록의 첫 글" 을 쓴다
  const firstLink = page.locator("ul a[href^='/posts/']").first();
  const title = (await firstLink.locator("div > div").first().textContent())!.trim();
  await firstLink.click();

  // URL 은 상세로 바뀌지만, 화면은 목록 위에 모달
  await expect(page).toHaveURL(/\/posts\/\d+$/);
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText(title, { exact: true })).toBeVisible();
  // 목록이 그대로 뒤에 있다. 모달이 열리면 바깥 콘텐츠가 접근성 트리에서 숨겨지므로(inert) role 쿼리 대신 CSS 로 찾는다
  await expect(page.locator("h1", { hasText: "글 목록" })).toBeVisible();

  // ESC → router.back() → 모달 닫히고 목록 URL 로
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(page).toHaveURL(/\/posts$/);

  // 다시 열고 새로고침 → 인터셉트 없이 전체 페이지 (댓글 영역이 있는 진짜 상세)
  await page.locator("ul a[href^='/posts/']").first().click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.reload();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
  await expect(page.getByRole("heading", { name: /댓글/ })).toBeVisible();
});

test("모달의 '전체 페이지로 보기' 는 하드 내비게이션이라 원래 상세 페이지를 연다", async ({ page }) => {
  await page.goto("/posts");
  await page.getByRole("link", { name: /Suspense 스트리밍/ }).click();
  await page.getByRole("dialog").getByRole("link", { name: /전체 페이지로 보기/ }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("heading", { level: 1, name: "Suspense 스트리밍" })).toBeVisible();
});

test("template.tsx 는 (demos) 그룹 안에서 자식 세그먼트가 바뀔 때마다 다시 마운트된다", async ({ page }) => {
  await page.goto("/releases");
  const listTemplate = page.locator('[data-testid="demos-template"]', { has: page.locator("h1", { hasText: "Next.js 최신 릴리스" }) });
  await listTemplate.evaluate((el) => {
    (el as HTMLElement).dataset.marker = "first-mount"; // DOM 노드에 표식을 남긴다
  });

  await page.getByRole("link", { name: "무한 스크롤" }).click();
  await expect(page).toHaveURL(/\/feed$/);
  // 새로 마운트됐다면 새 DOM 노드라서 표식이 없다 (layout 의 nav 는 그대로 유지)
  const feedTemplate = page.locator('[data-testid="demos-template"]', { has: page.locator("h1", { hasText: "무한 스크롤" }) });
  await expect(feedTemplate).toBeVisible();
  await expect(feedTemplate).not.toHaveAttribute("data-marker", "first-mount");
  // 참고: Cache Components 는 이전 라우트를 <Activity mode="hidden"> 으로 DOM 에 남겨 둔다 (뒤로 가기 대비).
  // 그래서 표식이 남은 옛 노드가 "숨겨진 채" 존재할 수 있다. 보이는 것은 새 노드다.
  await expect(listTemplate).toBeHidden();
});

test("리다이렉트: next.config redirects (308/307) 와 permanentRedirect (308)", async ({ request }) => {
  const blog = await request.get("/blog/1", { maxRedirects: 0 });
  expect(blog.status()).toBe(308);
  expect(blog.headers()["location"]).toMatch(/\/posts\/1$/);

  const articles = await request.get("/articles?page=2", { maxRedirects: 0 });
  expect(articles.status()).toBe(308);
  expect(articles.headers()["location"]).toMatch(/\/posts\?page=2$/); // 쿼리스트링 유지

  const moved = await request.get("/posts/feed", { maxRedirects: 0 });
  expect(moved.status()).toBe(308);
  expect(moved.headers()["location"]).toMatch(/\/feed$/);

  const temp = await request.get("/latest", { maxRedirects: 0 });
  expect(temp.status()).toBe(307);

  const short = await request.get("/p/1", { maxRedirects: 0 });
  expect(short.status()).toBe(308);
  expect(short.headers()["location"]).toMatch(/\/posts\/1$/);

  const missing = await request.get("/p/9999");
  expect(missing.status()).toBe(404);
});

test("인터셉팅 라우트가 형제 정적 라우트를 가로채지 않는다 (데모 페이지를 /posts/* 밖으로 옮긴 이유)", async ({ page }) => {
  await page.goto("/posts");
  await page.getByRole("link", { name: "무한 스크롤" }).click();
  await expect(page).toHaveURL(/\/feed$/);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("heading", { level: 1, name: "무한 스크롤" })).toBeVisible();
});
