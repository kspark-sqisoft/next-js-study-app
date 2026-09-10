// 앱 전체 라우터. 하위 라우터들을 이름으로 묶는다.
// 이 객체의 키가 클라이언트 호출 경로가 된다: trpc.posts.list, trpc.comments.add 처럼.
// 라우터를 더 만들면(todos 등) 여기에 한 줄 추가하면 클라이언트 타입에 바로 반영된다.
import { createTRPCRouter } from "../init";
import { commentsRouter } from "./comments";
import { postsRouter } from "./posts";

export const appRouter = createTRPCRouter({
  posts: postsRouter,
  comments: commentsRouter,
});

/**
 * 클라이언트 타입의 단일 출처.
 * client.tsx 는 `import type { AppRouter }` 로 이 "타입만" 가져온다. import type 은 컴파일 후 사라지므로
 * 서버 구현(DB 접근, 세션 검증)은 브라우저 번들에 들어가지 않는다. 타입은 건너가고 코드는 남는다.
 * 이것이 "서버 라우터 하나에서 타입이 끝까지 흐른다" 의 실체다.
 */
export type AppRouter = typeof appRouter;
