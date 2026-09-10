// todos 테이블 접근 함수 (Prisma 버전). main 브랜치의 SQL 문자열 버전과 비교해 보자.
//
// [무엇이 사라졌나]
// - TodoRow 타입: Prisma 가 생성한 타입(prisma.todo.findMany 의 반환 타입)을 쓰므로 손으로 적을 필요가 없다.
// - `IN (?, ?, ?)` 자리표시자 조립: `{ id: { in: ids } }` 한 줄.
// - `result.changes` 를 Number() 로 바꾸는 코드: updateMany/deleteMany 가 `{ count }` 를 돌려준다.
//
// [무엇이 남았나]
// - completed 의 0/1 → boolean 변환 (toTodo). SQLite 에 boolean 타입이 없어서 스키마가 Int 다.
// - connection(): 비동기라고 자동으로 "요청 시점" 이 되는 것은 아니므로 여전히 필요하다 (아래 getTodos 참고).
//
// 읽는 법: 각 함수 위에 main 의 SQL 을 주석으로 남겨 두었다.
import "server-only";
import { connection } from "next/server";
import { prisma } from "@/lib/prisma";

// 앱에서 사용하는 Todo 타입 (boolean). main 과 동일.
export type Todo = {
  id: number;
  title: string;
  completed: boolean;
  createdAt: string;
};

// Prisma 가 돌려주는 행의 모양 중 우리가 쓰는 부분. (생성된 타입을 그대로 써도 되지만 변환 함수 시그니처를 읽기 쉽게 적어 둠)
type TodoRecord = { id: number; title: string; completed: number; createdAt: string };

// DB 행(0/1) → 앱 타입(boolean). main 의 toTodo 와 같은 역할, 컬럼 이름만 camelCase 로 이미 바뀌어 있다.
function toTodo(t: TodoRecord): Todo {
  return { id: t.id, title: t.title, completed: t.completed === 1, createdAt: t.createdAt };
}

/**
 * 전체 목록 조회 (화면용). main: SELECT * FROM todos ORDER BY completed ASC, id DESC
 *
 * `await connection()` 의 역할은 main 브랜치 README 1-1 과 같다: 요청이 온 다음에 실행되게 해서
 * 빌드 시점에 결과가 HTML 에 굳지 않도록 한다.
 * Prisma 쿼리는 비동기지만, "비동기 = 요청 시점" 이 아니다. 캐시되지 않은 비동기 작업도 프리렌더 중에
 * 실행될 수 있으므로 connection() 이 여전히 필요하다.
 */
export async function getTodos(): Promise<Todo[]> {
  await connection();
  // orderBy 에 배열을 주면 여러 기준으로 정렬한다: 미완료 먼저, 그 안에서 최신순
  const rows = await prisma.todo.findMany({ orderBy: [{ completed: "asc" }, { id: "desc" }] });
  return rows.map(toTodo);
}

/**
 * 공개 API(/api/v1/todos)용 목록. offset 페이지네이션 + 완료 여부 필터.
 * main: SELECT COUNT(*) ... WHERE completed = ?  /  SELECT * ... LIMIT ? OFFSET ?
 */
export async function listTodos(
  completed: boolean | null,
  limit: number,
  offset: number,
): Promise<{ todos: Todo[]; total: number }> {
  // where 를 객체로 만들어 두 쿼리에 같이 쓴다. null 이면 빈 객체 = 조건 없음
  const where = completed === null ? {} : { completed: completed ? 1 : 0 };
  // 개수와 목록은 서로 독립이라 Promise.all 로 동시에 보낸다
  const [total, rows] = await Promise.all([
    prisma.todo.count({ where }),
    prisma.todo.findMany({ where, orderBy: { id: "desc" }, take: limit, skip: offset }), // take = LIMIT, skip = OFFSET
  ]);
  return { todos: rows.map(toTodo), total };
}

// main: SELECT * FROM todos WHERE id = ?
export async function findTodo(id: number): Promise<Todo | null> {
  if (!Number.isInteger(id)) return null; // NaN 방어 (users.ts 의 findUserById 와 같은 이유)
  const t = await prisma.todo.findUnique({ where: { id } });
  return t ? toTodo(t) : null;
}

// main: INSERT INTO todos (title) VALUES (?) RETURNING *
export async function createTodo(title: string): Promise<Todo> {
  return toTodo(await prisma.todo.create({ data: { title } })); // create 는 만든 행 전체를 돌려준다
}

// main: UPDATE todos SET completed = ? WHERE id = ?
export async function setTodoCompleted(id: number, completed: boolean): Promise<void> {
  await prisma.todo.update({ where: { id }, data: { completed: completed ? 1 : 0 } });
}

// main: UPDATE todos SET title = ? WHERE id = ?
export async function updateTodoTitle(id: number, title: string): Promise<void> {
  await prisma.todo.update({ where: { id }, data: { title } });
}

// main: DELETE FROM todos WHERE id = ?
export async function deleteTodo(id: number): Promise<void> {
  // delete({ where: { id } }) 는 행이 없으면 예외(P2025)를 던진다. main 처럼 "없어도 조용히" 지나가려면 deleteMany
  await prisma.todo.deleteMany({ where: { id } });
}

// main: UPDATE todos SET completed = ? WHERE id IN (?, ?, ...)  ← 자리표시자를 ids 개수만큼 조립했다
export async function setTodosCompleted(ids: number[], completed: boolean): Promise<number> {
  if (ids.length === 0) return 0;
  const r = await prisma.todo.updateMany({ where: { id: { in: ids } }, data: { completed: completed ? 1 : 0 } });
  return r.count; // 바뀐 행 수. main 의 Number(result.changes)
}

// main: DELETE FROM todos WHERE id IN (?, ?, ...)
export async function deleteTodos(ids: number[]): Promise<number> {
  if (ids.length === 0) return 0;
  const r = await prisma.todo.deleteMany({ where: { id: { in: ids } } });
  return r.count;
}

// main: DELETE FROM todos WHERE completed = 1
export async function deleteCompletedTodos(): Promise<number> {
  const r = await prisma.todo.deleteMany({ where: { completed: 1 } });
  return r.count;
}
