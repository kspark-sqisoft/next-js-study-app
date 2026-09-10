// 앱 전체 라우터. 하위 라우터를 이름으로 묶는다: trpc.posts.list, trpc.comments.add 처럼 부른다.
// AppRouter "타입" 만 클라이언트로 건너간다. 서버 코드(DB 접근)는 브라우저 번들에 들어가지 않는다.
import { createTRPCRouter } from "../init";
import { commentsRouter } from "./comments";
import { postsRouter } from "./posts";

export const appRouter = createTRPCRouter({
  posts: postsRouter,
  comments: commentsRouter,
});

export type AppRouter = typeof appRouter;
