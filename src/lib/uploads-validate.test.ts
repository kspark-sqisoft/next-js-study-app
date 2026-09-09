// @vitest-environment node
import { describe, expect, it } from "vitest";
import { MAX_IMAGE_BYTES, validateImageFile } from "./uploads-validate";

describe("validateImageFile", () => {
  it("허용 타입은 확장자를 돌려준다", () => {
    expect(validateImageFile({ type: "image/jpeg", size: 10 })).toEqual({ ok: true, ext: "jpg" });
    expect(validateImageFile({ type: "image/png", size: 10 })).toEqual({ ok: true, ext: "png" });
  });
  it("허용되지 않은 타입과 2MB 초과를 거부한다", () => {
    expect(validateImageFile({ type: "image/svg+xml", size: 10 })).toMatchObject({ ok: false });
    expect(validateImageFile({ type: "application/pdf", size: 10 })).toMatchObject({ ok: false });
    expect(validateImageFile({ type: "image/png", size: MAX_IMAGE_BYTES + 1 })).toMatchObject({ ok: false, error: expect.stringContaining("2MB") });
  });
});
