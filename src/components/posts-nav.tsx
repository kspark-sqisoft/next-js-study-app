// /posts 와 데모 페이지들이 공유하는 탭 네비게이션 (서버 컴포넌트).
// 두 레이아웃(src/app/posts/layout.tsx, src/app/(demos)/layout.tsx)이 같은 컴포넌트를 쓴다.
// 현재 탭 표시는 NavLink(클라이언트)가 usePathname 으로 한다. 이 파일은 목록만 넘긴다.
import { NavLink } from "@/components/nav-link";

const links = [
  { href: "/", label: "홈", exact: true },
  { href: "/posts", label: "글 목록" },
  { href: "/feed", label: "무한 스크롤" },
  { href: "/client-fetch", label: "클라이언트 검색" },
  { href: "/releases", label: "외부 API" },
];

export function PostsNav() {
  return (
    <nav aria-label="글 섹션" className="mb-6 flex flex-wrap gap-1 border-b border-border/70">
      {links.map((l) => (
        <NavLink
          key={l.href}
          href={l.href}
          exact={l.exact}
          className="relative -mb-px px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
          activeClassName="text-foreground after:absolute after:inset-x-3 after:-bottom-px after:h-0.5 after:rounded-full after:bg-primary"
        >
          {l.label}
        </NavLink>
      ))}
    </nav>
  );
}
