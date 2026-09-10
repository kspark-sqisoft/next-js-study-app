// @vitest-environment node
// 단위 테스트: Zod 스키마. 검증 규칙이 바뀌면 여기서 바로 잡힌다.
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { loginSchema, signupSchema } from "./auth";
import { commentSchema } from "./comment";
import { postSchema } from "./post";

// 필드별 에러를 { 필드: [메시지] } 로 꺼내는 헬퍼
function errorsOf(result: z.ZodSafeParseResult<unknown>): Record<string, string[] | undefined> {
  return result.success ? {} : z.flattenError(result.error).fieldErrors;
}

describe("postSchema", () => {
  it("앞뒤 공백을 제거하고 통과시킨다", async () => {
    const r = postSchema.safeParse({ title: "  제목  ", content: "  내용  " });
    expect(r.success).toBe(true);
    expect(r.data).toEqual({ title: "제목", content: "내용" });
  });

  it("빈 제목과 빈 내용은 필드별 에러를 낸다", async () => {
    const r = postSchema.safeParse({ title: "   ", content: "" });
    expect(r.success).toBe(false);
    expect(errorsOf(r)).toEqual({
      title: ["제목을 입력하세요."],
      content: ["내용을 입력하세요."],
    });
  });

  it("제목 100자 초과는 거부한다", async () => {
    const r = postSchema.safeParse({ title: "a".repeat(101), content: "x" });
    expect(errorsOf(r).title?.[0]).toContain("100자");
  });
});

describe("signupSchema / loginSchema", () => {
  it("이메일은 소문자로 정규화한다", async () => {
    const r = signupSchema.safeParse({ name: "홍길동", email: "Test@Example.COM", password: "password123" });
    expect(r.success).toBe(true);
    expect(r.data?.email).toBe("test@example.com");
  });

  it("짧은 이름, 잘못된 이메일, 짧은 비밀번호를 각각 잡는다", async () => {
    const r = signupSchema.safeParse({ name: "테", email: "bad", password: "short" });
    const errors = errorsOf(r);
    expect(errors.name?.[0]).toContain("2자");
    expect(errors.email?.[0]).toContain("이메일");
    expect(errors.password?.[0]).toContain("8자");
  });

  it("로그인은 비밀번호가 비어 있으면 거부한다", async () => {
    const r = loginSchema.safeParse({ email: "a@b.com", password: "" });
    expect(errorsOf(r).password?.[0]).toBe("비밀번호를 입력하세요.");
  });
});

describe("commentSchema", () => {
  it("1000자 초과 댓글을 거부한다", async () => {
    const r = commentSchema.safeParse({ content: "x".repeat(1001) });
    expect(errorsOf(r).content?.[0]).toContain("1000자");
  });
});
