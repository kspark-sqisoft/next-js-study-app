// /posts 와 데모 페이지들이 공유하는 상단 네비게이션.
// 두 레이아웃(src/app/posts/layout.tsx, src/app/(demos)/layout.tsx)이 같은 컴포넌트를 쓴다.
import Link from "next/link";
import { Separator } from "@/components/ui/separator";

const links = [
  { href: "/", label: "홈", muted: true },
  { href: "/posts", label: "글 목록" },
  { href: "/feed", label: "무한 스크롤" },
  { href: "/client-fetch", label: "클라이언트 검색" },
  { href: "/releases", label: "외부 API" },
];

export function PostsNav() {
  return (
    <>
      <nav className="flex flex-wrap items-center gap-4 text-sm">
        {links.map((l) => (
          <Link key={l.href} href={l.href} className={l.muted ? "text-muted-foreground hover:underline" : "font-medium hover:underline"}>
            {l.label}
          </Link>
        ))}
      </nav>
      <Separator className="my-4" />
    </>
  );
}
