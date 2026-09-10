// tRPC 초기화: 컨텍스트(요청마다 만들어지는 공용 정보)와 프로시저 빌더.
//
// tRPC 의 핵심 아이디어: 서버에 "프로시저(함수)" 를 정의하면 클라이언트가 그 타입을 그대로 가져다 쓴다.
// REST 처럼 URL 과 응답 모양을 손으로 맞출 필요가 없고, 서버 코드를 바꾸면 클라이언트 컴파일이 깨져서 알려 준다.
import { initTRPC, TRPCError } from "@trpc/server";
import { cache } from "react";
import superjson from "superjson";
import { getCurrentUser } from "@/lib/dal";

// 컨텍스트: 모든 프로시저가 공유하는 요청 단위 정보. 여기서는 로그인 사용자.
// React cache() 로 감싸 같은 요청 안에서 여러 번 불려도 세션 검증은 한 번만 한다.
export const createTRPCContext = cache(async () => {
  const user = await getCurrentUser(); // 쿠키 → 세션 → 사용자. 로그아웃이면 null
  return { user };
});

export type Context = Awaited<ReturnType<typeof createTRPCContext>>;

const t = initTRPC.context<Context>().create({
  // superjson: Date, Map 같은 값도 JSON 으로 오갈 수 있게 직렬화 방식을 통일한다 (클라이언트 링크와 같아야 함)
  transformer: superjson,
});

export const createTRPCRouter = t.router;
export const createCallerFactory = t.createCallerFactory;

/** 누구나 부를 수 있는 프로시저 */
export const publicProcedure = t.procedure;

/** 로그인이 필요한 프로시저. 미들웨어가 ctx.user 를 확인하고, 통과하면 user 가 non-null 로 좁혀진다. */
export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "로그인이 필요합니다." });
  }
  return next({ ctx: { user: ctx.user } });
});
