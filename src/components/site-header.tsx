// 상단 헤더 (서버 컴포넌트). 루트 레이아웃이 한 번 그리고 페이지를 옮겨도 유지된다.
//
// 구성: 왼쪽 브랜드 → 섹션 네비(할 일, 글) → 오른쪽 테마 토글 + 로그인 상태.
// - NavLink, ThemeToggle 은 클라이언트 컴포넌트(브라우저 URL, 클릭). 이 서버 컴포넌트가 자식으로 둔다.
// - UserMenu 는 세션 쿠키를 읽으므로 반드시 <Suspense> 안. 헤더의 나머지는 정적 셸에 들어가 즉시 보인다.
// - 헤더 네비에는 "할 일", "글" 두 섹션만 둔다. 데모 페이지 링크(무한 스크롤 등)는 posts-nav.tsx 의 탭에 있다.
// - 배경은 반투명·블러 없이 불투명(bg-background)이다. iOS 26 부터 Safari 는 상태 표시줄(시계·배터리) 색을 theme-color 메타가
//   아니라 "화면 위쪽에 붙은 sticky/fixed 요소의 background-color" 에서 읽는데, backdrop-filter 가 있으면 "색 없음" 으로 보고
//   페이지 로드 때의 배경색으로 고정해 버려 테마 토글이 반영되지 않는다. 다시 읽게 하는 신호는 theme-color-sync.tsx 에 있다.
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
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background">
      {/* 모바일(<640px)에서는 브랜드 글자를 숨기고 마크만 남긴다. 헤더 한 줄에 네비·토글·로그인 상태가 다 들어가야 하기 때문 */}
      <div className="mx-auto flex h-12 w-full max-w-5xl items-center gap-3 px-4 sm:gap-6 sm:px-6">
        <Link
          href="/"
          aria-label="홈"
          className="flex shrink-0 items-center gap-2 py-2 text-sm font-semibold tracking-tight whitespace-nowrap"
        >
          <span aria-hidden className="size-3 rounded-[3px] bg-primary sm:size-2.5" />
          <span className="hidden sm:inline">Next.js Study</span>
        </Link>

        <nav aria-label="주요 섹션" className="flex h-full items-stretch gap-1">
          {sections.map((s) => (
            <NavLink
              key={s.href}
              href={s.href}
              className="relative flex items-center px-2 text-sm whitespace-nowrap text-muted-foreground transition-colors hover:text-foreground"
              activeClassName="text-foreground after:absolute after:inset-x-2 after:-bottom-px after:h-0.5 after:rounded-full after:bg-primary"
            >
              {s.label}
              {s.href === "/posts" && <RecentlyViewedBadge />}
            </NavLink>
          ))}
        </nav>

        <div className="ml-auto flex min-w-0 items-center gap-1 sm:gap-2">
          <ThemeToggle />
          <Suspense fallback={<div className="h-7 w-24" />}>
            <UserMenu />
          </Suspense>
        </div>
      </div>
    </header>
  );
}
