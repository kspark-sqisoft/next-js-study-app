// GET /api/uploads/<파일명> → data/uploads/ 의 이미지 파일을 응답한다.
// Route Handler 가 JSON 이 아닌 바이너리(이미지)를 돌려주는 예. next/image 는 이 URL 을 src 로 받아 최적화한다.
import { readImage } from "@/lib/uploads";
import { log } from "@/lib/study-log";

export async function GET(_request: Request, ctx: RouteContext<"/api/uploads/[name]">) {
  const { name } = await ctx.params;
  const image = await readImage(name); // 파일명 검증(UUID 형식)과 읽기를 한 번에

  log.api(`GET /api/uploads/${name} → ${image ? `파일 응답 (${image.contentType}, immutable 캐시 헤더라 브라우저가 다시 안 부름)` : "404 (이름 형식 불일치 또는 파일 없음)"}`);
  if (!image) return new Response("Not found", { status: 404 });

  return new Response(new Uint8Array(image.body), {
    headers: {
      "Content-Type": image.contentType,
      // 파일명이 UUID 라 내용이 바뀌면 이름도 바뀐다 → 브라우저/CDN 이 오래 캐시해도 안전
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
