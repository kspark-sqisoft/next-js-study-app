// zustand: 형제 컴포넌트 간 선택 상태 공유(todos 일괄 처리), persist 스토어와 헤더 배지(최근 본 글)
import { expect, test } from "@playwright/test";

test("todos: 여러 항목을 선택해 일괄 완료 처리하고 삭제한다", async ({ page }) => {
  await page.goto("/todos");
  const bar = page.getByTestId("bulk-action-bar"); // 각 항목에도 "삭제" 버튼이 있으므로 툴바 범위로 좁힌다
  const selectBoxes = page.locator('input[aria-label="선택"]');
  const total = await selectBoxes.count();
  expect(total).toBeGreaterThanOrEqual(3);

  await selectBoxes.nth(0).check();
  await selectBoxes.nth(1).check();
  await expect(page.getByTestId("selected-count")).toHaveText("2개 선택됨"); // 형제 툴바가 스토어를 통해 안다

  await bar.getByRole("button", { name: "완료 처리" }).click();
  await expect(page.getByTestId("selected-count")).toHaveText("0개 선택됨"); // 처리 후 선택 해제
  // 두 항목이 완료됐다: shadcn Checkbox 는 <button role="checkbox" aria-checked> 로 렌더링된다
  await expect.poll(async () => page.locator('li [role="checkbox"][aria-checked="true"]').count()).toBeGreaterThanOrEqual(2);

  // 전체 선택 → 삭제
  await page.locator('input[aria-label="전체 선택"]').check();
  await expect(page.getByTestId("selected-count")).toHaveText(`${total}개 선택됨`);
  page.once("dialog", (d) => d.accept());
  await bar.getByRole("button", { name: "삭제" }).click();
  await expect(page.getByText("아직 할 일이 없습니다")).toBeVisible();
});

test("persist: 글을 두 개 보면 헤더 배지가 2가 되고, 새로고침해도 유지된다", async ({ page }) => {
  await page.goto("/posts/1");
  await expect(page.getByTestId("recent-badge")).toHaveText("1");
  await page.goto("/posts/2");
  await expect(page.getByTestId("recent-badge")).toHaveText("2");
  // 위젯(aside) 안에 이전 글 링크가 있다. 같은 제목이 "다른 글" 목록에도 있으므로 aside 범위로 좁힌다
  const widget = page.locator("aside", { hasText: "최근 본 글" });
  await expect(widget).toBeVisible();
  await expect(widget.getByRole("link", { name: "Cache Components 란?" })).toBeVisible();

  await page.reload();
  await expect(page.getByTestId("recent-badge")).toHaveText("2"); // localStorage 에서 복원

  // 서버 HTML 에는 배지가 없다 (복원 전 0 → 렌더링 안 함) → hydration 불일치 없음
  const html = await (await page.request.get("/posts/2")).text();
  expect(html).not.toContain('data-testid="recent-badge"');
});
