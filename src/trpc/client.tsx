// 브라우저 쪽 tRPC 설정 (클라이언트 컴포넌트). 루트 레이아웃(src/app/layout.tsx)이 앱 전체를 이걸로 감싼다.
//
// [main 브랜치와 비교]
// main 의 src/components/query-providers.tsx 는 QueryClientProvider 하나만 제공했고, 컴포넌트가 fetch 로 직접 API 를 불렀다.
// 여기서는 QueryClientProvider 안에 TRPCProvider 를 하나 더 끼워, 컴포넌트가 useTRPC() 로 "타입이 붙은 호출 도구" 를 받는다.
//
// [만드는 것 세 가지]
// 1. TRPCProvider / useTRPC : createTRPCContext<AppRouter>() 가 만들어 준다. 컴포넌트는 useTRPC() 로 trpc 객체를 얻어
//                              trpc.posts.search.queryOptions({ q }) 처럼 "queryKey + queryFn 이 채워진 옵션" 을 만든다.
// 2. trpcClient              : 실제 HTTP 를 보내는 쪽. httpBatchLink 가 /api/trpc 로 요청한다.
// 3. queryClient             : TanStack Query 캐시. 서버에서 hydrate 된 데이터가 여기 들어온다.
"use client";

import { useState, type ReactNode } from "react";
import { QueryClientProvider, type QueryClient } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { createTRPCClient, httpBatchLink } from "@trpc/client";
import { createTRPCContext } from "@trpc/tanstack-react-query";
import superjson from "superjson";
import { makeQueryClient } from "./query-client";
import type { AppRouter } from "./routers/_app";

// AppRouter 는 "타입만" import 한다 (import type). 서버 구현은 브라우저 번들에 들어오지 않는다.
// 이 제네릭 하나로 useTRPC() 가 돌려주는 객체가 posts.list, comments.add 같은 경로와 입력/출력 타입을 전부 안다.
export const { TRPCProvider, useTRPC } = createTRPCContext<AppRouter>();

let browserQueryClient: QueryClient | undefined;

/**
 * QueryClient 를 "어디서 실행되느냐" 에 따라 다르게 만든다.
 * - 서버(SSR, typeof window === "undefined"): 요청마다 새로 만든다. 모듈 변수에 하나를 두고 재사용하면
 *   사용자 A 의 요청이 채운 캐시를 사용자 B 의 요청이 보게 되는 사고가 난다 (서버는 여러 요청을 동시에 처리한다).
 * - 브라우저: 하나를 만들어 계속 재사용한다. 페이지를 이동해도 캐시가 유지되어야 하기 때문.
 *   (React 가 이 컴포넌트를 다시 렌더링해도 새 클라이언트를 만들지 않게 모듈 변수에 보관)
 */
function getQueryClient() {
  if (typeof window === "undefined") return makeQueryClient(); // 서버: 요청마다 새로 (요청 간 데이터 섞임 방지)
  return (browserQueryClient ??= makeQueryClient()); // 브라우저: 하나를 계속 재사용
}

/**
 * tRPC 엔드포인트 주소.
 * - 브라우저: 상대 경로 "/api/trpc". 현재 사이트로 보낸다.
 * - 서버(SSR 중 클라이언트 컴포넌트가 렌더링될 때): 상대 경로가 없으므로 절대 URL 이 필요하다.
 *   실제로는 서버 컴포넌트가 server.tsx 의 프록시로 라우터를 직접 부르므로 이 주소로 HTTP 가 나가는 일은 거의 없다.
 */
function getUrl() {
  const base = typeof window !== "undefined" ? "" : `http://localhost:${process.env.PORT ?? 3000}`;
  return `${base}/api/trpc`;
}

export function TRPCReactProvider({ children }: { children: ReactNode }) {
  const queryClient = getQueryClient();
  // useState 의 초기화 함수: 컴포넌트 수명 동안 trpcClient 를 한 번만 만든다 (리렌더링마다 새 클라이언트 방지)
  const [trpcClient] = useState(() =>
    createTRPCClient<AppRouter>({
      links: [
        // httpBatchLink: 같은 틱(tick)에 발생한 여러 프로시저 호출을 HTTP 요청 하나로 묶어 보낸다.
        // 예: 한 화면이 posts.list 와 comments.list 를 동시에 부르면 /api/trpc/posts.list,comments.list 요청 하나가 나간다.
        // main 의 fetch 방식은 호출마다 요청 하나였다.
        httpBatchLink({
          url: getUrl(),
          transformer: superjson, // 서버(init.ts)와 같은 transformer 여야 Date 등이 올바르게 복원된다
        }),
      ],
    }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      {/* TRPCProvider 는 trpcClient(HTTP)와 queryClient(캐시)를 묶는다. useTRPC() 는 이 둘을 써서 queryOptions 를 만든다 */}
      <TRPCProvider trpcClient={trpcClient} queryClient={queryClient}>
        {children}
        {/* 화면 구석의 아이콘을 누르면 쿼리 캐시 상태(키, 데이터, 신선도)를 볼 수 있다. 프로덕션 빌드에서는 자동 제외.
            tRPC 의 queryKey 가 [["posts","search"],{ input: {...}, type: "query" }] 모양인 것을 여기서 확인해 보자 */}
        <ReactQueryDevtools initialIsOpen={false} />
      </TRPCProvider>
    </QueryClientProvider>
  );
}
