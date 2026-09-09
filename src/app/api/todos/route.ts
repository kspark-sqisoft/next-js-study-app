// Route Handler: /api/todos 주소로 들어오는 HTTP 요청을 처리하는 REST API.
// 파일 이름이 route.ts 이면 Next.js 가 이 폴더 경로를 API 엔드포인트로 만든다.
// 외부 시스템이나 다른 프론트엔드가 우리 DB 데이터를 쓰게 하려면 이 방식을 확장한다.
import { connection } from "next/server";
import { db } from "@/lib/db";

// GET /api/todos → 전체 목록을 JSON 으로 응답
// (현재는 DB 연결 동작 확인용. POST/PATCH/DELETE 를 추가하면 CRUD API 가 된다.)
export async function GET() {
  // Cache Components 에서는 요청 정보를 전혀 안 쓰는 GET 핸들러를 빌드 시 정적으로 만들어 버린다.
  // connection() 을 기다려 "요청이 올 때마다 실행" 되도록 명시한다.
  await connection();
  const todos = db.prepare("SELECT * FROM todos ORDER BY id DESC").all();
  return Response.json(todos);
}
