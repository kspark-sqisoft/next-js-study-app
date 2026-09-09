// Proxy: 모든 요청이 라우트에 도달하기 "전에" 실행된다 (예전 이름: middleware).
// 여기서는 인증 상태에 따른 낙관적(optimistic) 리다이렉트만 한다.
//
// 주의: 이것은 편의 기능이지 보안 경계가 아니다. 쿠키만 보고 판단하며 DB 는 조회하지 않는다.
// 실제 권한 검사는 데이터 가까이(Server Action, 서버 컴포넌트)에서 세션을 다시 읽어서 한다.
import { NextResponse, type NextRequest } from "next/server";
import { decrypt } from "@/lib/session";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
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
  matcher: ["/login", "/signup", "/posts/:id/edit"],
};
