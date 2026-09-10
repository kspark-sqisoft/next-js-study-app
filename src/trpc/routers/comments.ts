// comments 라우터: 조회 1개(list) + 변경 2개(add, remove).
// 변경 두 개는 protectedProcedure 라 로그아웃 상태에서 부르면 본문에 들어오기도 전에 UNAUTHORIZED 가 난다.
//
// [Server Action 버전(main 의 src/app/posts/actions.ts 의 addCommentAction / deleteCommentAction)과 비교]
// - 입력 검증: 액션 안에서 commentSchema.safeParse(...) 하던 것이 .input(...) 으로 프로시저 정의에 붙는다.
// - 로그인 검사: 액션마다 getCurrentUser() 하던 것이 미들웨어(protectedProcedure) 로 빠진다.
// - 에러: { error: "..." } 객체를 돌려주던 것이 TRPCError 를 던지는 것으로 바뀐다.
//   던진 에러는 HTTP 상태 코드 + message 로 클라이언트에 전달되고, useMutation 의 onError 에서 err.message 로 읽는다.
// - 캐시 무효화: 액션은 updateTag() 를 썼다. 여기서는 revalidateTag(tag, { expire: 0 }) 다. 아래 설명 참고.
//
// [왜 updateTag 를 못 쓰나]
// tRPC 프로시저는 /api/trpc Route Handler 안에서 실행된다. updateTag() 는 Server Action 안에서만 호출할 수 있고
// Route Handler 에서 부르면 에러다 (main README 5-7 "Route Handler 에서는 updateTag 를 못 쓴다").
// revalidateTag(tag, { expire: 0 }) 는 "지금 당장 만료" 라서 updateTag 와 같은 효과를 낸다.
//
// [캐시가 두 층이다]
// 1. 서버: getCommentThreads 는 "use cache" 된 함수. 태그로 무효화하지 않으면 다음 요청도 옛 목록을 준다.
//    → 프로시저 안에서 revalidateTag 로 지운다.
// 2. 브라우저: TanStack Query 캐시. 무효화하지 않으면 useQuery 가 재요청하지 않는다.
//    → comment-form.tsx 의 onSuccess 에서 invalidateQueries 로 지운다.
// 둘 다 지워야 화면이 새 값을 본다. main 은 Server Action 이 서버 캐시를 지우고 페이지를 다시 렌더링해 한 층이었다.
import { TRPCError } from "@trpc/server";
import { revalidateTag } from "next/cache";
import { z } from "zod";
import { commentsTag, createComment, deleteComment, findComment, getCommentThreads } from "@/lib/comments";
import { getPost } from "@/lib/posts";
import { commentSchema } from "@/lib/schemas/comment";
import { createTRPCRouter, protectedProcedure, publicProcedure } from "../init";

export const commentsRouter = createTRPCRouter({
  /**
   * 글 하나의 댓글 트리. 서버 컴포넌트(comments-section.tsx)가 prefetch 하고, 클라이언트(comment-threads.tsx)가 useQuery 로 읽는다.
   * 반환 타입 CommentThread[] (최상위 댓글 + replies 배열) 가 그대로 클라이언트의 data 타입이 된다.
   */
  list: publicProcedure
    .input(z.object({ postId: z.number().int().positive() }))
    .query(({ input }) => getCommentThreads(input.postId)), // "use cache" 된 함수. 태그로 무효화된다

  /**
   * 댓글/답글 작성. 로그인 필수.
   * 입력: main 의 commentSchema(content 1~1000자)를 .extend 로 재사용하고 postId, parentId 를 더했다.
   *       parentId 가 있으면 답글, 없으면 최상위 댓글.
   * 반환: { id } — 클라이언트는 이 값을 쓰지 않고 목록 쿼리를 무효화해 다시 가져온다.
   */
  add: protectedProcedure
    .input(
      commentSchema.extend({
        postId: z.number().int().positive(),
        parentId: z.number().int().positive().nullable().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // ctx.user 는 protectedProcedure 가 보장한다 (null 검사 불필요)
      const post = await getPost(input.postId);
      if (!post) throw new TRPCError({ code: "NOT_FOUND", message: "존재하지 않는 글입니다." });

      const parentId = input.parentId ?? null;
      if (parentId !== null) {
        const parent = findComment(parentId);
        // 2단 제한: 부모가 (1) 존재하고 (2) 같은 글의 댓글이며 (3) 최상위 댓글(parentId 가 null) 이어야 한다.
        // 답글에 또 답글을 달면(3단) 여기서 막힌다. main 의 addCommentAction 과 같은 규칙.
        if (!parent || parent.postId !== input.postId || parent.parentId !== null) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "답글을 달 수 없는 댓글입니다." });
        }
      }

      const id = createComment(input.postId, ctx.user.id, input.content, parentId); // 작성자는 ctx 에서. 클라이언트가 보낸 값을 믿지 않는다
      revalidateTag(commentsTag(input.postId), { expire: 0 }); // 서버 "use cache" 무효화 (Route Handler 컨텍스트 → updateTag 대신)
      return { id };
    }),

  /**
   * 댓글 삭제. 로그인 필수 + 작성자 본인만.
   * 화면(comment-threads.tsx)은 본인 댓글에만 삭제 버튼을 그리지만, 그건 편의일 뿐이다.
   * 프로시저는 브라우저에서 직접 호출할 수 있으므로 여기서 다시 검사한다 (main 의 deleteCommentAction 과 같은 원칙).
   * 최상위 댓글을 지우면 답글은 DB 의 ON DELETE CASCADE 로 함께 지워진다.
   */
  remove: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(({ ctx, input }) => {
      const comment = findComment(input.id);
      if (!comment) throw new TRPCError({ code: "NOT_FOUND", message: "이미 삭제된 댓글입니다." });
      if (comment.authorId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "본인이 쓴 댓글만 삭제할 수 있습니다." });
      }
      deleteComment(input.id);
      revalidateTag(commentsTag(comment.postId), { expire: 0 }); // 이 글의 댓글 캐시만 무효화. 다른 글은 그대로
      return { ok: true };
    }),
});
