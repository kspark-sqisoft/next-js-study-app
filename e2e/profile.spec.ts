// 프로필: 이름 변경이 헤더에 바로 반영되고, 아바타를 올리면 헤더에 이미지가, 삭제하면 다시 글자가 보인다.
// Server Action + 파일 업로드 + 레이아웃 재렌더(revalidatePath("/", "layout"))는 E2E 로만 검증할 수 있다.
import { expect, test, type Page } from "@playwright/test";

const PASSWORD = "password123";
const PNG_1x1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64",
);

async function login(page: Page, email: string) {
  await page.goto("/login");
  const form = page.locator("form", { has: page.locator("#email") });
  await form.locator("#email").fill(email);
  await form.locator("#password").fill(PASSWORD);
  await form.getByRole("button", { name: "로그인" }).click();
  await page.waitForURL("/posts");
}

test.describe.serial("프로필", () => {
  const uniq = Date.now();
  const email = `profile${uniq}@example.com`;

  test("가입 → 헤더 이름 클릭 → 이름 변경이 헤더에 즉시 반영", async ({ page }) => {
    await page.goto("/signup");
    const signup = page.locator("form", { has: page.locator("#email") });
    await signup.locator("#name").fill("프로필테스터");
    await signup.locator("#email").fill(email);
    await signup.locator("#password").fill(PASSWORD);
    await signup.getByRole("button", { name: "가입하기" }).click();
    await page.waitForURL("/posts");

    await page.locator("header").getByRole("link", { name: /프로필테스터/ }).click();
    await page.waitForURL("/profile");

    // 보이는 <main> 안의 폼만. Server Action 의 redirect 로 떠난 이전 페이지(가입 폼)가 숨은 채 DOM 에 남아 #name 이 둘이 될 수 있다
    const form = page.getByRole("main").locator("form", { has: page.locator("#name") });
    await expect(form.locator("#name")).toHaveValue("프로필테스터");
    await form.locator("#name").fill("새이름");
    await form.getByRole("button", { name: "저장" }).click();

    await expect(page.getByText("프로필을 저장했습니다.")).toBeVisible();
    await expect(page.locator("header")).toContainText("새이름"); // 새로고침 없이 레이아웃이 다시 그려졌다
  });

  test("아바타 업로드 → 헤더에 이미지, 삭제 → 다시 글자", async ({ page }) => {
    await login(page, email);
    await page.goto("/profile");
    // 보이는 <main> 안의 폼만. Server Action 의 redirect 로 떠난 이전 페이지(가입 폼)가 숨은 채 DOM 에 남아 #name 이 둘이 될 수 있다
    const form = page.getByRole("main").locator("form", { has: page.locator("#name") });
    const headerAvatar = page.locator("header img[src^='/api/uploads/']");

    await form.locator("#avatar").setInputFiles({ name: "dot.png", mimeType: "image/png", buffer: PNG_1x1 });
    await form.getByRole("button", { name: "저장" }).click();
    await expect(headerAvatar).toBeVisible();
    await expect(form.locator('input[name="removeAvatar"]')).toBeVisible(); // 아바타가 생기면 삭제 체크박스가 나타난다

    await form.locator('input[name="removeAvatar"]').check();
    await form.getByRole("button", { name: "저장" }).click();
    await expect(headerAvatar).toHaveCount(0);
    await expect(form.locator('input[name="removeAvatar"]')).toHaveCount(0);
  });

  test("잘못된 파일은 거부하고 이름은 유지", async ({ page }) => {
    await login(page, email);
    await page.goto("/profile");
    // 보이는 <main> 안의 폼만. Server Action 의 redirect 로 떠난 이전 페이지(가입 폼)가 숨은 채 DOM 에 남아 #name 이 둘이 될 수 있다
    const form = page.getByRole("main").locator("form", { has: page.locator("#name") });
    await form.locator("#name").fill("유지될이름");
    await form.locator("#avatar").setInputFiles({ name: "a.txt", mimeType: "text/plain", buffer: Buffer.from("hi") });
    await form.getByRole("button", { name: "저장" }).click();
    await expect(page.getByText("JPG, PNG, WebP, GIF 이미지만 올릴 수 있습니다.")).toBeVisible();
    await expect(form.locator("#name")).toHaveValue("유지될이름");
  });

  test("로그아웃 상태에서 /profile 은 로그인으로 보낸다", async ({ page }) => {
    await page.goto("/profile");
    await page.waitForURL(/\/login/);
  });
});
