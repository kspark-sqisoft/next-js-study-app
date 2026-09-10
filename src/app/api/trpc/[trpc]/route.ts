// tRPC 의 HTTP 입구. 브라우저의 모든 tRPC 호출이 이 파일 하나로 들어온다.
//
// [URL 모양]
// - 폴더 이름 [trpc] 는 동적 세그먼트. /api/trpc/posts.search, /api/trpc/comments.add 처럼 프로시저 경로가 URL 이 된다.
// - 조회(query)는 GET, 입력은 쿼리스트링: /api/trpc/posts.search?input={"json":{"q":"스트리밍"}}
// - 변경(mutation)은 POST, 입력은 본문. 그래서 GET 과 POST 둘 다 같은 handler 로 export 한다.
// - httpBatchLink 가 여러 호출을 묶으면 /api/trpc/posts.list,comments.list?batch=1 처럼 콤마로 이어진다.
//   fetchRequestHandler 가 이걸 풀어서 각 프로시저를 실행하고 결과를 배열로 돌려준다.
//
// [main 브랜치와 비교]
// main 은 API 마다 파일이 있었다: src/app/api/posts/route.ts, src/app/api/todos/route.ts, src/app/api/v1/**.
// 여기서는 파일 하나이고, "무엇이 있는지" 는 routers/_app.ts 가 정한다. 새 프로시저를 추가해도 이 파일은 안 바뀐다.
//
// [중요한 결과]
// 이 파일은 일반 Route Handler 와 같은 파일 규약이다. 즉 tRPC 프로시저는 "Route Handler 컨텍스트" 에서 실행된다.
// 그래서 Server Action 전용인 updateTag() 를 프로시저 안에서 못 쓰고 revalidateTag(tag, { expire: 0 }) 를 쓴다
// (routers/comments.ts 참고).
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { createTRPCContext } from "@/trpc/init";
import { appRouter } from "@/trpc/routers/_app";

const handler = (req: Request) =>
  fetchRequestHandler({
    endpoint: "/api/trpc", // URL 에서 이 접두사를 뗀 나머지가 프로시저 경로
    req,
    router: appRouter,
    createContext: createTRPCContext, // 요청마다 { user } 컨텍스트 생성 (init.ts)
  });

export { handler as GET, handler as POST };
