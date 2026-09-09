// 댓글 폼 검증 스키마 (Zod)
import { z } from "zod";

export const commentSchema = z.object({
  content: z.string().trim().min(1, "댓글 내용을 입력하세요.").max(1000, "댓글은 1000자 이하로 입력하세요."),
});
