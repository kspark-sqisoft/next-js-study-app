// ThemeColorSync: 테마가 바뀌면 <meta name="theme-color"> 를 맞추고, iOS 26 Safari 가 상태 표시줄 색을
// 다시 읽도록 보이지 않는 fixed 요소를 잠깐 넣었다 뺀다. next-themes 는 Provider 가 있어야 하므로 useTheme 만 흉내 낸다.
import { afterEach, describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";

let resolvedTheme: string | undefined;
vi.mock("next-themes", () => ({ useTheme: () => ({ resolvedTheme }) }));

const { ThemeColorSync } = await import("./theme-color-sync");
const { THEME_COLORS } = await import("@/lib/theme-colors");

function addMeta(media: string, content: string) {
  const meta = document.createElement("meta");
  meta.name = "theme-color";
  meta.media = media;
  meta.content = content;
  document.head.appendChild(meta);
}

function metas() {
  return Array.from(document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]'));
}

// 마운트 뒤 rerender 하는 동안 body 에 추가된 요소를 모은다 (넣자마자 빼므로 스파이로만 잡을 수 있다)
function collectAppended(run: () => void) {
  const appended: HTMLElement[] = [];
  const original = document.body.appendChild.bind(document.body);
  const spy = vi.spyOn(document.body, "appendChild").mockImplementation((node) => {
    appended.push(node as HTMLElement);
    return original(node);
  });
  try {
    run();
  } finally {
    spy.mockRestore();
  }
  return appended;
}

describe("<ThemeColorSync />", () => {
  afterEach(() => {
    document.head.innerHTML = "";
    resolvedTheme = undefined;
  });

  it("테마가 정해지면 media 조건을 떼고 모든 theme-color 메타를 그 테마 색으로 바꾼다", () => {
    addMeta("(prefers-color-scheme: light)", THEME_COLORS.light);
    addMeta("(prefers-color-scheme: dark)", THEME_COLORS.dark);
    resolvedTheme = "dark";
    render(<ThemeColorSync />);
    expect(metas()).toHaveLength(2);
    for (const meta of metas()) {
      expect(meta.content).toBe(THEME_COLORS.dark);
      expect(meta.hasAttribute("media")).toBe(false);
    }
  });

  it("메타가 하나도 없으면 만들어 넣는다", () => {
    resolvedTheme = "light";
    render(<ThemeColorSync />);
    expect(metas()).toHaveLength(1);
    expect(metas()[0].content).toBe(THEME_COLORS.light);
  });

  it("테마가 바뀌면 fixed 요소를 잠깐 넣었다 빼서 iOS Safari 가 상태 표시줄 색을 다시 읽게 한다", () => {
    resolvedTheme = "light";
    const { rerender } = render(<ThemeColorSync />);

    resolvedTheme = "dark";
    const appended = collectAppended(() => rerender(<ThemeColorSync />));

    const probe = appended.find((el) => el.style?.position === "fixed");
    expect(probe).toBeDefined();
    expect(document.body.contains(probe!)).toBe(false); // 신호만 주고 바로 뺀다
    expect(metas()[0].content).toBe(THEME_COLORS.dark);
  });

  it("처음 테마가 정해질 때(마운트)는 fixed 요소를 넣지 않는다", () => {
    resolvedTheme = undefined;
    const { rerender } = render(<ThemeColorSync />);
    resolvedTheme = "light";
    const appended = collectAppended(() => rerender(<ThemeColorSync />));
    expect(appended.some((el) => el.style?.position === "fixed")).toBe(false);
  });
});
