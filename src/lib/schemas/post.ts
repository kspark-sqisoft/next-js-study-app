// 글 작성 폼의 검증 스키마 (Zod).
// 규칙을 한 곳에 선언해 두면 Server Action, API, (원하면) 브라우저 검증에서 같은 규칙을 재사용할 수 있다.
// 서버/클라이언트 어디서든 import 할 수 있도록 "server-only" 는 붙이지 않는다.
import { z } from "zod";

export const postSchema = z.object({
  title: z
    .string()
    .trim() // 앞뒤 공백 제거 후 검사
    .min(1, "제목을 입력하세요.")
    .max(100, "제목은 100자 이하로 입력하세요."),
  content: z
    .string()
    .trim()
    .min(1, "내용을 입력하세요.")
    .max(5000, "내용은 5000자 이하로 입력하세요."),
});

// 스키마에서 타입을 추출한다. 규칙을 바꾸면 타입도 함께 바뀐다.
export type PostInput = z.infer<typeof postSchema>;

// 필드별 에러 메시지 배열. z.flattenError() 의 fieldErrors 형태와 같다.
export type PostFieldErrors = Partial<Record<keyof PostInput, string[]>>;
