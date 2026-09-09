// GET  /api/v1/todos — 할 일 목록 (누구나). ?completed=true|false 로 거를 수 있다
// POST /api/v1/todos — 할 일 추가 (인증 필요)
//
// todos 테이블에는 작성자 컬럼이 없다 (이 앱에서 할 일 목록은 모두가 공유하는 하나의 목록이다).
// 그래서 "본인 것만" 같은 소유권 검사가 없고, 로그인 여부만 본다. posts 와 비교해서 보면
// 스키마에 소유자가 있느냐 없느냐가 권한 설계를 어떻게 바꾸는지 드러난다.
import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/api/auth";
import { ok, okList, paginationOf, parseJsonBody, parseQuery } from "@/lib/api/http";
import { apiRoute } from "@/lib/api/route";
import { serializeTodo } from "@/lib/api/serialize";
import { todoCreateSchema, todoListQuerySchema } from "@/lib/schemas/api";
import { createTodo, listTodos, setTodoCompleted } from "@/lib/todos";

export const GET = apiRoute(async ({ request }) => {
  const { completed, limit, offset } = parseQuery(request.nextUrl, todoListQuerySchema);
  // 쿼리에 없으면 null(전체), 있으면 boolean 으로
  const filter = completed === undefined ? null : completed === "true";

  const { todos, total } = listTodos(filter, limit, offset);
  return okList(todos.map(serializeTodo), paginationOf(total, limit, offset, todos.length));
});

export const POST = apiRoute(async ({ request, auth }) => {
  requireAuth(auth);
  const { title, completed } = await parseJsonBody(request, todoCreateSchema);

  const todo = createTodo(title);
  // createTodo 는 미완료로만 만든다. completed: true 로 만들어 달라고 하면 한 번 더 갱신한다.
  if (completed) setTodoCompleted(todo.id, true);

  // /todos 화면은 "use cache" 가 아니라 revalidatePath 로 갱신한다 (src/app/todos/actions.ts 와 같은 방식).
  // Route Handler 에서 부르면 "다음에 그 경로를 방문할 때" 다시 렌더링된다.
  revalidatePath("/todos");

  return ok(serializeTodo({ ...todo, completed: completed ?? false }), 201, {
    Location: `${request.nextUrl.origin}/api/v1/todos/${todo.id}`,
  });
});
