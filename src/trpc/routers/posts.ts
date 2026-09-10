// posts 라우터: 글 조회 프로시저 세 개 (list, search, byId). 변경(작성·수정·삭제)은 이 브랜치에서도
// Server Action(src/app/posts/actions.ts) 이 담당한다. 비교 대상을 "조회" 로 좁히기 위해서다.
//
// [핵심 비교 포인트] tRPC 는 "전송 층" 이다.
// DB 접근은 main 브랜치의 src/lib/posts.ts 를 한 글자도 바꾸지 않고 그대로 부른다.
// main 의 /api/posts/route.ts 가 하던 일(쿼리스트링 파싱, 숫자 변환, 범위 검사, JSON 응답 조립)이
// 여기서는 .input(zod) 와 반환값 그 자체로 대체된다.
//
// [프로시저 정의 읽는 법]
//   이름: publicProcedure        ← 누가 부를 수 있나 (public / protected)
//     .input(z.object({...}))    ← 입력 검증 스키마. 통과하지 못하면 BAD_REQUEST 로 거부된다
//     .query(({ input, ctx }) => ...)   ← 조회. 클라이언트는 useQuery 로 부른다 (HTTP GET)
//     .mutation(...)             ← 변경. 클라이언트는 useMutation 으로 부른다 (HTTP POST)
// 반환값의 타입이 곧 클라이언트가 받는 data 의 타입이다. 따로 선언하지 않는다.
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { countPosts, getPost, getPostsByCursor, searchPosts } from "@/lib/posts";
import { createTRPCRouter, publicProcedure } from "../init";

export const postsRouter = createTRPCRouter({
  /**
   * 커서 페이지네이션 목록 (무한 스크롤 /feed 가 쓴다).
   *
   * 입력:
   * - limit : 한 번에 가져올 개수. 1~20, 안 주면 5. main 의 route.ts 는 Number(limitParam) || 5 와
   *           Math.min/Math.max 로 손수 했던 검사가 스키마 한 줄이 됐다.
   * - cursor: "마지막으로 본 글 id". 이름이 반드시 cursor 여야 한다. tRPC 의 infiniteQueryOptions 가
   *           다음 페이지를 요청할 때 getNextPageParam 의 반환값을 이 필드에 자동으로 넣기 때문이다.
   *           nullish() = null 또는 undefined 허용 → 첫 페이지.
   * - q     : 검색어. 선택.
   *
   * 반환: { posts: 목록용 필드만 추린 배열, nextCursor: 다음 페이지 커서 또는 null(끝) }
   *       본문(content)은 목록에 필요 없으므로 뺀다. 이 모양이 그대로 FeedItem 타입이 된다 (post-feed.tsx 참고).
   */
  list: publicProcedure
    .input(
      z.object({
        limit: z.number().int().min(1).max(20).default(5),
        cursor: z.number().int().positive().nullish(), // 첫 페이지는 null/undefined
        q: z.string().trim().max(100).optional(),
      }),
    )
    .query(({ input }) => {
      // input 은 이미 검증·기본값 적용이 끝난 값. input.limit 은 number 로 확정되어 있다
      const { posts, nextCursor } = getPostsByCursor(input.q ?? "", input.cursor ?? null, input.limit);
      return {
        posts: posts.map(({ id, title, authorName, imagePath, createdAt }) => ({ id, title, authorName, imagePath, createdAt })),
        nextCursor,
      };
    }),

  /**
   * 검색 (/client-fetch 의 tRPC 섹션이 쓴다).
   * main 의 /api/posts?q= 와 같은 결과를 돌려주지만, 클라이언트는 이 반환값의 타입을 자동으로 받는다.
   * main 의 post-search-query.tsx 에 손으로 적어 둔 `type SearchResponse = {...}` 가 이 브랜치에는 없다.
   * .default("") 덕분에 q 를 안 보내도 되고, 본문에서 input.q 는 string 으로 확정된다.
   */
  search: publicProcedure
    .input(z.object({ q: z.string().trim().max(100).default("") }))
    .query(({ input }) => ({
      query: input.q,
      total: countPosts(),
      posts: searchPosts(input.q).map(({ id, title, createdAt }) => ({ id, title, createdAt })),
    })),

  /**
   * 글 한 건. 화면에서는 아직 쓰지 않지만 "없으면 NOT_FOUND 를 던진다" 는 관례를 보여 주기 위해 둔다.
   * main 의 Route Handler 라면 `return Response.json({...}, { status: 404 })` 를 직접 조립해야 한다.
   * getPost 는 "use cache" 된 함수라 tRPC 를 거쳐도 서버 캐시의 이점은 그대로다.
   */
  byId: publicProcedure.input(z.object({ id: z.number().int().positive() })).query(async ({ input }) => {
    const post = await getPost(input.id);
    if (!post) throw new TRPCError({ code: "NOT_FOUND", message: "존재하지 않는 글입니다." });
    return post;
  }),
});
