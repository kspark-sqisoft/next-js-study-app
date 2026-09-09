// GET /api/v1/openapi.json — 기계가 읽는 API 명세 (OpenAPI 3.1)
//
// 폴더 이름에 점(.)이 들어가도 된다. 폴더 경로가 그대로 URL 이 되므로
// app/api/v1/openapi.json/route.ts → /api/v1/openapi.json 이다 (rss.xml 등도 같은 방식).
//
// 이 문서를 그대로 Swagger UI 나 Postman 에 넣으면 문서와 클라이언트가 자동으로 생긴다:
//   npx @redocly/cli preview-docs http://localhost:3000/api/v1/openapi.json
import { openApiDocument } from "@/lib/api/openapi";

export function GET() {
  // 요청을 읽지 않으므로 이 라우트도 빌드 시점에 미리 만들어진다.
  return Response.json(openApiDocument);
}
