// 공개 API(/api/v1) 요청 본문·쿼리 검증 스키마.
//
// 화면(Server Action)에서 쓰는 스키마를 그대로 재사용한다. 검증 규칙이 한 벌이어야
// "웹에서는 되는데 API 로는 안 되는" 불일치가 생기지 않는다.
// API 에만 있는 규칙(페이지네이션 한도 등)만 여기에 새로 정의한다.
import { z } from "zod";
import { loginSchema, signupSchema } from "@/lib/schemas/auth";
import { commentSchema } from "@/lib/schemas/comment";
import { postSchema } from "@/lib/schemas/post";

/** 한 번에 가져갈 수 있는 최대 개수. 상한이 없으면 limit=1000000 한 방에 DB 가 넘어간다. */
export const MAX_LIMIT = 50;
export const DEFAULT_LIMIT = 20;

/**
 * 목록 공통 쿼리. 쿼리스트링은 전부 문자열이라 coerce 로 숫자 변환을 맡긴다.
 * 잘못된 값은 조용히 기본값으로 바꾸지 않고 422 로 알려 준다 ("왜 결과가 이상하지?" 를 없앤다).
 */
export const listQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(MAX_LIMIT).default(DEFAULT_LIMIT),
  offset: z.coerce.number().int().min(0).default(0),
});

/** 글 목록: 공통 쿼리 + 검색어 */
export const postListQuerySchema = listQuerySchema.extend({
  q: z.string().trim().max(100).optional(),
});

/** 할 일 목록: 공통 쿼리 + 완료 여부 필터 (?completed=true) */
export const todoListQuerySchema = listQuerySchema.extend({
  completed: z.enum(["true", "false"]).optional(),
});

// ---------------------------------------------------------------------------
// posts
// ---------------------------------------------------------------------------

/** 생성은 화면의 글쓰기 폼과 완전히 같은 규칙 */
export const postCreateSchema = postSchema;

/**
 * 수정은 부분 변경(PATCH)이라 모든 필드가 선택. 다만 전부 비면 할 일이 없으므로 막는다.
 * PUT(전체 교체) 대신 PATCH 를 쓰는 이유: 제목만 바꾸려고 본문 전체를 다시 보내지 않아도 된다.
 */
export const postUpdateSchema = postSchema
  .partial()
  .refine((v) => v.title !== undefined || v.content !== undefined, {
    message: "title 또는 content 중 하나는 있어야 합니다.",
  });

// ---------------------------------------------------------------------------
// comments
// ---------------------------------------------------------------------------

/** parentId 가 있으면 답글. 2단까지만 허용하는 검사는 라우트에서 한다 (DB 를 봐야 알 수 있으므로). */
export const commentCreateSchema = commentSchema.extend({
  parentId: z.coerce.number().int().positive().nullable().optional(),
});

// ---------------------------------------------------------------------------
// todos
// ---------------------------------------------------------------------------

// 길이 제한은 src/app/todos/actions.ts 의 손 검증과 같은 값으로 맞춘다.
const todoTitle = z.string().trim().min(1, "할 일을 입력하세요.").max(200, "할 일은 200자 이하로 입력하세요.");

export const todoCreateSchema = z.object({
  title: todoTitle,
  completed: z.boolean().default(false),
});

export const todoUpdateSchema = z
  .object({ title: todoTitle.optional(), completed: z.boolean().optional() })
  .refine((v) => v.title !== undefined || v.completed !== undefined, {
    message: "title 또는 completed 중 하나는 있어야 합니다.",
  });

// ---------------------------------------------------------------------------
// auth
// ---------------------------------------------------------------------------

export const registerSchema = signupSchema; // 화면 회원가입과 같은 규칙
export const tokenSchema = loginSchema; // 이메일 + 비밀번호

export const apiKeyCreateSchema = z.object({
  name: z.string().trim().min(1, "키 이름을 입력하세요.").max(50, "키 이름은 50자 이하로 입력하세요."),
});
