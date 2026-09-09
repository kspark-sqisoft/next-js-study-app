// 공개 API 라우트 핸들러를 감싸는 래퍼.
//
// 모든 엔드포인트가 똑같이 해야 하는 일 — 인증, 레이트 리밋, 에러 → JSON 변환 — 을 한 곳에 모은다.
// 덕분에 각 route.ts 파일에는 "그 엔드포인트만의 로직" 만 남는다.
//
//   export const GET = apiRoute(async ({ params }) => ok(...));
import "server-only";
import { unstable_rethrow } from "next/navigation";
import type { NextRequest } from "next/server";
import { authenticate, clientIp, type Principal } from "@/lib/api/auth";
import { ApiError, errorResponse } from "@/lib/api/http";
import { checkRateLimit, WINDOW_SECONDS, type RateLimitResult } from "@/lib/api/rate-limit";

/** 분당 허용 요청 수. 인증된 요청에 더 넉넉하게 준다 (누가 쓰는지 알고, 문제가 생기면 키를 폐기할 수 있으므로). */
const ANONYMOUS_LIMIT = 60;
const AUTHENTICATED_LIMIT = 600;

/** 핸들러가 받는 것. Next.js 의 (request, context) 를 풀어서 전달한다. */
export type ApiContext<P> = {
  request: NextRequest;
  /** 동적 세그먼트. Next.js 16 에서 params 는 Promise 라서 여기서 미리 await 해 둔다. */
  params: P;
  /** 인증 결과. 헤더가 없으면 null (익명). requireAuth(auth) 로 필수화한다. */
  auth: Principal | null;
};

type Handler<P> = (context: ApiContext<P>) => Response | Promise<Response>;

function rateLimitHeaders(rate: RateLimitResult): Record<string, string> {
  // 이름은 사실상의 표준. 클라이언트가 남은 횟수를 보고 스스로 속도를 조절할 수 있다.
  return {
    "X-RateLimit-Limit": String(rate.limit),
    "X-RateLimit-Remaining": String(rate.remaining),
    "X-RateLimit-Reset": String(rate.resetAt),
  };
}

export function apiRoute<P extends Record<string, string> = Record<string, never>>(handler: Handler<P>) {
  return async function handle(request: NextRequest, context?: { params: Promise<P> }): Promise<Response> {
    let headers: Record<string, string> = {};
    try {
      // 1. 인증 먼저. 누구인지 알아야 레이트 리밋을 사용자 단위로 걸 수 있다.
      //    (반대로 하면 같은 사무실에서 나가는 모든 요청이 IP 하나의 몫을 나눠 쓰게 된다)
      const auth = await authenticate(request);

      // 2. 레이트 리밋
      const identity = auth ? `user:${auth.user.id}` : `ip:${clientIp(request)}`;
      const rate = checkRateLimit(identity, auth ? AUTHENTICATED_LIMIT : ANONYMOUS_LIMIT);
      headers = rateLimitHeaders(rate);
      if (!rate.ok) {
        const retryAfter = Math.max(1, rate.resetAt - Math.floor(Date.now() / 1000));
        throw new ApiError(
          "rate_limited",
          `요청이 너무 많습니다. ${WINDOW_SECONDS}초당 ${rate.limit}회까지 허용됩니다.`,
          undefined,
          { "Retry-After": String(retryAfter) },
        );
      }

      // 3. 실제 핸들러
      const params = context?.params ? await context.params : ({} as P);
      const response = await handler({ request, params, auth });
      for (const [name, value] of Object.entries(headers)) response.headers.set(name, value);
      return response;
    } catch (error) {
      // Next.js 내부 제어용 에러(redirect 등)는 우리가 삼키면 안 된다
      unstable_rethrow(error);

      if (error instanceof ApiError) return errorResponse(error, headers);

      // 예상 못 한 예외. 원인은 서버 로그에만 남기고 클라이언트에는 일반적인 문구만 준다.
      // 스택 트레이스나 SQL 문구가 응답에 섞이면 내부 구조가 그대로 노출된다.
      console.error("[api] unhandled error", error);
      return errorResponse(new ApiError("internal_error", "서버에서 오류가 발생했습니다."), headers);
    }
  };
}
