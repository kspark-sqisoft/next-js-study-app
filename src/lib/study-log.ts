// 학습용 서버 로그. 요청 하나가 서버 안에서 어떤 층을 거치는지 `next dev` 터미널에서 눈으로 따라가기 위한 것.
// 브라우저 network 탭에는 "요청 1건" 으로만 보이는 것이 서버에서는 아래 순서로 쪼개진다.
//
//   [proxy]    src/proxy.ts. 라우트에 닿기 전에 실행. 쿠키만 보고 리다이렉트/CORS 를 결정한다.
//   [render]   서버 컴포넌트가 렌더링되며 데이터 함수를 "호출" 했다. 요청마다 매번 찍힌다.
//   [cache]    "use cache" 함수의 "몸체" 가 실제로 실행됐다 = 캐시 MISS. HIT 이면 몸체가 실행되지 않는다.
//              주의: 개발 모드의 "콘솔 로그 리플레이". Next.js 는 캐시 엔트리를 만들 때 찍힌 console 출력을 저장해 두고,
//              HIT 때도 "[ Cache ]" 접두어를 붙여 다시 보여 준다. 그래서 구분법은 접두어가 아니라 "우리 타임스탬프" 다.
//                MISS: 접두어 없는 줄 + "[ Cache ]" 줄이 같은 시각으로 둘 다 찍힘 (지금 실행됨)
//                HIT : "[ Cache ]" 줄만 찍히고, 그 안의 시각이 직전 [render] 보다 과거임 (예전 실행의 재생)
//              [render] 보다 나중 시각의 MISS 가 뒤늦게 혼자 찍히면 백그라운드 재생성(stale-while-revalidate)이다.
//   [session]  세션 쿠키 발급/삭제/검증. getCurrentUser 는 react cache() 라 한 요청에 한 번만 찍힌다.
//   [action]   Server Action 실행. 어떤 태그/경로를 어떤 방식으로 무효화했는지 함께 찍는다.
//   [api]      Route Handler 실행. 인증 방식, 레이트 리밋 잔여량, 상태 코드, 소요 시간.
//   [trpc]     tRPC 프로시저 실행 (이 브랜치 전용). 경로, query/mutation, 입력, 사용자, 소요 시간.
//              서버 컴포넌트의 prefetch(HTTP 없음)와 브라우저의 /api/trpc 호출(HTTP) 둘 다 여기로 찍힌다.
//   [build]    generateStaticParams 등 빌드 시점(또는 dev 첫 요청)에 실행되는 것.
//
// 테스트 실행 중에는 조용히 한다. 이 파일은 server-only 를 import 하지 않는다 (proxy.ts 에서도 쓰기 위해).

const enabled = process.env.NODE_ENV !== "test";

type Kind = "proxy" | "render" | "cache" | "session" | "action" | "api" | "build" | "trpc";

// Cache Components 에서는 렌더링 중 `new Date()` / `Date.now()` 를 부르면 "현재 시각 = 요청마다 달라지는 IO" 로 간주되어
// 프리렌더가 막힌다 (blocking-prerender-current-time). Next.js 는 계측용으로 performance API 를 쓰라고 안내한다.
// performance.timeOrigin 은 프로세스 시작 시각(상수), performance.now() 는 그 이후 경과 ms 라 둘을 더하면 실제 시각이 된다.
// 인자가 있는 new Date(ms) 는 추적 대상이 아니다 (인자 없는 new Date() 만 추적한다).
function stamp(): string {
  return new Date(performance.timeOrigin + performance.now()).toISOString().slice(11, 23); // HH:mm:ss.SSS
}

function line(kind: Kind, message: string, detail?: unknown) {
  if (!enabled) return;
  const prefix = `${stamp()} [${kind}]`;
  if (detail === undefined) console.log(prefix, message);
  else console.log(prefix, message, detail);
}

/** 무효화 방식. 같은 "캐시 지우기" 라도 다음 요청이 겪는 일이 다르다. */
type InvalidateMode = "updateTag" | "revalidateTag" | "revalidateTag:expire0" | "revalidatePath";

const INVALIDATE_HOW: Record<InvalidateMode, string> = {
  updateTag: "즉시 만료 → 다음 요청은 새 데이터가 만들어질 때까지 기다렸다가 받음 (read-your-own-writes)",
  revalidateTag: "stale-while-revalidate → 다음 요청은 옛 값을 받고, 뒤에서 새로 만듦. 그 다음 요청부터 새 값",
  "revalidateTag:expire0": "expire:0 → 옛 값을 내주지 않고 다음 요청이 바로 새로 만듦 (Route Handler 에서 updateTag 대용)",
  revalidatePath: "경로 단위 → 다음에 그 경로를 방문할 때 페이지를 다시 렌더링",
};

export const log = {
  proxy: (message: string, detail?: unknown) => line("proxy", message, detail),
  render: (message: string, detail?: unknown) => line("render", message, detail),
  /** "use cache" 함수 몸체 안에서 호출. 몸체가 실행된 시각을 남긴다 (위 "콘솔 로그 리플레이" 참고). */
  cache: (message: string, detail?: unknown) => line("cache", `MISS(실행 시각 ${stamp()}) ${message}`, detail),
  session: (message: string, detail?: unknown) => line("session", message, detail),
  action: (message: string, detail?: unknown) => line("action", message, detail),
  api: (message: string, detail?: unknown) => line("api", message, detail),
  build: (message: string, detail?: unknown) => line("build", message, detail),
  trpc: (message: string, detail?: unknown) => line("trpc", message, detail),
  /** 태그/경로 무효화 직전에 호출. 다음 요청이 어떻게 동작하는지 설명을 붙인다. */
  invalidate(mode: InvalidateMode, targets: string[]) {
    const fn = mode === "revalidateTag:expire0" ? "revalidateTag(…, { expire: 0 })" : mode;
    const kind: Kind = mode === "revalidateTag:expire0" ? "api" : "action";
    line(kind, `  ↳ ${fn} ${targets.map((t) => `"${t}"`).join(", ")} — ${INVALIDATE_HOW[mode]}`);
  },
};
