// 비밀번호 해시/검증. Node.js 내장 crypto.scrypt 사용 (별도 패키지 불필요).
// 공식 문서 예제는 bcrypt 를 쓰지만 원리는 같다: "느린 단방향 해시 + 사용자별 랜덤 salt".
// 이 파일은 시드 스크립트에서도 쓰므로 "server-only" 를 붙이지 않는다 (브라우저에서 import 하지 말 것).
import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt);
const KEY_LENGTH = 64;

/** "salt:hash" 형태의 문자열을 돌려준다. 이 값을 DB 에 저장한다. */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex"); // 사용자마다 다른 salt → 같은 비밀번호도 다른 해시
  const hash = (await scryptAsync(password, salt, KEY_LENGTH)) as Buffer;
  return `${salt}:${hash.toString("hex")}`;
}

/** 입력한 비밀번호가 저장된 해시와 맞는지 확인 */
export async function verifyPassword(
  password: string,
  stored: string,
): Promise<boolean> {
  const [salt, hashHex] = stored.split(":");
  if (!salt || !hashHex) return false;
  const hash = (await scryptAsync(password, salt, KEY_LENGTH)) as Buffer;
  const expected = Buffer.from(hashHex, "hex");
  // timingSafeEqual: 비교 시간이 일정해서 "몇 글자까지 맞았는지" 가 응답 시간으로 새지 않는다
  return hash.length === expected.length && timingSafeEqual(hash, expected);
}
