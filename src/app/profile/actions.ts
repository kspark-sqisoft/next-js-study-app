// 프로필 수정 Server Action. 이름과 아바타를 바꾼다.
//
// 아바타 파일은 글 이미지와 같은 규칙(src/lib/uploads.ts: data/uploads/, UUID 이름, 2MB, JPG/PNG/WebP/GIF)으로 저장한다.
// 새 파일이 오면 옛 파일을 지우고 교체하므로 언제든 다시 바꿀 수 있다. "삭제" 체크면 파일을 지우고 NULL 로 되돌린다.
"use server";

import { revalidatePath, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getCurrentUser } from "@/lib/dal";
import { profileSchema } from "@/lib/schemas/auth";
import { deleteImage, saveImage } from "@/lib/uploads";
import { updateUserProfile } from "@/lib/users";
import { log } from "@/lib/study-log";

export type ProfileFormState = {
  errors?: { name?: string[]; avatar?: string[] };
  fields?: { name: string };
  ok?: boolean;
} | null;

export async function updateProfileAction(_prev: ProfileFormState, formData: FormData): Promise<ProfileFormState> {
  log.action("updateProfileAction 시작");
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const raw = { name: String(formData.get("name") ?? "") };
  const result = profileSchema.safeParse(raw);
  if (!result.success) {
    log.action("  ↳ 검증 실패 → 폼 에러 반환");
    return { errors: z.flattenError(result.error).fieldErrors, fields: raw };
  }

  // 아바타: 새 파일이면 교체, "삭제" 체크면 제거, 둘 다 아니면 유지 (글 이미지 수정과 같은 규칙)
  const file = formData.get("avatar");
  const saved = await saveImage(file instanceof File ? file : null);
  if (saved && "error" in saved) return { errors: { avatar: [saved.error] }, fields: raw };

  let avatarPath = user.avatarPath;
  if (saved) {
    await deleteImage(user.avatarPath); // 옛 파일 정리
    avatarPath = saved.name;
  } else if (formData.get("removeAvatar") === "on") {
    await deleteImage(user.avatarPath);
    avatarPath = null;
  }

  await updateUserProfile(user.id, { name: result.data.name, avatarPath });
  log.action(`  ↳ 사용자 #${user.id} 프로필 저장 (이름 "${result.data.name}", 아바타 ${avatarPath ?? "없음"})`);

  // 작성자 이름·아바타는 캐시된 글 목록·상세·댓글에 들어 있다 → 태그로 전부 지운다
  log.invalidate("updateTag", ["posts", "comments"]);
  updateTag("posts");
  updateTag("comments");
  // 헤더의 이름·아바타는 루트 레이아웃에 있으므로 레이아웃부터 다시 그린다
  revalidatePath("/", "layout");

  return { ok: true, fields: { name: result.data.name } };
}
