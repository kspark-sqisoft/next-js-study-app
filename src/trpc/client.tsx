// 브라우저 쪽 tRPC 설정 (클라이언트 컴포넌트).
// - TRPCProvider / useTRPC: 컴포넌트에서 trpc.posts.search.queryOptions(...) 처럼 쓰는 훅을 만든다
// - createTRPCClient + httpBatchLink: 여러 호출을 한 HTTP 요청으로 묶어 /api/trpc 로 보낸다
// - QueryClientProvider: TanStack Query 캐시. tRPC 는 이 캐시 위에서 동작한다
"use client";

import { useState, type ReactNode } from "react";
import { QueryClientProvider, type QueryClient } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { createTRPCClient, httpBatchLink } from "@trpc/client";
import { createTRPCContext } from "@trpc/tanstack-react-query";
import superjson from "superjson";
import { makeQueryClient } from "./query-client";
import type { AppRouter } from "./routers/_app";

// AppRouter 타입만 import 한다 (import type). 서버 구현은 브라우저로 오지 않는다.
export const { TRPCProvider, useTRPC } = createTRPCContext<AppRouter>();

let browserQueryClient: QueryClient | undefined;

function getQueryClient() {
  if (typeof window === "undefined") return makeQueryClient(); // 서버: 요청마다 새로 (요청 간 데이터 섞임 방지)
  return (browserQueryClient ??= makeQueryClient()); // 브라우저: 하나를 계속 재사용
}

function getUrl() {
  const base = typeof window !== "undefined" ? "" : `http://localhost:${process.env.PORT ?? 3000}`;
  return `${base}/api/trpc`;
}

export function TRPCReactProvider({ children }: { children: ReactNode }) {
  const queryClient = getQueryClient();
  const [trpcClient] = useState(() =>
    createTRPCClient<AppRouter>({
      links: [
        httpBatchLink({
          url: getUrl(),
          transformer: superjson, // 서버(init.ts)와 같은 transformer
        }),
      ],
    }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <TRPCProvider trpcClient={trpcClient} queryClient={queryClient}>
        {children}
        {/* 화면 구석의 아이콘을 누르면 쿼리 캐시 상태를 볼 수 있다. 프로덕션 빌드에서는 자동 제외 */}
        <ReactQueryDevtools initialIsOpen={false} />
      </TRPCProvider>
    </QueryClientProvider>
  );
}
