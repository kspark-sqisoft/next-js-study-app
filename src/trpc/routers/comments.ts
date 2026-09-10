// comments 라우터. 조회 1개 + 변경 2개. 변경은 protectedProcedure 라 로그인 없이는 UNAUTHORIZED.
//
// Server Action 버전(src/app/posts/actions.ts 의 addCommentAction / deleteCommentAction)과 비교해 보자:
// - 입력 검증이 .input(zod) 로 프로시저 정의에 붙는다 (액션 안에서 safeParse 하던 것)
// - 로그인 검사가 미들웨어(protectedProcedure)로 빠진다 (액션마다 getCurrentUser 하던 것)
// - 에러는 TRPCError 코드로 돌아가고 클라이언트의 error.message 로 읽힌다 ({ error } 객체를 돌려주던 것)
// - 캐시 무효화: tRPC 프로시저는 Route Handler(/api/trpc) 안에서 실행되므로 updateTag 를 못 쓴다 (Server Action 전용).
//   revalidateTag(tag, { expire: 0 }) 로 즉시 만료시킨다 (README 5-7).
import { TRPCError } from "@trpc/server";
import { revalidateTag } from "next/cache";
import { z } from "zod";
import { commentsTag, createComment, deleteComment, findComment, getCommentThreads } from "@/lib/comments";
import { getPost } from "@/lib/posts";
import { commentSchema } from "@/lib/schemas/comment";
import { createTRPCRouter, protectedProcedure, publicProcedure } from "../init";

export const commentsRouter = createTRPCRouter({
  list: publicProcedure
    .input(z.object({ postId: z.number().int().positive() }))
    .query(({ input }) => getCommentThreads(input.postId)), // "use cache" 된 함수. 태그로 무효화된다

  add: protectedProcedure
    .input(
      commentSchema.extend({
        postId: z.number().int().positive(),
        parentId: z.number().int().positive().nullable().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const post = await getPost(input.postId);
      if (!post) throw new TRPCError({ code: "NOT_FOUND", message: "존재하지 않는 글입니다." });

      const parentId = input.parentId ?? null;
      if (parentId !== null) {
        const parent = findComment(parentId);
        // 부모가 같은 글의 "최상위" 댓글이어야 한다 → 답글의 답글(3단)은 막는다
        if (!parent || parent.postId !== input.postId || parent.parentId !== null) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "답글을 달 수 없는 댓글입니다." });
        }
      }

      const id = createComment(input.postId, ctx.user.id, input.content, parentId);
      revalidateTag(commentsTag(input.postId), { expire: 0 }); // Route Handler 컨텍스트 → updateTag 대신
      return { id };
    }),

  remove: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(({ ctx, input }) => {
      const comment = findComment(input.id);
      if (!comment) throw new TRPCError({ code: "NOT_FOUND", message: "이미 삭제된 댓글입니다." });
      if (comment.authorId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "본인이 쓴 댓글만 삭제할 수 있습니다." });
      }
      deleteComment(input.id);
      revalidateTag(commentsTag(comment.postId), { expire: 0 });
      return { ok: true };
    }),
});
