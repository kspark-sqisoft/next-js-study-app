// 테마가 바뀔 때 모바일 상태 표시줄(시계·배터리) 색을 맞춘다 (클라이언트 컴포넌트, 화면에는 아무것도 안 그림).
//
// 브라우저마다 상태 표시줄 색을 정하는 방법이 다르다.
// - 안드로이드 크롬, iOS 18 까지의 Safari: <meta name="theme-color"> 를 읽는다. 루트 레이아웃의 viewport.themeColor 가
//   OS 설정(prefers-color-scheme)에 따라 고르는 메타 두 개를 만들지만, 이 앱은 헤더 토글로 OS 와 다른 테마를 고를 수 있으므로
//   토글 뒤에는 현재 테마 색 하나로 덮어쓴다. 단 안드로이드 크롬은 브라우저 자체가 다크 테마일 때(기본값은 OS 를 따름) 이 메타를
//   무시하고 주소창을 자기 다크색으로 칠하므로(설치한 PWA 만 예외), OS 가 다크인 폰에서는 라이트 테마여도 주소창이 어둡게 남는다.
// - iOS 26 부터의 Safari: theme-color 메타를 무시한다. 대신 화면 위쪽 가장자리에 붙은 fixed/sticky 요소(우리 사이트 헤더)의
//   background-color 를 직접 읽어 칠한다. 그 값은 페이지 로드, 주소창 크기 변화, fixed/sticky 요소의 추가·제거 때만 다시 읽고
//   "색만 바뀐" 경우는 다시 읽지 않는다. 그래서 테마가 바뀐 뒤에는 보이지 않는 fixed 요소를 잠깐 넣었다 빼서
//   "다시 읽어라" 는 신호를 준다 (nudgeFixedEdgeSampling). 헤더 배경이 블러 없는 불투명 색이어야 하는 이유도 site-header.tsx 에 있다.
"use client";

import { useEffect, useRef } from "react";
import { useTheme } from "next-themes";
import { THEME_COLORS } from "@/lib/theme-colors";

export function ThemeColorSync() {
  const { resolvedTheme } = useTheme();
  const previousTheme = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (!resolvedTheme) return; // 마운트 전에는 알 수 없다
    const color = THEME_COLORS[resolvedTheme === "dark" ? "dark" : "light"];
    let metas = document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]');
    if (metas.length === 0) {
      const meta = document.createElement("meta");
      meta.name = "theme-color";
      document.head.appendChild(meta);
      metas = document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]');
    }
    // media 조건을 떼고 현재 테마 색 하나로 통일한다 (OS 설정과 다른 테마를 골랐을 때도 맞도록)
    metas.forEach((meta) => {
      meta.removeAttribute("media");
      meta.content = color;
    });

    // 처음 테마가 정해질 때(마운트)는 페이지 로드 때 이미 읽었으므로 건너뛰고, 실제로 바뀐 경우에만 신호를 준다
    const changed = previousTheme.current !== undefined && previousTheme.current !== resolvedTheme;
    previousTheme.current = resolvedTheme;
    if (changed) nudgeFixedEdgeSampling();
  }, [resolvedTheme]);

  return null;
}

// iOS 26 Safari 에게 "위쪽에 붙은 요소의 색을 다시 읽어라" 고 알리는 신호. 1px 짜리 보이지 않는 fixed 요소를 넣고
// 레이아웃을 한 번 강제한 뒤(그래야 fixed 요소로 실제 등록된다) 바로 뺀다. 다른 브라우저에서는 아무 일도 일어나지 않는다.
function nudgeFixedEdgeSampling() {
  const probe = document.createElement("div");
  probe.setAttribute("aria-hidden", "true");
  probe.style.cssText = "position:fixed;right:0;bottom:0;width:1px;height:1px;visibility:hidden;pointer-events:none";
  document.body.appendChild(probe);
  probe.getBoundingClientRect();
  probe.remove();
}
