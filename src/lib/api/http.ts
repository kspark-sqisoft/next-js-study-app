// 공개 API(/api/v1)의 HTTP 규약을 한 곳에 모은 파일.
//
// 외부 개발자에게 API 를 열 때 가장 중요한 것은 "일관성" 이다.
// 어떤 엔드포인트를 부르든 성공/실패 응답의 모양이 같아야 클라이언트가 한 번만 처리를 짜면 된다.
//
//   성공(단건):  { "data": { ... } }
//   성공(목록):  { "data": [ ... ], "pagination": { total, limit, offset, hasMore } }
//   실패:        { "error": { "code": "not_found", "message": "...", "details": { ... } } }
//
// code 는 기계가 분기할 값(고정 문자열), message 는 사람이 읽을 설명이다.
// HTTP 상태 코드만으로는 "왜" 를 구분하기 어렵기 때문에 둘 다 준다.
import "server-only";
import { z } from "zod";

// ---------------------------------------------------------------------------
// 에러
// ---------------------------------------------------------------------------

/** 기계가 분기하는 에러 코드. 새 코드를 추가하면 문서(README)에도 함께 적는다. */
export type ApiErrorCode =
  | "bad_request"
  | "validation_failed"
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "conflict"
  | "unsupported_media_type"
  | "rate_limited"
  | "internal_error";

const STATUS_BY_CODE: Record<ApiErrorCode, number> = {
  bad_request: 400,
  validation_failed: 422,
  unauthorized: 401,
  forbidden: 403,
  not_found: 404,
  conflict: 409,
  unsupported_media_type: 415,
  rate_limited: 429,
  internal_error: 500,
};

/**
 * 라우트 어디에서든 throw 하면 apiRoute() 가 받아서 규약대로 된 JSON 응답으로 바꿔 준다.
 * 덕분에 핸들러 본문은 "성공 경로" 만 쓰면 되고 if/else 가 깊어지지 않는다.
 */
export class ApiError extends Error {
  constructor(
    readonly code: ApiErrorCode,
    message: string,
    readonly details?: unknown,
    /** 429 응답에 붙일 Retry-After 등 추가 헤더 */
    readonly headers?: Record<string, string>,
  ) {
    super(message);
    this.name = "ApiError";
  }

  get status(): number {
    return STATUS_BY_CODE[this.code];
  }
}

export const badRequest = (message: string) => new ApiError("bad_request", message);
export const unauthorized = (message = "인증이 필요합니다. Authorization: Bearer <토큰> 헤더를 보내세요.") =>
  new ApiError("unauthorized", message);
export const forbidden = (message = "이 리소스에 대한 권한이 없습니다.") => new ApiError("forbidden", message);
export const notFound = (message = "리소스를 찾을 수 없습니다.") => new ApiError("not_found", message);
export const conflict = (message: string) => new ApiError("conflict", message);

// ---------------------------------------------------------------------------
// 응답
// ---------------------------------------------------------------------------

export type Pagination = { total: number; limit: number; offset: number; hasMore: boolean };

function jsonResponse(body: unknown, status: number, headers?: Record<string, string>): Response {
  return Response.json(body, {
    status,
    headers: {
      // 공개 API 응답은 중간 캐시(CDN, 브라우저)가 보관하면 안 된다.
      // 응답 내용이 Authorization 헤더에 따라 달라지기 때문이다.
      "Cache-Control": "no-store",
      ...headers,
    },
  });
}

/** 단건 성공 응답. 기본 200, 생성이면 201 을 넘긴다. */
export function ok(data: unknown, status = 200, headers?: Record<string, string>): Response {
  return jsonResponse({ data }, status, headers);
}

/** 목록 성공 응답. 페이지 정보를 함께 담는다. */
export function okList(data: unknown[], pagination: Pagination, headers?: Record<string, string>): Response {
  return jsonResponse({ data, pagination }, 200, headers);
}

/** 본문 없는 성공 (삭제 등). 204 에는 본문을 실을 수 없다. */
export function noContent(headers?: Record<string, string>): Response {
  return new Response(null, { status: 204, headers: { "Cache-Control": "no-store", ...headers } });
}

export function errorResponse(error: ApiError, headers?: Record<string, string>): Response {
  return jsonResponse(
    { error: { code: error.code, message: error.message, ...(error.details ? { details: error.details } : {}) } },
    error.status,
    { ...headers, ...error.headers },
  );
}

// ---------------------------------------------------------------------------
// 요청 파싱
// ---------------------------------------------------------------------------

/**
 * JSON 본문을 읽어 Zod 스키마로 검증한다.
 * 실패 이유를 세 가지로 나눠서 알려 준다: Content-Type 이 틀림 / JSON 이 깨짐 / 값이 규칙에 안 맞음.
 * 화면의 Server Action 과 같은 스키마(src/lib/schemas/)를 재사용하므로 검증 규칙이 한 벌로 유지된다.
 */
export async function parseJsonBody<T>(request: Request, schema: z.ZodType<T>): Promise<T> {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    throw new ApiError("unsupported_media_type", "Content-Type: application/json 으로 보내세요.");
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    throw badRequest("본문이 올바른 JSON 이 아닙니다.");
  }

  const result = schema.safeParse(raw);
  if (!result.success) {
    // fieldErrors: { title: ["제목을 입력하세요."] } 형태. 클라이언트가 필드 옆에 바로 표시할 수 있다.
    throw new ApiError("validation_failed", "입력값이 올바르지 않습니다.", z.flattenError(result.error).fieldErrors);
  }
  return result.data;
}

/** 쿼리스트링을 Zod 스키마로 검증한다 (limit, offset 등). */
export function parseQuery<T>(url: URL, schema: z.ZodType<T>): T {
  const result = schema.safeParse(Object.fromEntries(url.searchParams));
  if (!result.success) {
    throw new ApiError("validation_failed", "쿼리 파라미터가 올바르지 않습니다.", z.flattenError(result.error).fieldErrors);
  }
  return result.data;
}

/** 경로의 [id] 는 항상 문자열로 들어온다. 양의 정수인지 확인해 숫자로 바꾼다. */
export function parseIdParam(value: string): number {
  const id = Number(value);
  if (!Number.isInteger(id) || id < 1) throw badRequest("id 는 양의 정수여야 합니다.");
  return id;
}

export function paginationOf(total: number, limit: number, offset: number, returned: number): Pagination {
  return { total, limit, offset, hasMore: offset + returned < total };
}
