// searchParams 페이지네이션/검색, 이미지 업로드(next/image), next/dynamic, 외부 API + use()
import { expect, test, type Page } from "@playwright/test";

async function login(page: Page, email: string) {
  await page.goto("/login");
  const form = page.locator("form", { has: page.locator("#email") });
  await form.locator("#email").fill(email);
  await form.locator("#password").fill("password123");
  await form.getByRole("button", { name: "로그인" }).click();
  await page.waitForURL("/posts");
}

// 1x1 PNG (테스트용 최소 이미지)
const PNG_1x1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64",
);

test("searchParams: 검색어와 페이지가 URL 에 반영되고, 결과가 그에 맞게 바뀐다", async ({ page }) => {
  await page.goto("/posts");
  // 시드 6개 + 페이지 크기 5 → 2 페이지
  await expect(page.getByRole("navigation", { name: "페이지" })).toBeVisible();
  await page.getByRole("navigation", { name: "페이지" }).getByRole("button", { name: "2" }).click();
  await expect(page).toHaveURL(/\/posts\?page=2$/);
  await expect(page.getByText(/6건 중 6–6/)).toBeVisible();

  // 검색 (method=get 폼 → ?q=)
  const search = page.locator("form[method=get]");
  await search.locator('input[name="q"]').fill("스트리밍");
  await search.getByRole("button", { name: "검색" }).click();
  await expect(page).toHaveURL(/\/posts\?q=/);
  await expect(page.getByText(/"스트리밍" 검색 결과/)).toBeVisible();
  await expect(page.getByRole("link", { name: /Suspense 스트리밍/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Cache Components 란/ })).toHaveCount(0);

  // 초기화
  await page.getByRole("button", { name: "초기화" }).click();
  await expect(page).toHaveURL(/\/posts$/);
});

test("이미지 업로드: 글에 첨부하면 next/image 로 최적화되어 표시된다", async ({ page }) => {
  await login(page, "demo@example.com");
  const form = page.locator("form", { has: page.locator("#title") });
  await form.locator("#title").fill("이미지 글");
  await form.locator("#content").fill("이미지가 있는 글");
  await form.locator("#image").setInputFiles({ name: "dot.png", mimeType: "image/png", buffer: PNG_1x1 });
  await form.getByRole("button", { name: "작성" }).click();
  await page.waitForURL(/\/posts\/\d+$/);

  const img = page.locator("article img");
  await expect(img).toBeVisible();
  // next/image 는 src 를 /_next/image?url=... 로 바꿔 최적화 엔드포인트를 거친다
  await expect(img).toHaveAttribute("src", /_next\/image\?url=%2Fapi%2Fuploads%2F/);

  // 원본 파일도 Route Handler 로 서빙된다
  const src = decodeURIComponent((await img.getAttribute("src"))!.match(/url=([^&]+)/)![1]);
  const res = await page.request.get(src);
  expect(res.ok()).toBeTruthy();
  expect(res.headers()["content-type"]).toBe("image/png");

  // 수정 페이지에서 이미지 삭제
  const postUrl = page.url();
  await page.goto(`${postUrl}/edit`);
  await page.getByLabel(/현재 이미지 삭제/).check();
  await page.locator("form", { has: page.locator("#title") }).getByRole("button", { name: "저장" }).click();
  await page.waitForURL(postUrl);
  await expect(page.locator("article img")).toHaveCount(0);
});

test("이미지 업로드: 허용되지 않은 파일은 폼 에러", async ({ page }) => {
  await login(page, "demo@example.com");
  const form = page.locator("form", { has: page.locator("#title") });
  await form.locator("#title").fill("잘못된 파일");
  await form.locator("#content").fill("x");
  await form.locator("#image").setInputFiles({ name: "a.txt", mimeType: "text/plain", buffer: Buffer.from("hi") });
  await form.getByRole("button", { name: "작성" }).click();
  await expect(page.getByText("JPG, PNG, WebP, GIF 이미지만 올릴 수 있습니다.")).toBeVisible();
  await expect(form.locator("#title")).toHaveValue("잘못된 파일"); // 입력값 유지
});

test("next/dynamic: 최근 본 글 위젯은 브라우저에서만 로드되어 두 번째 글부터 보인다", async ({ page }) => {
  await page.goto("/posts/1");
  await expect(page.getByText("최근 본 글")).toHaveCount(0); // 처음엔 이전 기록이 없다
  await page.goto("/posts/2");
  await expect(page.getByText("최근 본 글")).toBeVisible();
  await expect(page.getByRole("link", { name: "Cache Components 란?" })).toBeVisible();

  // 서버 HTML 에는 이 위젯이 없다 (ssr: false)
  const html = await (await page.request.get("/posts/2")).text();
  expect(html).not.toContain("최근 본 글");
});

test("외부 API + use(): 릴리스 페이지가 스트리밍으로 채워진다 (API 실패 시 error.tsx)", async ({ page }) => {
  await page.goto("/posts/releases");
  await expect(page.getByRole("heading", { name: "Next.js 최신 릴리스" })).toBeVisible();
  // 네트워크 상황에 따라 목록 또는 에러 UI 중 하나가 온다. 둘 중 하나는 반드시 렌더링되어야 한다.
  await expect(page.getByText(/캐시 생성:|문제가 발생했습니다/)).toBeVisible({ timeout: 15000 });
});

test("무한 스크롤: 끝에 닿으면 다음 글을 불러오고, 다 읽으면 안내가 뜬다", async ({ page }) => {
  await page.goto("/posts/feed");
  const links = page.locator("ul a[href^='/posts/']");
  await expect(links).toHaveCount(5); // 서버가 렌더링한 첫 페이지 (시드 6개 중 5개)

  const nextPage = page.waitForResponse((r) => r.url().includes("/api/posts?") && r.url().includes("cursor="));
  await page.locator("div[aria-hidden].h-1").scrollIntoViewIfNeeded(); // sentinel 을 화면에 넣는다
  await nextPage;
  // 앞선 테스트가 남긴 글이 있을 수 있으므로 정확한 개수 대신 "늘어났다" 와 "끝 안내" 를 본다
  await expect.poll(async () => links.count()).toBeGreaterThan(5);
  for (let i = 0; i < 5 && !(await page.getByText(/더 이상 글이 없습니다/).isVisible()); i++) {
    await page.locator("div[aria-hidden].h-1").scrollIntoViewIfNeeded();
    await page.waitForTimeout(700);
  }
  await expect(page.getByText(/더 이상 글이 없습니다/)).toBeVisible();
  // 이어 붙인 목록에 중복 id 가 없다 (커서 방식)
  const hrefs = await links.evaluateAll((as) => as.map((a) => a.getAttribute("href")));
  expect(new Set(hrefs).size).toBe(hrefs.length);
});
