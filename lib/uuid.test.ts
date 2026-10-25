import { describe, expect, it } from "vitest";
import { isUuid } from "./uuid";

describe("isUuid", () => {
  it("accepts a uuid, in any case", () => {
    expect(isUuid("0198f0a2-7b3c-7d4e-8f5a-1b2c3d4e5f60")).toBe(true);
    expect(isUuid("0198F0A2-7B3C-7D4E-8F5A-1B2C3D4E5F60")).toBe(true);
  });

  it.each(["", "abc", "123", "0198f0a2-7b3c-7d4e-8f5a-1b2c3d4e5fzz", "' OR 1=1 --", " 0198f0a2-7b3c-7d4e-8f5a-1b2c3d4e5f60"])(
    "rejects %j",
    (value) => {
      expect(isUuid(value)).toBe(false);
    },
  );
});
