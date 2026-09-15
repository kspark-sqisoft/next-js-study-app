// 테마가 바뀔 때 <meta name="theme-color"> 를 함께 바꾼다 (클라이언트 컴포넌트, 화면에는 아무것도 안 그림).
//
// 루트 레이아웃의 viewport.themeColor 는 OS 설정(prefers-color-scheme)에 따라 두 값 중 하나를 고르는 메타 두 개를 만든다.
// 그런데 이 앱은 헤더 토글로 OS 설정과 다른 테마를 고를 수 있으므로, 토글 뒤에는 현재 테마 색 하나로 덮어써야
// iPhone Safari 의 상태 표시줄(시계·배터리)과 안드로이드 크롬의 주소창 색이 화면과 같이 바뀐다.
"use client";

import { useEffect } from "react";
import { useTheme } from "next-themes";
import { THEME_COLORS } from "@/lib/theme-colors";

export function ThemeColorSync() {
  const { resolvedTheme } = useTheme();

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
  }, [resolvedTheme]);

  return null;
}
