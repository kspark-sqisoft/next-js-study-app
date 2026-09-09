// /posts 글 목록 (서버 컴포넌트). 검색과 페이지네이션은 URL 쿼리(?q=&page=)로 관리한다.
//
// searchParams 는 요청 시점 데이터(Request-time API)라서:
// - 페이지 최상위에서 await 하면 페이지 전체가 정적 셸에서 빠진다.
// - 그래서 목록 부분(PostList)만 <Suspense> 안에서 읽고, 제목/설명/버튼은 정적 셸에 남긴다.
// - 값을 꺼낸 뒤 캐시 함수 getPostsPage(q, page) 에 "인자로" 넘긴다. 캐시 함수 안에서는 요청 API 를 못 읽는다.
import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { getCurrentUser } from "@/lib/dal";
import { getPostsPage, PAGE_SIZE } from "@/lib/posts";
import { imageUrl } from "@/lib/uploads";
import { CacheControls } from "./cache-controls";
import { NewPostForm } from "./new-post-form";

export const metadata: Metadata = { title: "글 목록 | Next.js Study App" };

export default function PostsPage({ searchParams }: PageProps<"/posts">) {
  return (
    <div className="space-y-8">
      <section>
        <h1 className="text-xl font-semibold">글 목록</h1>
        <p className="mt-1 text-xs text-muted-foreground">
          검색어와 페이지는 URL 에 있다 (<code>?q=…&amp;page=…</code>). 새로고침하거나 링크를 공유해도 같은
          결과가 나온다. 각 조합의 결과는 따로 캐시되며(<code>getPostsPage(q, page)</code>), 글이 바뀌면 함께
          무효화된다.
        </p>
        <CacheControls />
      </section>

      {/* searchParams 를 읽는 부분만 Suspense 로 감싼다 */}
      <Suspense fallback={<ListSkeleton />}>
        <PostList searchParams={searchParams} />
      </Suspense>

      <section>
        <h2 className="mb-3 font-semibold">새 글 작성</h2>
        <Suspense fallback={<p className="text-sm text-muted-foreground">로그인 상태 확인 중...</p>}>
          <NewPostSection />
        </Suspense>
      </section>
    </div>
  );
}

// 문자열 하나만 허용 (같은 키가 여러 번이면 배열이 온다)
function first(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

async function PostList({ searchParams }: Pick<PageProps<"/posts">, "searchParams">) {
  const sp = await searchParams;
  const query = first(sp.q).trim();
  const requestedPage = Number.parseInt(first(sp.page), 10);
  const page = Number.isFinite(requestedPage) && requestedPage > 0 ? requestedPage : 1;

  const result = await getPostsPage(query, page);
  const from = result.total === 0 ? 0 : (result.page - 1) * PAGE_SIZE + 1;
  const to = Math.min(result.page * PAGE_SIZE, result.total);

  // 페이지 링크는 검색어를 유지한다
  const href = (p: number) => `/posts?${new URLSearchParams({ ...(query && { q: query }), page: String(p) })}`;

  return (
    <section className="space-y-4">
      {/* method=get 폼: JS 없이도 동작한다. 제출하면 /posts?q=... 로 이동한다 */}
      <form action="/posts" method="get" className="flex gap-2">
        <Input name="q" defaultValue={query} placeholder="제목이나 내용으로 검색" />
        <Button type="submit" variant="outline">검색</Button>
        {query && (
          <Button variant="ghost" nativeButton={false} render={<Link href="/posts" />}>
            초기화
          </Button>
        )}
      </form>

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {query ? `"${query}" 검색 결과 ` : ""}
          {result.total}건 중 {from}–{to}
          <Badge variant="secondary" className="ml-2">{result.page} / {result.totalPages} 페이지</Badge>
        </span>
        <span>
          캐시 생성: <time dateTime={result.cachedAt}>{result.cachedAt}</time>
        </span>
      </div>

      {result.posts.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {query ? "검색 결과가 없습니다." : <>아직 글이 없습니다. <code>npm run db:seed</code> 로 샘플을 넣거나 아래에서 작성하세요.</>}
        </p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {result.posts.map((post) => (
            <li key={post.id}>
              <Link href={`/posts/${post.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-muted">
                {post.imagePath && (
                  // eslint-disable-next-line @next/next/no-img-element -- 목록 썸네일은 작은 원본 그대로 (최적화 데모는 상세 페이지에서)
                  <img src={imageUrl(post.imagePath)} alt="" className="size-10 rounded object-cover" />
                )}
                <div className="min-w-0">
                  <div className="truncate font-medium">{post.title}</div>
                  <div className="text-xs text-muted-foreground">
                    #{post.id} · {post.authorName ?? "작성자 없음"} · {post.createdAt}
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {result.totalPages > 1 && (
        <nav className="flex items-center justify-center gap-2" aria-label="페이지">
          <Button size="sm" variant="outline" disabled={result.page <= 1} nativeButton={false}
            render={result.page > 1 ? <Link href={href(result.page - 1)} /> : <span />}>
            이전
          </Button>
          {Array.from({ length: result.totalPages }, (_, i) => i + 1).map((p) => (
            <Button key={p} size="sm" variant={p === result.page ? "default" : "ghost"} nativeButton={false}
              render={<Link href={href(p)} aria-current={p === result.page ? "page" : undefined} />}>
              {p}
            </Button>
          ))}
          <Button size="sm" variant="outline" disabled={result.page >= result.totalPages} nativeButton={false}
            render={result.page < result.totalPages ? <Link href={href(result.page + 1)} /> : <span />}>
            다음
          </Button>
        </nav>
      )}
    </section>
  );
}

async function NewPostSection() {
  const user = await getCurrentUser();
  if (!user) {
    return (
      <p className="text-sm text-muted-foreground">
        글을 쓰려면 <Link href="/login" className="underline">로그인</Link>하세요.
      </p>
    );
  }
  return <NewPostForm />;
}

function ListSkeleton() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-8 w-full" />
      <Skeleton className="h-14 w-full" />
      <Skeleton className="h-14 w-full" />
      <Skeleton className="h-14 w-full" />
    </div>
  );
}
