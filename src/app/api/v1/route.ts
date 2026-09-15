// GET /api/v1 — API 진입점(디스커버리). 외부 개발자가 처음 열어 보는 주소다.
//
// 요청 정보를 전혀 읽지 않으므로 Cache Components 가 이 핸들러를 빌드 시점에 미리 만들어 둔다.
// `npm run build` 결과에서 이 라우트만 ○(정적)으로 표시되는 것을 확인해 보면 좋다.
// 나머지 /api/v1/* 는 Authorization 헤더를 읽기 때문에 전부 ƒ(요청마다 실행)이다.
export function GET() {
  return Response.json({
    name: "next-js-study-app Public API",
    version: "1.0.0",
    documentation: "/api/v1/openapi.json",
    authentication: {
      scheme: "Authorization: Bearer <토큰>",
      accessToken: "POST /api/v1/auth/token (이메일 + 비밀번호). 1시간 유효",
      refreshToken: "로그인 응답에 함께 옴 (rt_ 로 시작, 30일). POST /api/v1/auth/refresh 본문으로 보내 새 쌍을 받는다. 한 번 쓰면 소비(회전), 재사용 시 세션 전체 폐기",
      apiKey: "POST /api/v1/auth/keys (액세스 토큰 필요). sk_ 로 시작, 만료 없음, 폐기 가능",
      note: "세션 쿠키는 받지 않는다. 읽기는 공개, 쓰기는 인증 필요.",
    },
    rateLimit: { anonymous: "60 req/min", authenticated: "600 req/min", headers: "X-RateLimit-*" },
    endpoints: {
      auth: [
        "POST   /api/v1/auth/register",
        "POST   /api/v1/auth/token",
        "POST   /api/v1/auth/refresh",
        "POST   /api/v1/auth/logout",
        "GET    /api/v1/auth/me",
        "GET    /api/v1/auth/keys",
        "POST   /api/v1/auth/keys",
        "DELETE /api/v1/auth/keys/:id",
      ],
      posts: [
        "GET    /api/v1/posts?q=&limit=&offset=",
        "POST   /api/v1/posts",
        "GET    /api/v1/posts/:id",
        "PATCH  /api/v1/posts/:id",
        "DELETE /api/v1/posts/:id",
      ],
      comments: [
        "GET    /api/v1/posts/:id/comments",
        "POST   /api/v1/posts/:id/comments",
        "DELETE /api/v1/comments/:id",
      ],
      todos: [
        "GET    /api/v1/todos?completed=&limit=&offset=",
        "POST   /api/v1/todos",
        "GET    /api/v1/todos/:id",
        "PATCH  /api/v1/todos/:id",
        "DELETE /api/v1/todos/:id",
      ],
    },
  }, { headers: { "Content-Type": "application/json; charset=utf-8" } }); // Safari 에서 그대로 열어도 한글이 깨지지 않게 charset 명시
}
