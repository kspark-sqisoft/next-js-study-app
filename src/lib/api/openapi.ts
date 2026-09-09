// 공개 API 의 기계가 읽는 명세 (OpenAPI 3.1).
//
// 문서를 사람이 읽는 README 에만 두면, 외부 개발자는 클라이언트 코드를 손으로 짜야 한다.
// 이 JSON 하나만 있으면 Swagger UI 로 문서를 띄우거나, 여러 언어의 클라이언트를 생성하거나,
// Postman 에 그대로 가져갈 수 있다. 그래서 "공개 API" 라면 사실상 필수에 가깝다.
//
// servers 를 상대 경로("/api/v1")로 둔 덕분에 이 문서에는 요청에 따라 달라지는 값이 전혀 없다.
// 그래서 GET /api/v1/openapi.json 은 빌드 시점에 미리 만들어진다 (Cache Components 의 정적 라우트).
import "server-only";
import { MAX_LIMIT, DEFAULT_LIMIT } from "@/lib/schemas/api";
import { ACCESS_TOKEN_TTL_SECONDS } from "@/lib/api/auth";

const errorResponseSchema = {
  type: "object",
  required: ["error"],
  properties: {
    error: {
      type: "object",
      required: ["code", "message"],
      properties: {
        code: {
          type: "string",
          enum: [
            "bad_request",
            "validation_failed",
            "unauthorized",
            "forbidden",
            "not_found",
            "conflict",
            "unsupported_media_type",
            "rate_limited",
            "internal_error",
          ],
        },
        message: { type: "string" },
        details: { type: "object", additionalProperties: { type: "array", items: { type: "string" } } },
      },
    },
  },
} as const;

/** 목록 응답은 전부 같은 모양이라 한 번만 정의하고 재사용한다. */
function listResponse(itemRef: string) {
  return {
    type: "object",
    required: ["data", "pagination"],
    properties: {
      data: { type: "array", items: { $ref: itemRef } },
      pagination: { $ref: "#/components/schemas/Pagination" },
    },
  };
}

function itemResponse(itemRef: string) {
  return { type: "object", required: ["data"], properties: { data: { $ref: itemRef } } };
}

const jsonContent = (schema: unknown) => ({ content: { "application/json": { schema } } });

/** 목록 엔드포인트 공통 쿼리 파라미터 */
const listParams = [
  {
    name: "limit",
    in: "query",
    description: `한 번에 가져올 개수 (1–${MAX_LIMIT})`,
    schema: { type: "integer", minimum: 1, maximum: MAX_LIMIT, default: DEFAULT_LIMIT },
  },
  {
    name: "offset",
    in: "query",
    description: "건너뛸 개수",
    schema: { type: "integer", minimum: 0, default: 0 },
  },
];

const idParam = {
  name: "id",
  in: "path",
  required: true,
  schema: { type: "integer", minimum: 1 },
};

// 자주 쓰는 에러 응답들
const errors = {
  400: { description: "요청 형식 오류", ...jsonContent(errorResponseSchema) },
  401: { description: "인증 실패 또는 토큰 없음", ...jsonContent(errorResponseSchema) },
  403: { description: "권한 없음 (남의 리소스)", ...jsonContent(errorResponseSchema) },
  404: { description: "리소스 없음", ...jsonContent(errorResponseSchema) },
  409: { description: "현재 상태와 충돌", ...jsonContent(errorResponseSchema) },
  422: { description: "값 검증 실패", ...jsonContent(errorResponseSchema) },
  429: { description: "레이트 리밋 초과", ...jsonContent(errorResponseSchema) },
};

export const openApiDocument = {
  openapi: "3.1.0",
  info: {
    title: "next-js-study-app Public API",
    version: "1.0.0",
    description: [
      "Next.js 학습용 앱의 공개 REST API.",
      "",
      "**인증**: `Authorization: Bearer <토큰>` 헤더를 쓴다. 두 종류를 모두 받는다.",
      `- 액세스 토큰: \`POST /auth/token\` 으로 발급. ${ACCESS_TOKEN_TTL_SECONDS}초 유효.`,
      "- API 키(`sk_...`): `POST /auth/keys` 로 발급. 만료 없음, 폐기 가능. 서버-투-서버용.",
      "",
      "세션 쿠키는 받지 않는다. 브라우저에 로그인되어 있어도 이 API 에는 영향이 없다(CSRF 차단).",
      "",
      "**레이트 리밋**: 익명 60회/분, 인증 600회/분. 남은 횟수는 `X-RateLimit-*` 응답 헤더에 있다.",
      "",
      "**읽기는 공개, 쓰기는 인증 필요**가 기본 규칙이다.",
    ].join("\n"),
  },
  servers: [{ url: "/api/v1", description: "이 서버" }],
  tags: [
    { name: "auth", description: "계정, 토큰, API 키" },
    { name: "posts", description: "글" },
    { name: "comments", description: "댓글 (2단까지)" },
    { name: "todos", description: "할 일" },
  ],
  // 문서 전체 기본값: 인증 필요. 공개 엔드포인트만 각자 security: [] 로 덮어쓴다.
  security: [{ bearerAuth: [] }],
  components: {
    securitySchemes: {
      bearerAuth: { type: "http", scheme: "bearer", description: "액세스 토큰 또는 sk_ 로 시작하는 API 키" },
    },
    schemas: {
      Pagination: {
        type: "object",
        required: ["total", "limit", "offset", "hasMore"],
        properties: {
          total: { type: "integer", description: "필터를 적용한 전체 개수" },
          limit: { type: "integer" },
          offset: { type: "integer" },
          hasMore: { type: "boolean", description: "true 면 offset 을 늘려 더 가져올 수 있다" },
        },
      },
      Author: {
        type: "object",
        required: ["id", "name"],
        properties: { id: { type: "integer" }, name: { type: "string" } },
      },
      User: {
        type: "object",
        required: ["id", "name", "email"],
        properties: { id: { type: "integer" }, name: { type: "string" }, email: { type: "string", format: "email" } },
      },
      Post: {
        type: "object",
        required: ["id", "title", "content", "author", "imageUrl", "createdAt", "updatedAt"],
        properties: {
          id: { type: "integer" },
          title: { type: "string", maxLength: 100 },
          content: { type: "string", maxLength: 5000 },
          author: { oneOf: [{ $ref: "#/components/schemas/Author" }, { type: "null" }] },
          imageUrl: { type: ["string", "null"], format: "uri" },
          createdAt: { type: "string" },
          updatedAt: { type: "string" },
        },
      },
      Comment: {
        type: "object",
        required: ["id", "postId", "parentId", "author", "content", "createdAt"],
        properties: {
          id: { type: "integer" },
          postId: { type: "integer" },
          parentId: { type: ["integer", "null"], description: "null 이면 최상위 댓글, 값이 있으면 그 댓글의 답글" },
          author: { $ref: "#/components/schemas/Author" },
          content: { type: "string", maxLength: 1000 },
          createdAt: { type: "string" },
        },
      },
      Todo: {
        type: "object",
        required: ["id", "title", "completed", "createdAt"],
        properties: {
          id: { type: "integer" },
          title: { type: "string", maxLength: 200 },
          completed: { type: "boolean" },
          createdAt: { type: "string" },
        },
      },
      ApiKey: {
        type: "object",
        required: ["id", "name", "prefix", "lastUsedAt", "revokedAt", "createdAt"],
        properties: {
          id: { type: "integer" },
          name: { type: "string" },
          prefix: { type: "string", description: "키 앞부분. 목록에서 구분하는 용도" },
          lastUsedAt: { type: ["string", "null"] },
          revokedAt: { type: ["string", "null"], description: "값이 있으면 폐기된 키" },
          createdAt: { type: "string" },
        },
      },
    },
  },
  paths: {
    "/auth/register": {
      post: {
        tags: ["auth"],
        summary: "계정 생성",
        security: [],
        requestBody: {
          required: true,
          ...jsonContent({
            type: "object",
            required: ["name", "email", "password"],
            properties: {
              name: { type: "string", minLength: 2, maxLength: 30 },
              email: { type: "string", format: "email" },
              password: { type: "string", minLength: 8, maxLength: 72 },
            },
          }),
        },
        responses: {
          201: { description: "생성됨. 액세스 토큰이 함께 온다", ...jsonContent({ type: "object" }) },
          409: errors[409],
          422: errors[422],
        },
      },
    },
    "/auth/token": {
      post: {
        tags: ["auth"],
        summary: "액세스 토큰 발급 (로그인)",
        security: [],
        requestBody: {
          required: true,
          ...jsonContent({
            type: "object",
            required: ["email", "password"],
            properties: { email: { type: "string", format: "email" }, password: { type: "string" } },
          }),
        },
        responses: {
          200: {
            description: "발급됨",
            ...jsonContent({
              type: "object",
              properties: {
                data: {
                  type: "object",
                  properties: {
                    accessToken: { type: "string" },
                    tokenType: { type: "string", const: "Bearer" },
                    expiresIn: { type: "integer" },
                    user: { $ref: "#/components/schemas/User" },
                  },
                },
              },
            }),
          },
          401: errors[401],
          422: errors[422],
        },
      },
    },
    "/auth/me": {
      get: {
        tags: ["auth"],
        summary: "토큰 주인 확인",
        responses: { 200: { description: "OK", ...jsonContent({ type: "object" }) }, 401: errors[401] },
      },
    },
    "/auth/keys": {
      get: {
        tags: ["auth"],
        summary: "내 API 키 목록 (액세스 토큰 전용)",
        responses: {
          200: { description: "OK", ...jsonContent(listResponse("#/components/schemas/ApiKey")) },
          401: errors[401],
          403: errors[403],
        },
      },
      post: {
        tags: ["auth"],
        summary: "API 키 발급 (액세스 토큰 전용)",
        description: "응답의 `key` 는 이때만 볼 수 있다. 서버에는 해시만 저장된다.",
        requestBody: {
          required: true,
          ...jsonContent({
            type: "object",
            required: ["name"],
            properties: { name: { type: "string", minLength: 1, maxLength: 50 } },
          }),
        },
        responses: {
          201: { description: "발급됨", ...jsonContent({ type: "object" }) },
          401: errors[401],
          403: errors[403],
          422: errors[422],
        },
      },
    },
    "/auth/keys/{id}": {
      delete: {
        tags: ["auth"],
        summary: "API 키 폐기 (액세스 토큰 전용)",
        parameters: [idParam],
        responses: { 204: { description: "폐기됨" }, 401: errors[401], 403: errors[403], 404: errors[404] },
      },
    },
    "/posts": {
      get: {
        tags: ["posts"],
        summary: "글 목록",
        security: [],
        parameters: [
          ...listParams,
          { name: "q", in: "query", description: "제목·본문 검색어", schema: { type: "string", maxLength: 100 } },
        ],
        responses: {
          200: { description: "OK", ...jsonContent(listResponse("#/components/schemas/Post")) },
          422: errors[422],
        },
      },
      post: {
        tags: ["posts"],
        summary: "글 작성",
        requestBody: {
          required: true,
          ...jsonContent({
            type: "object",
            required: ["title", "content"],
            properties: { title: { type: "string", maxLength: 100 }, content: { type: "string", maxLength: 5000 } },
          }),
        },
        responses: {
          201: { description: "생성됨", ...jsonContent(itemResponse("#/components/schemas/Post")) },
          401: errors[401],
          422: errors[422],
        },
      },
    },
    "/posts/{id}": {
      parameters: [idParam],
      get: {
        tags: ["posts"],
        summary: "글 한 건",
        security: [],
        responses: {
          200: { description: "OK", ...jsonContent(itemResponse("#/components/schemas/Post")) },
          404: errors[404],
        },
      },
      patch: {
        tags: ["posts"],
        summary: "글 수정 (작성자 본인만)",
        description: "보낸 필드만 바뀐다.",
        requestBody: {
          required: true,
          ...jsonContent({
            type: "object",
            minProperties: 1,
            properties: { title: { type: "string", maxLength: 100 }, content: { type: "string", maxLength: 5000 } },
          }),
        },
        responses: {
          200: { description: "수정됨", ...jsonContent(itemResponse("#/components/schemas/Post")) },
          401: errors[401],
          403: errors[403],
          404: errors[404],
          422: errors[422],
        },
      },
      delete: {
        tags: ["posts"],
        summary: "글 삭제 (작성자 본인만). 댓글도 함께 삭제된다",
        responses: { 204: { description: "삭제됨" }, 401: errors[401], 403: errors[403], 404: errors[404] },
      },
    },
    "/posts/{id}/comments": {
      parameters: [idParam],
      get: {
        tags: ["comments"],
        summary: "댓글 목록 (평탄한 배열. parentId 로 트리를 조립한다)",
        security: [],
        parameters: listParams,
        responses: {
          200: { description: "OK", ...jsonContent(listResponse("#/components/schemas/Comment")) },
          404: errors[404],
        },
      },
      post: {
        tags: ["comments"],
        summary: "댓글/답글 작성",
        requestBody: {
          required: true,
          ...jsonContent({
            type: "object",
            required: ["content"],
            properties: {
              content: { type: "string", maxLength: 1000 },
              parentId: {
                type: ["integer", "null"],
                description: "답글이면 부모 댓글 id. 부모는 같은 글의 최상위 댓글이어야 한다 (2단까지)",
              },
            },
          }),
        },
        responses: {
          201: { description: "생성됨", ...jsonContent(itemResponse("#/components/schemas/Comment")) },
          400: errors[400],
          401: errors[401],
          404: errors[404],
          422: errors[422],
        },
      },
    },
    "/comments/{id}": {
      delete: {
        tags: ["comments"],
        summary: "댓글 삭제 (작성자 본인만). 최상위 댓글이면 답글도 함께 삭제된다",
        parameters: [idParam],
        responses: { 204: { description: "삭제됨" }, 401: errors[401], 403: errors[403], 404: errors[404] },
      },
    },
    "/todos": {
      get: {
        tags: ["todos"],
        summary: "할 일 목록",
        security: [],
        parameters: [
          ...listParams,
          { name: "completed", in: "query", schema: { type: "string", enum: ["true", "false"] } },
        ],
        responses: {
          200: { description: "OK", ...jsonContent(listResponse("#/components/schemas/Todo")) },
          422: errors[422],
        },
      },
      post: {
        tags: ["todos"],
        summary: "할 일 추가",
        requestBody: {
          required: true,
          ...jsonContent({
            type: "object",
            required: ["title"],
            properties: { title: { type: "string", maxLength: 200 }, completed: { type: "boolean", default: false } },
          }),
        },
        responses: {
          201: { description: "생성됨", ...jsonContent(itemResponse("#/components/schemas/Todo")) },
          401: errors[401],
          422: errors[422],
        },
      },
    },
    "/todos/{id}": {
      parameters: [idParam],
      get: {
        tags: ["todos"],
        summary: "할 일 한 건",
        security: [],
        responses: {
          200: { description: "OK", ...jsonContent(itemResponse("#/components/schemas/Todo")) },
          404: errors[404],
        },
      },
      patch: {
        tags: ["todos"],
        summary: "할 일 수정",
        requestBody: {
          required: true,
          ...jsonContent({
            type: "object",
            minProperties: 1,
            properties: { title: { type: "string", maxLength: 200 }, completed: { type: "boolean" } },
          }),
        },
        responses: {
          200: { description: "수정됨", ...jsonContent(itemResponse("#/components/schemas/Todo")) },
          401: errors[401],
          404: errors[404],
          422: errors[422],
        },
      },
      delete: {
        tags: ["todos"],
        summary: "할 일 삭제",
        responses: { 204: { description: "삭제됨" }, 401: errors[401], 404: errors[404] },
      },
    },
  },
} as const;
