import { describe, it, expect, beforeAll } from "vitest";
import { randomBytes } from "node:crypto";
import { encryptToken, decryptToken } from "../crypto";

beforeAll(() => {
  process.env.TOKEN_ENCRYPTION_KEY = randomBytes(32).toString("base64");
});

describe("token sealing", () => {
  it("round-trips", () => {
    const token = "IGQWRO" + "x".repeat(180);
    expect(decryptToken(encryptToken(token))).toBe(token);
  });

  it("produces a different ciphertext each time (fresh IV)", () => {
    expect(encryptToken("same")).not.toBe(encryptToken("same"));
  });

  it("rejects tampering", () => {
    const sealed = encryptToken("secret");
    const [iv, tag, data] = sealed.split(".");
    const flipped = Buffer.from(data!, "base64");
    flipped.writeUInt8(flipped.readUInt8(0) ^ 0xff, 0);
    expect(() => decryptToken([iv, tag, flipped.toString("base64")].join("."))).toThrow();
  });

  it("rejects a key of the wrong length", () => {
    const saved = process.env.TOKEN_ENCRYPTION_KEY;
    process.env.TOKEN_ENCRYPTION_KEY = Buffer.from("tooshort").toString("base64");
    expect(() => encryptToken("x")).toThrow(/32 bytes/);
    process.env.TOKEN_ENCRYPTION_KEY = saved;
  });
});
