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
 * 전체 목록 조회.
 * node:sqlite 는 동기 드라이버라 그냥 호출하면 빌드 시점에 실행되어 결과가 HTML 에 굳어버린다.
 * `await connection()` 을 먼저 두면 "요청이 들어온 뒤"에 실행되므로 매 요청마다 최신 데이터를 읽는다 (SSR).
 */
export async function getTodos(): Promise<Todo[]> {
  await connection();
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

// 완료된 항목 일괄 삭제. 삭제된 행 수를 반환한다.
export function deleteCompletedTodos(): number {
  const result = db.prepare("DELETE FROM todos WHERE completed = 1").run();
  return Number(result.changes);
}
