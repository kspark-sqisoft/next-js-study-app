// tRPC(useQuery) 로 검색 결과를 가져오는 클라이언트 컴포넌트. /client-fetch 페이지의 4번째 섹션.
//
// [같은 페이지의 세 가지와 비교]
// - post-count.tsx (useEffect + fetch): 로딩/에러/취소를 전부 손으로.
// - post-search.tsx (SWR): 키가 URL 문자열, fetcher 함수, 응답 타입 손으로 선언.
// - post-search-query.tsx (TanStack Query + fetch): queryKey 배열, queryFn 에서 fetch, `type SearchResponse` 손으로 선언.
// - 이 파일 (tRPC): fetch 함수도, URL 도, 응답 타입 선언도 없다.
//   trpc.posts.search.queryOptions({ q }) 가 queryKey 와 queryFn 을 만들어 주고,
//   data 의 타입은 서버 라우터(src/trpc/routers/posts.ts)의 반환 타입에서 그대로 온다.
//   서버에서 posts 필드 이름을 바꾸면 이 파일이 컴파일 에러가 난다. fetch 버전은 실행해야 깨진다.
//
// useQuery 자체는 TanStack Query 의 것이다. tRPC 는 "옵션을 만들어 주는 역할" 만 하므로
// isPending, isFetching, placeholderData 같은 개념은 post-search-query.tsx 와 완전히 같다.
"use client";

import { useState } from "react";
import Link from "next/link";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { useTRPC } from "@/trpc/client";

export function PostSearchTrpc() {
  const trpc = useTRPC(); // client.tsx 의 TRPCProvider 가 제공. 라우터 경로와 타입을 아는 객체
  const [query, setQuery] = useState("");

  // queryOptions(입력, 추가 옵션):
  // - 첫 인자 { q: query } 는 routers/posts.ts 의 .input(z.object({ q })) 타입이다. 다른 키를 넣으면 컴파일 에러.
  // - 입력이 바뀌면 queryKey 도 바뀌므로(키에 입력이 들어간다) 검색어마다 별도 캐시 항목이 생긴다.
  // - isPending: 이 키에 데이터가 아직 한 번도 없을 때 / isFetching: 백그라운드 재요청 중일 때도 true
  // - keepPreviousData: 키가 바뀌는 동안 이전 결과를 유지해 목록이 깜빡이지 않게 (TanStack 버전과 같은 옵션)
  const { data, error, isPending, isFetching } = useQuery(
    trpc.posts.search.queryOptions({ q: query }, { placeholderData: keepPreviousData }),
  );
  // data 위에 마우스를 올려 보면 { query: string; total: number; posts: { id; title; createdAt }[] } 로 추론된다.
  // 이 타입은 어디에도 선언되어 있지 않다. routers/posts.ts 의 search 프로시저가 return 하는 객체 모양 그 자체다.

  return (
    <div className="space-y-3">
      <Input placeholder="제목이나 내용으로 검색" value={query} onChange={(e) => setQuery(e.target.value)} />

      {/* error 는 TRPCClientError. 서버가 던진 TRPCError 의 message 가 그대로 들어 있다 */}
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
