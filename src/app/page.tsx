// 홈 페이지 (/). 서버 컴포넌트이며 요청별 데이터가 없어서 빌드 시 정적 HTML 로 생성된다 (SSG).
// 각 실험실(페이지)로 들어가는 타일 목록. 타일마다 "무엇을 관찰하는지" 와 "어떤 개념인지" 를 적었다.
import Link from "next/link";
import {
  GlobeIcon,
  KeyRoundIcon,
  ListTodoIcon,
  NewspaperIcon,
  ScrollTextIcon,
  SearchIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

const labs = [
  {
    href: "/todos",
    title: "할 일",
    icon: ListTodoIcon,
    what: "Server Action 으로 추가하고, 체크하면 useOptimistic 이 서버 응답보다 먼저 화면을 바꾼다.",
    concepts: "서버 컴포넌트, Server Action, revalidatePath, zustand",
  },
  {
    href: "/posts",
    title: "글",
    icon: NewspaperIcon,
    what: "목록은 \"use cache\" 로 캐시되고, 상세는 본문과 댓글과 다른 글이 따로 스트리밍된다.",
    concepts: "\"use cache\", Suspense 스트리밍, 인증과 권한",
  },
  {
    href: "/feed",
    title: "무한 스크롤",
    icon: ScrollTextIcon,
    what: "첫 페이지는 서버가 그리고, 다음 페이지부터 브라우저가 커서로 이어 붙인다.",
    concepts: "커서 페이지네이션, useInfiniteQuery",
  },
  {
    href: "/client-fetch",
    title: "클라이언트 검색",
    icon: SearchIcon,
    what: "같은 검색을 여러 데이터 페칭 방법으로 구현해 나란히 비교한다.",
    concepts: "CSR, SWR, TanStack Query",
  },
  {
    href: "/releases",
    title: "외부 API",
    icon: GlobeIcon,
    what: "GitHub 릴리스를 서버에서 캐시하고, Promise 째로 넘겨 use() 로 읽는다.",
    concepts: "외부 fetch 캐시, use()",
  },
  {
    href: "/api/v1",
    title: "공개 API",
    icon: KeyRoundIcon,
    what: "Bearer 토큰, 레이트 리밋, OpenAPI 명세를 갖춘 REST 엔드포인트. 응답은 JSON 이다.",
    concepts: "Route Handler, 토큰, CORS",
  },
];

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-12">
      <section className="max-w-2xl">
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-semibold tracking-tight text-balance">Next.js Study App</h1>
          <Badge variant="secondary">v0.1.0</Badge>
        </div>
        <p className="mt-3 text-base leading-relaxed text-muted-foreground text-pretty">
          Next.js 16 의 렌더링, 캐시, 인증을 직접 눌러 보며 배우는 실험실. 페이지마다 개념 하나를 보여 주고,
          서버에서 일어나는 일은 <code className="rounded bg-muted px-1 py-0.5 text-[0.85em]">npm run dev</code> 터미널의
          로그로 따라갈 수 있다.
        </p>
      </section>

      <ul className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {labs.map((lab) => (
          <li key={lab.href}>
            <Link
              href={lab.href}
              className="group flex h-full flex-col gap-3 rounded-xl border border-border bg-card p-5 transition-colors outline-none hover:border-primary/50 hover:bg-primary/[0.035] focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <div className="flex items-center gap-2.5">
                <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <lab.icon className="size-4" />
                </span>
                <span className="text-base font-semibold tracking-tight">{lab.title}</span>
              </div>
              <p className="text-sm leading-relaxed text-pretty">{lab.what}</p>
              <p className="mt-auto text-xs text-muted-foreground">{lab.concepts}</p>
            </Link>
          </li>
        ))}
      </ul>

      <p className="mt-10 max-w-2xl text-sm text-muted-foreground">
        글 작성과 댓글은 로그인이 필요합니다. 샘플 계정:{" "}
        <code className="rounded bg-muted px-1 py-0.5 text-[0.85em]">demo@example.com / password123</code>
      </p>
    </main>
  );
}
