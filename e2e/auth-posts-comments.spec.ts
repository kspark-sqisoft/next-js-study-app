// 사용자 흐름 E2E: 가입 → 글 작성/수정 → 댓글/답글 → 로그아웃 → 다른 사용자로 권한 확인 → 삭제.
// Server Action(폼 제출)은 브라우저에서만 실행할 수 있으므로 이 흐름은 E2E 가 유일한 검증 수단이다.
import { expect, test, type Page } from "@playwright/test";

const PASSWORD = "password123";

async function login(page: Page, email: string) {
  await page.goto("/login");
  const form = page.locator("form", { has: page.locator("#email") });
  await form.locator("#email").fill(email);
  await form.locator("#password").fill(PASSWORD);
  await form.getByRole("button", { name: "로그인" }).click();
  await page.waitForURL("/posts");
}

async function logout(page: Page) {
  await page.locator("header").getByRole("button", { name: "로그아웃" }).click();
  await page.waitForURL("/");
}

test.describe.serial("인증 · 글 · 댓글", () => {
  const uniq = Date.now();
  const email = `tester${uniq}@example.com`;
  let postId: number;

  test("회원 가입: 검증 에러 → 성공 → 헤더에 이름", async ({ page }) => {
    await page.goto("/signup");
    const form = page.locator("form", { has: page.locator("#email") });
    await form.locator("#name").fill("테");
    await form.locator("#email").fill("bad");
    await form.locator("#password").fill("short");
    await form.getByRole("button", { name: "가입하기" }).click();
    await expect(page.getByText("이름은 2자 이상 입력하세요.")).toBeVisible();
    await expect(page.getByText("올바른 이메일 형식이 아닙니다.")).toBeVisible();
    await expect(page.getByText("비밀번호는 8자 이상 입력하세요.")).toBeVisible();

    await form.locator("#name").fill("테스터");
    await form.locator("#email").fill(email);
    await form.locator("#password").fill(PASSWORD);
    await form.getByRole("button", { name: "가입하기" }).click();
    await page.waitForURL("/posts");
    await expect(page.locator("header")).toContainText("테스터");
  });

  test("글 작성: 검증 에러 → 작성 → 목록 즉시 반영 → 수정", async ({ page }) => {
    await login(page, email);
    const form = page.locator("form", { has: page.locator("#title") });
    await form.getByRole("button", { name: "작성" }).click();
    await expect(page.locator("#title-error")).toContainText("제목");

    await form.locator("#title").fill(`E2E 글 ${uniq}`);
    await form.locator("#content").fill("브라우저 테스트로 작성한 글입니다.");
    await form.getByRole("button", { name: "작성" }).click();
    await page.waitForURL(/\/posts\/\d+$/);
    postId = Number(page.url().split("/").pop());
    await expect(page.getByRole("heading", { level: 1 })).toContainText(`E2E 글 ${uniq}`);
    await expect(page.getByRole("button", { name: "수정" })).toBeVisible();

    // updateTag 로 목록 캐시가 즉시 갱신됐는지
    await page.goto("/posts");
    await expect(page.getByRole("link", { name: new RegExp(`E2E 글 ${uniq}`) })).toBeVisible();

    // 수정
    await page.goto(`/posts/${postId}/edit`);
    const editForm = page.locator("form", { has: page.locator("#title") });
    await editForm.locator("#title").fill(`E2E 글 ${uniq} (수정됨)`);
    await editForm.getByRole("button", { name: "저장" }).click();
    await page.waitForURL(`/posts/${postId}`);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("(수정됨)");
  });

  test("댓글과 답글 (2단)", async ({ page }) => {
    await login(page, email);
    await page.goto(`/posts/${postId}`);
    const commentForm = page.locator("form", { has: page.getByRole("button", { name: "댓글 작성" }) });
    await commentForm.locator("textarea").fill("첫 댓글");
    await commentForm.getByRole("button", { name: "댓글 작성" }).click();
    await expect(page.getByText("첫 댓글")).toBeVisible();

    await page.getByRole("button", { name: "답글 쓰기" }).click();
    const replyForm = page.locator("form", { has: page.getByRole("button", { name: "답글 작성" }) });
    await replyForm.locator("textarea").fill("첫 답글");
    await replyForm.getByRole("button", { name: "답글 작성" }).click();
    await expect(page.getByText("첫 답글")).toBeVisible();
    await expect(page.getByRole("heading", { name: /댓글 2개/ })).toBeVisible();
    // 답글 아래에는 토글이 없다 → 토글은 최상위 댓글 1개에만
    await expect(page.getByRole("button", { name: /답글 (쓰기|닫기)/ })).toHaveCount(1);
  });

  test("권한: 게스트는 남의 글을 읽기만, 댓글은 가능, 남의 댓글은 삭제 불가", async ({ page }) => {
    await login(page, "guest@example.com");
    await page.goto(`/posts/${postId}`);
    await expect(page.getByText("다른 사람의 글은 읽기만 할 수 있습니다.")).toBeVisible();
    await expect(page.getByRole("button", { name: "수정" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "삭제" })).toHaveCount(0);

    // URL 로 직접 수정 페이지에 들어가도 상세로 돌려보낸다
    await page.goto(`/posts/${postId}/edit`);
    await page.waitForURL(`/posts/${postId}`);

    const commentForm = page.locator("form", { has: page.getByRole("button", { name: "댓글 작성" }) });
    await commentForm.locator("textarea").fill("게스트 댓글");
    await commentForm.getByRole("button", { name: "댓글 작성" }).click();
    await expect(page.getByText("게스트 댓글")).toBeVisible();
    await expect(page.getByRole("button", { name: "삭제" })).toHaveCount(1); // 내 댓글만
    await page.getByRole("button", { name: "삭제" }).click();
    await expect(page.getByText("게스트 댓글")).toHaveCount(0);
    await logout(page);
  });

  test("로그인 실패 메시지와 로그아웃", async ({ page }) => {
    await page.goto("/login");
    const form = page.locator("form", { has: page.locator("#email") });
    await form.locator("#email").fill(email);
    await form.locator("#password").fill("wrong-password");
    await form.getByRole("button", { name: "로그인" }).click();
    await expect(page.getByText("이메일 또는 비밀번호가 올바르지 않습니다.")).toBeVisible();

    await login(page, email);
    await logout(page);
    await expect(page.locator("header")).toContainText("로그인");
  });

  test("작성자가 글을 삭제하면 목록에서 사라지고 not-found 가 된다", async ({ page }) => {
    await login(page, email);
    await page.goto(`/posts/${postId}`);
    page.once("dialog", (d) => d.accept()); // confirm() 수락
    // 글 삭제 버튼은 댓글 삭제 버튼보다 위에 있다
    await page.getByRole("button", { name: "삭제" }).first().click();
    await page.waitForURL("/posts");
    await expect(page.getByRole("link", { name: new RegExp(`E2E 글 ${uniq}`) })).toHaveCount(0);
    await page.goto(`/posts/${postId}`);
    await expect(page.getByText("글을 찾을 수 없습니다")).toBeVisible();
  });
});
