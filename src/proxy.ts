// Proxy: 모든 요청이 라우트에 도달하기 "전에" 실행된다 (예전 이름: middleware).
// 여기서 두 가지를 한다.
//  1. /api/v1 (공개 API) 의 CORS 처리
//  2. 인증 상태에 따른 낙관적(optimistic) 리다이렉트
//
// 주의: 2번은 편의 기능이지 보안 경계가 아니다. 쿠키만 보고 판단하며 DB 는 조회하지 않는다.
// 실제 권한 검사는 데이터 가까이(Server Action, 서버 컴포넌트, Route Handler)에서 다시 한다.
import { NextResponse, type NextRequest } from "next/server";
import { decrypt } from "@/lib/session";

// ---------------------------------------------------------------------------
// CORS: 다른 도메인의 브라우저 코드가 이 API 를 부를 수 있게 한다.
//
// Origin 을 "*" 로 열어도 되는 이유: 이 API 는 쿠키를 전혀 보지 않고 Authorization 헤더만 본다.
// 브라우저는 쿠키를 자동으로 붙이지만 Authorization 헤더는 붙이지 않으므로,
// 남의 사이트가 우리 사용자의 브라우저를 시켜 요청을 보내도 인증되지 않은 요청이 된다.
// (반대로 쿠키 인증을 함께 받는다면 "*" 는 절대 안 되고, 허용 도메인을 하나씩 나열하고
//  Access-Control-Allow-Credentials 를 켜야 한다.)
// ---------------------------------------------------------------------------
const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  // 브라우저 JS 는 기본적으로 몇 개 헤더밖에 못 읽는다. 남은 요청 수를 읽을 수 있게 열어 준다.
  "Access-Control-Expose-Headers": "X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset, Retry-After",
  "Access-Control-Max-Age": "86400", // 프리플라이트 결과를 하루 캐시 (매 요청마다 왕복 2번 하지 않도록)
};

function withCors(response: NextResponse): NextResponse {
  for (const [name, value] of Object.entries(CORS_HEADERS)) response.headers.set(name, value);
  return response;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // --- 1. 공개 API ---
  if (pathname.startsWith("/api/v1")) {
    // 프리플라이트: 브라우저가 "이 메서드/헤더로 보내도 되나?" 를 먼저 묻는 OPTIONS 요청.
    // 라우트까지 갈 필요 없이 여기서 바로 답한다.
    if (request.method === "OPTIONS") {
      return withCors(new NextResponse(null, { status: 204 }));
    }
    // 실제 요청은 그대로 흘려보내되 응답에 CORS 헤더만 얹는다.
    return withCors(NextResponse.next());
  }

  // --- 2. 화면 리다이렉트 ---
  const session = await decrypt(request.cookies.get("session")?.value);
  const isLoggedIn = !!session?.userId;

  // 로그인이 필요한 경로: 글 수정 페이지
  const needsAuth = /^\/posts\/[^/]+\/edit$/.test(pathname);
  if (needsAuth && !isLoggedIn) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname); // 로그인 후 돌아올 곳 (학습용, 현재는 사용 안 함)
    return NextResponse.redirect(loginUrl);
  }

  // 이미 로그인한 사용자가 로그인/가입 페이지로 오면 글 목록으로
  if (isLoggedIn && (pathname === "/login" || pathname === "/signup")) {
    return NextResponse.redirect(new URL("/posts", request.url));
  }

  return NextResponse.next();
}

// 필요한 경로에서만 실행 (정적 파일, 이미지 등은 제외해서 불필요한 부하를 막는다)
export const config = {
  matcher: ["/login", "/signup", "/posts/:id/edit", "/api/v1", "/api/v1/:path*"],
};
