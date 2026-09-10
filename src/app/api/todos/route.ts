// Route Handler: /api/todos 주소로 들어오는 HTTP 요청을 처리하는 REST API.
// 파일 이름이 route.ts 이면 Next.js 가 이 폴더 경로를 API 엔드포인트로 만든다.
// 외부에 제대로 열어 주는 API 는 /api/v1 (Part 5) 에 따로 있다. 이 파일은 "Route Handler 가 무엇인지" 보는 최소 예다.
import { getTodos } from "@/lib/todos";

// GET /api/todos → 전체 목록을 JSON 으로 응답
// SQL 은 src/lib/todos.ts 에만 두는 규칙을 지키기 위해 getTodos() 를 재사용한다.
// getTodos 안의 connection() 덕분에 Cache Components 에서도 빌드 시 정적으로 굳지 않고 요청마다 실행된다.
export async function GET() {
  const todos = await getTodos();
  return Response.json(todos);
}
