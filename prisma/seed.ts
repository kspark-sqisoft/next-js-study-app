/**
 * 학습용 초기 데이터(시드). Prisma Client 로 넣는다 (main 브랜치의 scripts/seed-db.mts 를 대체).
 *
 *   npm run db:seed     # 비어 있는 테이블에만 샘플 데이터 삽입 (데이터가 있으면 건너뜀)
 *   npm run db:reset    # DB 를 지우고 마이그레이션부터 다시 적용한 뒤 시드 (prisma migrate reset)
 *
 * 샘플 계정 (비밀번호는 둘 다 password123):
 *   demo@example.com  / 데모     ← 샘플 글 대부분의 작성자
 *   guest@example.com / 게스트   ← 다른 사람 글은 "보기만" 되는지 확인할 때 사용
 *
 * 실행은 tsx(TypeScript 실행기)로 한다. prisma.config.ts 의 migrations.seed 에 등록되어 있어
 * `prisma db seed` 와 `prisma migrate reset` 이 자동으로 부른다.
 */
import path from "node:path";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../src/generated/prisma/client";
import { hashPassword } from "../src/lib/password";

try { process.loadEnvFile(".env"); } catch {}

const url = process.env.DATABASE_URL ?? `file:${path.resolve(process.cwd(), process.env.DATABASE_PATH ?? "data/app.db")}`;
const prisma = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url }) });

const SEED_USERS = [
  { email: "demo@example.com", name: "데모", password: "password123" },
  { email: "guest@example.com", name: "게스트", password: "password123" },
];

const SEED_TODOS = [
  { title: "Next.js App Router 구조 살펴보기", completed: true },
  { title: "Prisma 스키마(prisma/schema.prisma) 읽어보기", completed: true },
  { title: "Server Action 으로 할 일 추가해 보기", completed: false },
  { title: "useOptimistic 동작 확인하기 (체크박스 토글)", completed: false },
  { title: "/api/todos Route Handler 를 브라우저에서 열어보기", completed: false },
  { title: "/posts 에서 ISR 과 스트리밍 확인하기", completed: false },
  { title: "demo 계정으로 로그인해서 글 수정해 보기", completed: false },
];

// author: SEED_USERS 인덱스
const SEED_POSTS = [
  { title: "Cache Components 란?", author: 0, content: "Next.js 16 의 캐싱 모델. 기본은 캐시하지 않고, 'use cache' 를 붙인 함수/컴포넌트만 캐시한다.\n\n이 글 목록(/posts)은 'use cache' + cacheLife 로 캐시되어 있어서, 새로고침해도 캐시 생성 시각이 바뀌지 않는다. 글을 추가하면 updateTag 로 캐시가 즉시 갱신된다." },
  { title: "동적 라우트와 generateStaticParams", author: 0, content: "/posts/[id] 는 동적 세그먼트다. generateStaticParams 가 돌려준 id 는 빌드 시 미리 렌더링되고, 나머지 id 는 첫 요청 때 렌더링된 뒤 캐시된다. 이것이 Cache Components 시대의 ISR 이다." },
  { title: "loading, error, not-found 특수 파일", author: 0, content: "loading.tsx 는 세그먼트 전체를 Suspense 로 감싸고, error.tsx 는 Error Boundary 로 감싼다. notFound() 를 호출하면 같은 세그먼트의 not-found.tsx 가 렌더링된다.\n\n이 글 상세 페이지에서 '에러 발생시키기' 버튼을 눌러 error.tsx 를, 없는 id (/posts/9999) 로 접속해 not-found.tsx 를 확인해 보자." },
  { title: "Suspense 스트리밍", author: 0, content: "페이지의 일부가 느려도 나머지를 먼저 보낼 수 있다. 이 글 하단의 '다른 글' 목록은 일부러 1.5초 지연시킨 뒤 스트리밍된다. 글 본문은 캐시에서 즉시 나오고, 목록만 나중에 채워지는 것을 볼 수 있다." },
  { title: "클라이언트 사이드 데이터 페칭", author: 0, content: "서버 컴포넌트가 아니라 브라우저에서 fetch 로 데이터를 가져오는 방식. /client-fetch 에서 SWR, TanStack Query, useEffect+fetch 세 가지를 비교해 볼 수 있다." },
  { title: "인증과 권한: 이 글은 게스트가 썼습니다", author: 1, content: "demo 계정으로 로그인하면 이 글에는 수정/삭제 버튼이 보이지 않는다. 작성자(guest)만 수정할 수 있다.\n\n버튼을 숨기는 것은 편의일 뿐이고, 실제 검사는 Server Action 안에서 세션을 다시 읽어서 한다 (src/app/posts/actions.ts)." },
];

// post: SEED_POSTS 인덱스, author: SEED_USERS 인덱스, parent: 같은 배열 안의 인덱스 (답글일 때)
const SEED_COMMENTS = [
  { post: 0, author: 1, content: "캐시 생성 시각이 진짜 안 바뀌네요. 신기합니다." },
  { post: 0, author: 0, content: "1분 지나고 새로고침 두 번 해 보세요. 백그라운드 재생성이 보입니다.", parent: 0 },
  { post: 0, author: 1, content: "확인했습니다. 감사합니다!", parent: 0 },
  { post: 5, author: 0, content: "데모 계정으로 보면 수정 버튼이 없는 게 맞네요." },
  { post: 5, author: 1, content: "네, 답글은 로그인한 누구나 달 수 있습니다.", parent: 3 },
];

async function main() {
  // users: 이미 있으면 그대로 쓴다 (upsert)
  const users = [];
  for (const u of SEED_USERS) {
    users.push(
      await prisma.user.upsert({
        where: { email: u.email },
        update: {},
        create: { email: u.email, name: u.name, passwordHash: await hashPassword(u.password) },
      }),
    );
  }
  console.log(`users: ${users.length}건 준비`);

  if ((await prisma.todo.count()) === 0) {
    await prisma.todo.createMany({ data: SEED_TODOS.map((t) => ({ title: t.title, completed: t.completed ? 1 : 0 })) });
    console.log(`todos: 샘플 ${SEED_TODOS.length}건 삽입`);
  } else console.log("todos: 이미 있어 건너뜀");

  if ((await prisma.post.count()) === 0) {
    const posts = [];
    for (const p of SEED_POSTS) {
      posts.push(await prisma.post.create({ data: { title: p.title, content: p.content, authorId: users[p.author].id } }));
    }
    console.log(`posts: 샘플 ${posts.length}건 삽입`);

    const commentIds: number[] = [];
    for (const c of SEED_COMMENTS) {
      const created = await prisma.comment.create({
        data: { postId: posts[c.post].id, authorId: users[c.author].id, content: c.content, parentId: c.parent === undefined ? null : commentIds[c.parent] },
      });
      commentIds.push(created.id);
    }
    console.log(`comments: 샘플 ${SEED_COMMENTS.length}건 삽입`);
  } else console.log("posts/comments: 이미 있어 건너뜀");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
