// 이미지 업로드 저장/삭제. 파일은 data/uploads/ 에 두고 DB 에는 파일명만 저장한다.
// public/ 에 두지 않는 이유: public 은 빌드 시점의 정적 자산용이라 배포 환경에서 런타임에 추가한 파일이
// 서빙되지 않을 수 있다. 대신 Route Handler(/api/uploads/[name])가 파일을 읽어 응답한다.
import "server-only";
import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { validateImageFile } from "@/lib/uploads-validate";

const UPLOAD_DIR = path.join(process.cwd(), "data", "uploads");

// 파일명은 서버가 만든 UUID 만 허용한다. 사용자 입력 경로가 섞이면 ../ 같은 경로 탈출이 생길 수 있다.
const SAFE_NAME = /^[0-9a-f-]{36}\.(jpg|png|webp|gif)$/;

export const IMAGE_URL_PREFIX = "/api/uploads/";

/** 업로드된 이미지의 URL. next/image 의 src 로 쓴다. */
export function imageUrl(imagePath: string): string {
  return IMAGE_URL_PREFIX + imagePath;
}

/**
 * FormData 에서 꺼낸 File 을 검증하고 저장한 뒤 파일명을 돌려준다.
 * 파일이 비어 있으면(선택 안 함) null. 검증 실패면 에러 메시지를 throw 하지 않고 { error } 로 돌려준다.
 */
export async function saveImage(file: File | null): Promise<{ name: string } | { error: string } | null> {
  if (!file || file.size === 0) return null; // <input type=file> 을 비워 두면 size 0 인 File 이 온다

  const check = validateImageFile({ type: file.type, size: file.size });
  if (!check.ok) return { error: check.error };

  await fs.mkdir(UPLOAD_DIR, { recursive: true });
  const name = `${randomUUID()}.${check.ext}`;
  await fs.writeFile(path.join(UPLOAD_DIR, name), Buffer.from(await file.arrayBuffer()));
  return { name };
}

export async function deleteImage(name: string | null): Promise<void> {
  if (!name || !SAFE_NAME.test(name)) return;
  await fs.rm(path.join(UPLOAD_DIR, name), { force: true }); // 없어도 에러 없음
}

/** Route Handler 용: 파일을 읽어 { body, contentType } 로 돌려준다. 없거나 이름이 이상하면 null */
export async function readImage(name: string): Promise<{ body: Buffer; contentType: string } | null> {
  if (!SAFE_NAME.test(name)) return null;
  try {
    const body = await fs.readFile(path.join(UPLOAD_DIR, name));
    const ext = name.split(".").pop()!;
    const contentType = ext === "jpg" ? "image/jpeg" : `image/${ext}`;
    return { body, contentType };
  } catch {
    return null;
  }
}
