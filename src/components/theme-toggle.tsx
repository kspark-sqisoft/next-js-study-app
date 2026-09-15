// 라이트/다크 전환 버튼 (클라이언트 컴포넌트). 헤더 오른쪽에 있다.
//
// hydration 불일치를 피하는 방법:
// 서버는 테마를 모르므로 "지금 다크인가" 를 렌더 중에 읽으면(resolvedTheme) 서버 HTML 과 브라우저 첫 렌더가 달라진다.
// 그래서 아이콘 두 개를 모두 그려 두고 CSS(`dark:` 클래스)로 하나만 보이게 한다. HTML 은 양쪽이 같고,
// 어느 아이콘이 보이는지는 <html class="dark"> 유무가 정한다. resolvedTheme 은 클릭 핸들러 안에서만 읽는다.
"use client";

import { MoonIcon, SunIcon } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      aria-label="라이트/다크 테마 전환"
      title="라이트/다크 테마 전환"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
    >
      <SunIcon className="dark:hidden" />
      <MoonIcon className="hidden dark:block" />
    </Button>
  );
}
