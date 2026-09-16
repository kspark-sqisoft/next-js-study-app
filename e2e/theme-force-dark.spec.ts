// 안드로이드 크롬 "자동 다크 테마" 회귀 테스트. playwright.config.ts 의 chrome-force-dark 프로젝트로만 돈다.
//
// OS 가 다크인 안드로이드 크롬은 라이트 전용 사이트를 강제로 어둡게 뒤집는다(자동 다크 테마). 페이지가 `color-scheme` 으로
// "다크를 지원한다"(dark) 또는 "이 라이트는 의도된 것이다"(only light) 라고 밝혀야 건드리지 않는다. 이 앱은 globals.css 가
// 그 값을 두고, next-themes 가 <html style="color-scheme: light"> 로 덮어쓰지 않게 theme-provider.tsx 에서 끈다.
// 데스크톱 크롬도 Blink 설정(--blink-settings=forceDarkModeEnabled=true)으로 같은 엔진을 켤 수 있어 여기서 재현한다.
//
// 강제 다크는 계산된 스타일(getComputedStyle)이 아니라 그리는 단계에서 색을 바꾸므로 스크린샷 픽셀로 판정한다.
import { expect, test, type Page } from "@playwright/test";

// 스크린샷 PNG 를 브라우저 캔버스에 그려 (x, y) 픽셀의 상대 휘도(0~255)를 읽는다. Node 쪽에 PNG 디코더를 두지 않기 위해서다.
async function luminanceAt(page: Page, x: number, y: number) {
  const png = (await page.screenshot()).toString("base64");
  return page.evaluate(
    async ({ png, x, y }) => {
      const img = new Image();
      img.src = `data:image/png;base64,${png}`;
      await img.decode();
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0);
      const [r, g, b] = ctx.getImageData(x, y, 1, 1).data;
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    },
    { png, x, y },
  );
}

// x=4 는 컨테이너 좌우 여백(px-6)이라 항상 페이지 바탕색이다
const GUTTER_X = 4;

test.describe("강제 다크 모드(안드로이드 크롬 자동 다크 테마)", () => {
  test("라이트 테마는 브라우저가 어둡게 뒤집지 않는다", async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem("theme", "light"));
    await page.goto("/");
    await expect(page.locator("html")).toHaveClass(/\blight\b/);

    // `only` 가 살아 있어야 한다 (next-themes 의 인라인 style 이 덮어쓰면 "light" 만 남는다)
    const colorScheme = await page.evaluate(() => getComputedStyle(document.documentElement).colorScheme);
    expect(colorScheme).toContain("only");
    expect(await page.locator("html").getAttribute("style")).toBeNull();

    // 라이트 바탕(#fbfaf7)은 휘도 약 250. 강제 다크에 뒤집히면 약 30 이 된다.
    expect(await luminanceAt(page, GUTTER_X, 300)).toBeGreaterThan(200);
    expect(await luminanceAt(page, GUTTER_X, 600)).toBeGreaterThan(200);
  });

  test("다크 테마는 앱 고유의 다크색을 그대로 쓴다", async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem("theme", "dark"));
    await page.goto("/");
    await expect(page.locator("html")).toHaveClass(/\bdark\b/);
    expect(await page.evaluate(() => getComputedStyle(document.documentElement).colorScheme)).toBe("dark");

    // 다크 바탕(#0e1218)은 휘도 약 17. 페이지가 다크를 지원한다고 밝혔으므로 브라우저는 손대지 않는다.
    expect(await luminanceAt(page, GUTTER_X, 300)).toBeLessThan(40);
  });
});
