// tRPC 의 HTTP 입구. 브라우저의 모든 tRPC 호출이 /api/trpc/<프로시저 이름> 으로 여기 온다.
// 일반 Route Handler 와 같은 파일 규약이다. 즉 tRPC 프로시저는 "Route Handler 컨텍스트" 에서 실행된다
// (그래서 updateTag 는 못 쓰고 revalidateTag 를 쓴다).
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { createTRPCContext } from "@/trpc/init";
import { appRouter } from "@/trpc/routers/_app";

const handler = (req: Request) =>
  fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext: createTRPCContext,
  });

export { handler as GET, handler as POST };
