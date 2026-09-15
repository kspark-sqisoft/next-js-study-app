// 상단 헤더 (서버 컴포넌트). 루트 레이아웃이 한 번 그리고 페이지를 옮겨도 유지된다.
//
// 구성: 왼쪽 브랜드 → 섹션 네비(할 일, 글) → 오른쪽 테마 토글 + 로그인 상태.
// - NavLink, ThemeToggle 은 클라이언트 컴포넌트(브라우저 URL, 클릭). 이 서버 컴포넌트가 자식으로 둔다.
// - UserMenu 는 세션 쿠키를 읽으므로 반드시 <Suspense> 안. 헤더의 나머지는 정적 셸에 들어가 즉시 보인다.
// - 헤더 네비에는 "할 일", "글" 두 섹션만 둔다. 데모 페이지 링크(무한 스크롤 등)는 posts-nav.tsx 의 탭에 있다.
import { Suspense } from "react";
import Link from "next/link";
import { NavLink } from "@/components/nav-link";
import { RecentlyViewedBadge } from "@/components/recently-viewed-badge";
import { ThemeToggle } from "@/components/theme-toggle";
import { UserMenu } from "@/components/user-menu";

const sections = [
  { href: "/todos", label: "할 일" },
  { href: "/posts", label: "글" },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="mx-auto flex h-12 w-full max-w-5xl items-center gap-6 px-6">
        <Link href="/" className="flex items-center gap-2 text-sm font-semibold tracking-tight">
          <span aria-hidden className="size-2.5 rounded-[3px] bg-primary" />
          Next.js Study
        </Link>

        <nav aria-label="주요 섹션" className="flex h-full items-stretch gap-1">
          {sections.map((s) => (
            <NavLink
              key={s.href}
              href={s.href}
              className="relative flex items-center px-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
              activeClassName="text-foreground after:absolute after:inset-x-2 after:-bottom-px after:h-0.5 after:rounded-full after:bg-primary"
            >
              {s.label}
              {s.href === "/posts" && <RecentlyViewedBadge />}
            </NavLink>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <ThemeToggle />
          <Suspense fallback={<div className="h-7 w-24" />}>
            <UserMenu />
          </Suspense>
        </div>
      </div>
    </header>
  );
}
