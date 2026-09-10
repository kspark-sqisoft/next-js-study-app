// tRPC(useQuery) 로 검색 결과를 가져오는 클라이언트 컴포넌트.
// post-search-query.tsx(TanStack Query + fetch) 와 비교할 것:
// - fetch 함수도, URL 도, 손으로 적은 SearchResponse 타입도 없다.
// - trpc.posts.search.queryOptions({ q }) 가 queryKey / queryFn 을 만들어 주고,
//   data 의 타입은 서버 라우터(src/trpc/routers/posts.ts)의 반환 타입에서 그대로 온다.
//   서버에서 필드 이름을 바꾸면 여기서 컴파일 에러가 난다 (fetch 버전은 실행해야 깨진다).
"use client";

import { useState } from "react";
import Link from "next/link";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { useTRPC } from "@/trpc/client";

export function PostSearchTrpc() {
  const trpc = useTRPC();
  const [query, setQuery] = useState("");

  const { data, error, isPending, isFetching } = useQuery(
    trpc.posts.search.queryOptions({ q: query }, { placeholderData: keepPreviousData }),
  );
  // data 위에 마우스를 올려 보면 { query: string; total: number; posts: { id; title; createdAt }[] } 로 추론된다

  return (
    <div className="space-y-3">
      <Input placeholder="제목이나 내용으로 검색" value={query} onChange={(e) => setQuery(e.target.value)} />

      {error && <p className="text-sm text-destructive">{error.message}</p>}
      {isPending && <p className="text-sm text-muted-foreground">불러오는 중...</p>}

      {data && (
        <div className={isFetching ? "opacity-60" : ""}>
          <p className="text-xs text-muted-foreground">
            &quot;{data.query}&quot; 결과 {data.posts.length}건 / 전체 {data.total}건
            {isFetching && " (갱신 중)"}
          </p>
          <ul className="mt-2 divide-y rounded-lg border text-sm">
            {data.posts.map((post) => (
              <li key={post.id}>
                <Link href={`/posts/${post.id}`} className="block px-3 py-2 hover:bg-muted">
                  {post.title}
                </Link>
              </li>
            ))}
            {data.posts.length === 0 && <li className="px-3 py-2 text-muted-foreground">결과 없음</li>}
          </ul>
        </div>
      )}
    </div>
  );
}
