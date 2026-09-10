// 서버 컴포넌트 쪽 tRPC 설정. "서버에서 미리 가져오고(prefetch) 브라우저가 이어받는(hydrate)" 패턴의 도구들.
//
// [왜 서버에서 따로 필요한가]
// 클라이언트 컴포넌트의 useQuery 는 브라우저에서 실행된 뒤에야 요청을 보낸다. 그러면 화면에 "로딩 중" 이 먼저 보인다.
// 서버 컴포넌트가 미리 같은 쿼리를 실행해 결과를 HTML 에 실어 보내면, 브라우저의 useQuery 는 캐시에서 바로 데이터를 꺼낸다.
// main 브랜치에서는 서버 컴포넌트가 getCommentThreads() 를 직접 렌더링했으므로 이런 단계가 없었다.
// 대신 그 방식은 이후 갱신을 위해 페이지 전체를 다시 렌더링해야 했고, 여기서는 브라우저 캐시가 갱신을 맡는다.
//
// [만드는 것]
// - trpc          : 서버에서 HTTP 없이 라우터를 직접 호출하는 프록시. prefetch 에 쓴다
// - HydrateClient : 서버 QueryClient 의 상태를 직렬화(dehydrate)해 브라우저로 넘긴다
// - prefetch      : 쿼리를 미리 실행해 서버 QueryClient 에 채운다
// - caller        : 서버 코드에서 프로시저를 그냥 함수처럼 부를 때
import "server-only";
import { cache, type ReactNode } from "react";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { createTRPCOptionsProxy, type TRPCQueryOptions } from "@trpc/tanstack-react-query";
import { createTRPCContext } from "./init";
import { makeQueryClient } from "./query-client";
import { appRouter } from "./routers/_app";

/**
 * 요청 하나 안에서는 같은 QueryClient 를 쓴다.
 * React 의 cache() 는 "한 번의 서버 렌더링(요청) 동안" 같은 인자면 같은 결과를 돌려준다.
 * 그래서 prefetch 가 채운 클라이언트와 HydrateClient 가 읽는 클라이언트가 같은 객체다.
 * 다음 요청에서는 새로 만들어지므로 사용자 간에 캐시가 섞이지 않는다 (client.tsx 의 서버 분기와 같은 이유).
 */
export const getQueryClient = cache(makeQueryClient);

/**
 * createTRPCOptionsProxy: 클라이언트의 useTRPC() 와 같은 모양(trpc.posts.list.queryOptions(...))을 서버에서 쓰게 해 준다.
 * 차이점은 HTTP 를 거치지 않는다는 것. ctx 와 router 를 직접 받으므로 프로시저를 같은 프로세스 안에서 바로 실행한다.
 * → 서버 컴포넌트에서 자기 자신의 /api/trpc 로 HTTP 요청을 보내는 낭비가 없다.
 */
export const trpc = createTRPCOptionsProxy({
  ctx: createTRPCContext,
  router: appRouter,
  queryClient: getQueryClient,
});

/**
 * 서버 QueryClient 의 내용을 브라우저로 넘기는 경계.
 * dehydrate(queryClient) 가 캐시를 직렬화 가능한 객체로 만들고, HydrationBoundary 가 그것을 HTML 에 실어 보낸다.
 * 브라우저에서는 같은 자리의 HydrationBoundary 가 그 객체를 읽어 브라우저 QueryClient 에 넣는다(hydrate).
 * 이 안에 있는 클라이언트 컴포넌트의 useQuery 는 "이미 데이터가 있는" 상태로 시작한다.
 */
export function HydrateClient({ children }: { children: ReactNode }) {
  const queryClient = getQueryClient();
  return <HydrationBoundary state={dehydrate(queryClient)}>{children}</HydrationBoundary>;
}

/**
 * 서버 컴포넌트에서 쿼리를 미리 실행한다.
 *
 * await 하지 않는 이유: 기다리면 서버 컴포넌트 렌더링이 데이터가 올 때까지 멈춘다.
 * 기다리지 않으면 쿼리는 pending 상태로 QueryClient 에 들어가고, query-client.ts 의 shouldDehydrateQuery 가
 * pending 도 넘기도록 설정되어 있어 브라우저는 "진행 중인 Promise" 를 이어받는다. 결과가 오면 스트리밍으로 채워진다.
 * (그래서 prefetch 뒤에 바로 HydrateClient 로 감싸도 된다)
 *
 * infinite 쿼리(무한 스크롤)는 queryKey 안의 type 이 "infinite" 라서 prefetchInfiniteQuery 로 분기한다.
 * 제네릭에 any 를 쓴 것은 tRPC 공식 예제의 시그니처 그대로다 (queryOptions 의 정확한 타입이 너무 복잡해서).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- tRPC 공식 예제의 시그니처
export function prefetch<T extends ReturnType<TRPCQueryOptions<any>>>(queryOptions: T) {
  const queryClient = getQueryClient();
  if (queryOptions.queryKey[1]?.type === "infinite") {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    void queryClient.prefetchInfiniteQuery(queryOptions as any);
  } else {
    void queryClient.prefetchQuery(queryOptions); // void: 반환 Promise 를 일부러 버린다 (await 안 함)
  }
}

/**
 * 프로시저를 일반 함수처럼 부르는 caller. `await caller.posts.byId({ id: 1 })` 처럼 쓴다.
 * QueryClient 나 캐시와 무관하게 "그냥 결과만" 필요할 때(서버 컴포넌트, 다른 Route Handler)에 쓴다.
 * router.test.ts 는 같은 createCaller 를 가짜 ctx 로 만들어 테스트한다.
 */
export const caller = appRouter.createCaller(createTRPCContext);
