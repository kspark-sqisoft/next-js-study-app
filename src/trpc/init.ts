// tRPC 초기화 파일. 이 브랜치에서 tRPC 를 쓰는 모든 코드의 출발점이다.
//
// [tRPC 가 무엇인가]
// 서버에 "프로시저(= 함수)" 를 정의하면, 클라이언트가 그 함수의 입력/출력 타입을 그대로 가져다 쓰는 RPC 라이브러리.
// REST(main 브랜치의 /api/posts)는 URL·쿼리스트링·응답 JSON 모양을 서버와 클라이언트가 각자 손으로 맞춰야 했다.
// tRPC 는 서버의 라우터 "타입" 하나가 양쪽의 계약이 되므로, 서버 코드를 바꾸면 클라이언트 컴파일이 깨져서 알려 준다.
//
// [main 브랜치와 비교]
// - main: Server Action(src/app/posts/actions.ts) 안에서 매번 getCurrentUser() 로 로그인 검사, safeParse 로 입력 검증,
//         { error } 객체 반환. 조회는 Route Handler + fetch.
// - 여기: 로그인 검사는 미들웨어(protectedProcedure) 한 곳, 입력 검증은 .input(zod), 에러는 TRPCError 코드.
//         조회와 변경 모두 같은 라우터에 정의된다.
//
// [이 파일이 만드는 것]
// 1. createTRPCContext : 요청마다 만들어지는 공용 정보(로그인 사용자)
// 2. createTRPCRouter  : 프로시저들을 묶는 함수
// 3. publicProcedure   : 누구나 부를 수 있는 프로시저 빌더
// 4. protectedProcedure: 로그인이 필요한 프로시저 빌더 (미들웨어가 붙어 있다)
import { initTRPC, TRPCError } from "@trpc/server";
import { cache } from "react";
import superjson from "superjson";
import { getCurrentUser } from "@/lib/dal";

/**
 * 컨텍스트(ctx): 모든 프로시저가 두 번째 인자 { ctx } 로 받는 요청 단위 정보.
 * 여기서는 "지금 요청을 보낸 사용자" 하나만 담는다. DB 연결 같은 것도 여기에 넣는 것이 관례다.
 *
 * - getCurrentUser() 는 main 브랜치의 DAL(src/lib/dal.ts) 그대로다: 쿠키 → 세션 검증 → users 테이블 조회.
 * - React 의 cache() 로 감싼 이유: 한 요청 안에서 서버 컴포넌트의 prefetch 와 Route Handler 가 컨텍스트를
 *   여러 번 만들어도 쿠키 검증과 DB 조회는 한 번만 하게 하려고. (dal.ts 의 getCurrentUser 도 같은 기법을 쓴다)
 * - 로그아웃 상태면 user 가 null 이다. "로그인 필수" 는 여기서 판단하지 않고 protectedProcedure 가 한다.
 *   (조회 프로시저는 로그아웃 상태에서도 되어야 하므로)
 */
export const createTRPCContext = cache(async () => {
  const user = await getCurrentUser(); // 쿠키 → 세션 → 사용자. 로그아웃이면 null
  return { user };
});

/** 컨텍스트의 타입. Awaited<ReturnType<...>> 로 함수 반환값에서 뽑아내므로 따로 적지 않아도 된다 */
export type Context = Awaited<ReturnType<typeof createTRPCContext>>;

/**
 * initTRPC: tRPC 인스턴스 생성. .context<Context>() 로 "모든 프로시저의 ctx 는 이 타입" 이라고 알려 준다.
 *
 * transformer: superjson
 *   JSON 은 Date, Map, Set, undefined, BigInt 를 표현하지 못한다. 예를 들어 서버가 new Date() 를 돌려주면
 *   브라우저에는 문자열로 도착한다. superjson 은 이런 값에 타입 표시를 붙여 직렬화하고 클라이언트에서 원래대로 복원한다.
 *   서버(여기)와 클라이언트(client.tsx 의 httpBatchLink) 가 같은 transformer 를 써야 한다. 한쪽만 쓰면 파싱 에러.
 */
const t = initTRPC.context<Context>().create({
  transformer: superjson,
});

/** 라우터 생성 함수. routers/_app.ts 와 routers/*.ts 에서 프로시저들을 객체로 묶을 때 쓴다 */
export const createTRPCRouter = t.router;

/** HTTP 없이 라우터를 함수처럼 부르는 "caller" 를 만드는 공장. 테스트(router.test.ts)와 server.tsx 에서 쓴다 */
export const createCallerFactory = t.createCallerFactory;

/**
 * 공개 프로시저. 로그인 여부를 따지지 않는다.
 * 조회(posts.list, posts.search, comments.list)처럼 로그아웃 상태에서도 되어야 하는 것에 쓴다.
 * ctx.user 는 User | null 타입이다.
 */
export const publicProcedure = t.procedure;

/**
 * 로그인 필수 프로시저. .use(미들웨어) 로 검사를 끼워 넣는다.
 *
 * 미들웨어의 동작:
 * 1. ctx.user 가 null 이면 TRPCError 를 던진다. 프로시저 본문은 실행되지 않는다.
 *    code 는 HTTP 상태로 변환된다: UNAUTHORIZED → 401, FORBIDDEN → 403, NOT_FOUND → 404, BAD_REQUEST → 400.
 *    클라이언트에서는 error.data.code 와 error.message 로 읽는다 (comment-form.tsx 의 onError 참고).
 * 2. next({ ctx: { user: ctx.user } }) 로 다음 단계에 넘기면서 ctx 를 "덮어쓴다".
 *    TypeScript 는 이 덮어쓴 ctx 에서 user 가 null 이 아니라고 추론한다(타입 좁히기).
 *    그래서 protectedProcedure 를 쓰는 프로시저 본문에서는 ctx.user.id 를 `!` 없이 바로 쓸 수 있다.
 *
 * main 브랜치와 비교: Server Action 마다 `const user = await getCurrentUser(); if (!user) return { error }` 를
 * 반복했다. 여기서는 검사가 한 곳에 있고, 프로시저 정의에 protectedProcedure 라고 적는 것 자체가 문서가 된다.
 */
export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "로그인이 필요합니다." });
  }
  return next({ ctx: { user: ctx.user } }); // 이 아래 프로시저들의 ctx.user 는 non-null
});
