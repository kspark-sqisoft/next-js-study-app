// 서버 전용. todos 테이블에 대한 데이터 접근 함수 모음 (SQL 은 여기에만 둔다).
import "server-only";
import { connection } from "next/server";
import { db } from "@/lib/db";

// 앱에서 사용하는 Todo 타입 (camelCase, boolean)
export type Todo = {
  id: number;
  title: string;
  completed: boolean;
  createdAt: string;
};

// DB 에서 그대로 읽힌 행의 타입 (snake_case, 0/1)
type TodoRow = {
  id: number;
  title: string;
  completed: number;
  created_at: string;
};

// DB 행 → 앱 타입 변환
function toTodo(row: TodoRow): Todo {
  return {
    id: row.id,
    title: row.title,
    completed: row.completed === 1,
    createdAt: row.created_at,
  };
}

/**
 * 전체 목록 조회. 이 함수의 핵심은 첫 줄의 `await connection()` 이다.
 *
 * [왜 필요한가]
 * Next.js 는 `npm run build` 때 모든 페이지를 한 번 실행해 보고, 미리 만들 수 있으면 HTML 로 굳혀 둔다(SSG).
 * "요청마다 새로 만들어야 하는 페이지" 는 cookies()/headers()/searchParams 처럼 요청이 있어야 값이 생기는
 * API 를 쓰는지로 판단한다. 그런데 아래의 db.prepare().all() 은 쿠키도 헤더도 안 쓰는 동기 함수 호출이라,
 * Next.js 눈에는 JSON.parse 나 fs.readFileSync 같은 "언제 실행해도 같은 계산" 으로 보인다.
 * 그래서 connection() 이 없으면 빌드 시점에 한 번 실행되고, 그때의 todo 목록이 HTML 에 박힌 채
 * 이후 요청에도 그대로 나간다. (revalidatePath 로 다시 만들기 전까지는 DB 가 바뀌어도 화면이 안 바뀐다)
 *
 * [connection() 이 하는 일]
 * "이 줄 아래는 실제 사용자 요청(connection)이 들어온 다음에 실행하라" 는 신호다.
 * 빌드 시점의 프리렌더에서는 여기서 멈추고(suspend) 아래를 실행하지 않는다. 요청이 오면 즉시 통과한다.
 * 요청 데이터를 읽을 필요는 없지만 요청 시점에 실행되어야 하는 코드(Math.random, new Date, 동기 DB 드라이버)를
 * 위한 함수이며, 결과적으로 이 페이지를 빌드 시점 렌더링(SSG)에서 요청 시점 렌더링(SSR)으로 바꾼다.
 *
 * [Cache Components 와의 관계]
 * connection() 아래 코드는 정적 셸에 들어갈 수 없으므로 반드시 <Suspense> 안에서 호출되어야 한다.
 * /todos 는 loading.tsx 가 페이지 전체를 Suspense 로 감싸 주기 때문에 빌드 표에 "◐ Partial Prerender" 로 나온다
 * (셸은 정적, 목록만 요청 시점에 스트리밍).
 *
 * [실험] 이 줄을 지우고 npm run build → /todos 가 "○ Static" 이 되고, DB 를 바꿔도 화면이 안 변한다.
 */
export async function getTodos(): Promise<Todo[]> {
  await connection(); // 프리렌더에서는 여기서 멈춤. 요청 시점에만 아래가 실행된다
  const rows = db
    .prepare("SELECT * FROM todos ORDER BY completed ASC, id DESC") // 미완료 먼저, 최신순
    .all() as TodoRow[];
  return rows.map(toTodo);
}

/**
 * 공개 API(/api/v1/todos) 용 목록. completed 로 거를 수 있고 전체 개수를 함께 돌려준다.
 * getTodos() 와 달리 connection() 이 없다 — Route Handler 는 Authorization 헤더를 읽는 순간
 * 이미 "요청마다 실행" 으로 확정되므로 따로 알려 줄 필요가 없다.
 */
export function listTodos(
  completed: boolean | null,
  limit: number,
  offset: number,
): { todos: Todo[]; total: number } {
  const where = completed === null ? "" : "WHERE completed = ?";
  const params = completed === null ? [] : [completed ? 1 : 0];

  const { total } = db
    .prepare(`SELECT COUNT(*) AS total FROM todos ${where}`)
    .get(...params) as { total: number };

  const rows = db
    .prepare(`SELECT * FROM todos ${where} ORDER BY id DESC LIMIT ? OFFSET ?`)
    .all(...params, limit, offset) as TodoRow[];

  return { todos: rows.map(toTodo), total };
}

/** 단건 조회. 없으면 null (API 에서 404 로 바꾼다). */
export function findTodo(id: number): Todo | null {
  const row = db.prepare("SELECT * FROM todos WHERE id = ?").get(id) as TodoRow | undefined;
  return row ? toTodo(row) : null;
}

// 새 할 일 추가. RETURNING * 로 방금 넣은 행을 바로 받는다.
export function createTodo(title: string): Todo {
  const row = db
    .prepare("INSERT INTO todos (title) VALUES (?) RETURNING *")
    .get(title) as TodoRow;
  return toTodo(row);
}

// 완료 여부 변경
export function setTodoCompleted(id: number, completed: boolean): void {
  db.prepare("UPDATE todos SET completed = ? WHERE id = ?").run(
    completed ? 1 : 0,
    id,
  );
}

// 제목 변경
export function updateTodoTitle(id: number, title: string): void {
  db.prepare("UPDATE todos SET title = ? WHERE id = ?").run(title, id);
}

// 단건 삭제
export function deleteTodo(id: number): void {
  db.prepare("DELETE FROM todos WHERE id = ?").run(id);
}

// 여러 건의 완료 여부 일괄 변경. SQL 의 IN (?, ?, ...) 자리표시자를 id 개수만큼 만든다.
export function setTodosCompleted(ids: number[], completed: boolean): number {
  if (ids.length === 0) return 0;
  const placeholders = ids.map(() => "?").join(", ");
  const result = db
    .prepare(`UPDATE todos SET completed = ? WHERE id IN (${placeholders})`)
    .run(completed ? 1 : 0, ...ids);
  return Number(result.changes);
}

// 여러 건 일괄 삭제
export function deleteTodos(ids: number[]): number {
  if (ids.length === 0) return 0;
  const placeholders = ids.map(() => "?").join(", ");
  const result = db.prepare(`DELETE FROM todos WHERE id IN (${placeholders})`).run(...ids);
  return Number(result.changes);
}

// 완료된 항목 일괄 삭제. 삭제된 행 수를 반환한다.
export function deleteCompletedTodos(): number {
  const result = db.prepare("DELETE FROM todos WHERE completed = 1").run();
  return Number(result.changes);
}
