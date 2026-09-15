// 라이트/다크 전환 버튼 (클라이언트 컴포넌트). 헤더 오른쪽에 있다.
//
// hydration 불일치를 피하는 방법:
// 서버는 테마를 모르므로 "지금 다크인가" 를 렌더 중에 읽으면(resolvedTheme) 서버 HTML 과 브라우저 첫 렌더가 달라진다.
// 그래서 아이콘 두 개를 모두 그려 두고 CSS(`dark:` 클래스)로 하나만 보이게 한다. HTML 은 양쪽이 같고,
// 어느 아이콘이 보이는지는 <html class="dark"> 유무가 정한다.
//
// 클릭 시 판단도 훅 값이 아니라 실제 <html class> 를 본다. next-themes 가 아직 초기화 전이거나(느린 모바일),
// system 테마라 resolvedTheme 이 늦게 채워지는 경우에도 "지금 화면이 다크면 라이트로" 가 항상 맞는다.
// touch-action: manipulation 은 모바일 브라우저의 더블탭 확대 대기(약 300ms)를 없애 탭 반응을 즉시 만든다.
"use client";

import { MoonIcon, SunIcon } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";

export function ThemeToggle() {
  const { setTheme } = useTheme();

  function toggle() {
    const isDark = document.documentElement.classList.contains("dark");
    setTheme(isDark ? "light" : "dark");
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label="라이트/다크 테마 전환"
      title="라이트/다크 테마 전환"
      className="touch-manipulation"
      onClick={toggle}
    >
      <SunIcon className="dark:hidden" />
      <MoonIcon className="hidden dark:block" />
    </Button>
  );
}
