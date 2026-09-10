// posts 라우터. 조회 전용 프로시저 세 개. 데이터 접근은 기존 src/lib/posts.ts 를 그대로 쓴다.
// (tRPC 는 "전송 층" 이다. DB 접근 코드는 바뀌지 않는다는 점이 이 브랜치의 핵심 비교 포인트)
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { countPosts, getPost, getPostsByCursor, searchPosts } from "@/lib/posts";
import { createTRPCRouter, publicProcedure } from "../init";

export const postsRouter = createTRPCRouter({
  // 커서 페이지네이션 (무한 스크롤). 입력 이름 cursor 는 tRPC 의 infiniteQuery 규약이다.
  list: publicProcedure
    .input(
      z.object({
        limit: z.number().int().min(1).max(20).default(5),
        cursor: z.number().int().positive().nullish(), // 첫 페이지는 null/undefined
        q: z.string().trim().max(100).optional(),
      }),
    )
    .query(({ input }) => {
      const { posts, nextCursor } = getPostsByCursor(input.q ?? "", input.cursor ?? null, input.limit);
      return {
        posts: posts.map(({ id, title, authorName, imagePath, createdAt }) => ({ id, title, authorName, imagePath, createdAt })),
        nextCursor,
      };
    }),

  // 검색. 반환 타입은 여기서 정해지고, 클라이언트는 그 타입을 자동으로 받는다 (손으로 적는 SearchResponse 없음)
  search: publicProcedure
    .input(z.object({ q: z.string().trim().max(100).default("") }))
    .query(({ input }) => ({
      query: input.q,
      total: countPosts(),
      posts: searchPosts(input.q).map(({ id, title, createdAt }) => ({ id, title, createdAt })),
    })),

  byId: publicProcedure.input(z.object({ id: z.number().int().positive() })).query(async ({ input }) => {
    const post = await getPost(input.id);
    if (!post) throw new TRPCError({ code: "NOT_FOUND", message: "존재하지 않는 글입니다." });
    return post;
  }),
});
