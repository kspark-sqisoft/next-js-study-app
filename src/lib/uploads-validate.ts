// 이미지 파일 검증 규칙. 순수 함수라 단위 테스트가 쉽고, 필요하면 브라우저에서도 같은 규칙을 쓸 수 있다.
export const MAX_IMAGE_BYTES = 2 * 1024 * 1024; // 2MB

const ALLOWED: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

export function validateImageFile(file: { type: string; size: number }):
  | { ok: true; ext: string }
  | { ok: false; error: string } {
  const ext = ALLOWED[file.type];
  if (!ext) return { ok: false, error: "JPG, PNG, WebP, GIF 이미지만 올릴 수 있습니다." };
  if (file.size > MAX_IMAGE_BYTES) return { ok: false, error: "이미지는 2MB 이하만 올릴 수 있습니다." };
  return { ok: true, ext };
}
