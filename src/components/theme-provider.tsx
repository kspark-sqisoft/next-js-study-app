// 라이트/다크 테마 Provider (클라이언트 컴포넌트). 루트 레이아웃이 앱 전체를 이걸로 감싼다.
//
// next-themes 가 하는 일:
// - 선택한 테마를 localStorage("theme") 에 저장하고, <html> 에 class="dark" 를 붙였다 뗐다 한다 (attribute="class").
//   globals.css 의 `.dark { ... }` 변수와 Tailwind 의 `dark:` 변형이 이 클래스를 본다.
// - defaultTheme="system" + enableSystem: 저장된 값이 없으면 OS 설정(prefers-color-scheme)을 따른다.
// - 서버는 사용자의 테마를 모르므로 HTML 에는 class 가 없고, 브라우저에서 아주 이른 시점에 인라인 스크립트가 붙인다.
//   그래서 <html> 에 suppressHydrationWarning 이 필요하다 (layout.tsx).
// - disableTransitionOnChange: 테마를 바꾸는 순간 모든 요소가 색 전환 애니메이션을 하며 깜빡이는 것을 막는다.
//
// Context Provider 는 클라이언트 컴포넌트여야 하지만, children 으로 받는 서버 컴포넌트(헤더, 페이지)는 그대로 서버에서 렌더된다 (부록 A-7).
"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ComponentProps } from "react";

export function ThemeProvider({ children, ...props }: ComponentProps<typeof NextThemesProvider>) {
  return (
    <NextThemesProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange {...props}>
      {children}
    </NextThemesProvider>
  );
}
