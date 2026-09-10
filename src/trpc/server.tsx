// 서버 컴포넌트 쪽 tRPC 설정.
// - trpc: 서버에서 HTTP 없이 라우터를 직접 호출하는 프록시. prefetch 에 쓴다
// - HydrateClient: 서버에서 채운 쿼리 캐시를 브라우저로 넘긴다 → 클라이언트 useQuery 가 로딩 없이 바로 데이터를 본다
// - caller: 서버 코드에서 프로시저를 그냥 함수처럼 부를 때 (테스트에서도 사용)
import "server-only";
import { cache, type ReactNode } from "react";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { createTRPCOptionsProxy, type TRPCQueryOptions } from "@trpc/tanstack-react-query";
import { createTRPCContext } from "./init";
import { makeQueryClient } from "./query-client";
import { appRouter } from "./routers/_app";

// 요청 하나 안에서는 같은 QueryClient 를 쓴다 (React cache)
export const getQueryClient = cache(makeQueryClient);

export const trpc = createTRPCOptionsProxy({
  ctx: createTRPCContext,
  router: appRouter,
  queryClient: getQueryClient,
});

export function HydrateClient({ children }: { children: ReactNode }) {
  const queryClient = getQueryClient();
  return <HydrationBoundary state={dehydrate(queryClient)}>{children}</HydrationBoundary>;
}

/** 서버 컴포넌트에서 미리 가져오기. await 하지 않아 렌더링을 막지 않는다 (결과는 HydrateClient 로 전달) */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- tRPC 공식 예제의 시그니처
export function prefetch<T extends ReturnType<TRPCQueryOptions<any>>>(queryOptions: T) {
  const queryClient = getQueryClient();
  if (queryOptions.queryKey[1]?.type === "infinite") {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    void queryClient.prefetchInfiniteQuery(queryOptions as any);
  } else {
    void queryClient.prefetchQuery(queryOptions);
  }
}

export const caller = appRouter.createCaller(createTRPCContext);
