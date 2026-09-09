// 공개 API 라우트 테스트용 헬퍼.
// Route Handler 는 (Request) => Response 인 함수라서, 서버를 띄우지 않고 직접 호출해 테스트한다.
import { NextRequest } from "next/server";

type Options = {
  method?: string;
  /** JSON 본문. 주면 Content-Type: application/json 이 자동으로 붙는다 */
  body?: unknown;
  /** Authorization: Bearer 에 넣을 값 (액세스 토큰 또는 API 키) */
  token?: string;
  /** Content-Type 을 일부러 틀리게 보내는 테스트용 */
  contentType?: string | null;
};

/** http://localhost 를 붙여 절대 URL 로 만든다 (NextRequest 는 절대 URL 을 요구한다). */
export function apiRequest(path: string, options: Options = {}): NextRequest {
  const { method = "GET", body, token, contentType } = options;
  const headers = new Headers();

  if (body !== undefined && contentType !== null) {
    headers.set("content-type", contentType ?? "application/json");
  }
  if (token) headers.set("authorization", `Bearer ${token}`);

  return new NextRequest(`http://localhost${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

/** 동적 세그먼트가 있는 라우트에 넘길 context. Next.js 16 에서 params 는 Promise 다. */
export function routeParams<P extends Record<string, string>>(params: P) {
  return { params: Promise.resolve(params) };
}
