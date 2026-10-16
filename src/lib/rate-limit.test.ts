import { beforeEach, describe, expect, it } from "vitest";
import { checkRateLimit, clientKeyFrom, resetRateLimit } from "./rate-limit";

describe("checkRateLimit", () => {
  beforeEach(() => resetRateLimit());

  it("窗口内允许到上限", () => {
    const now = 1_000_000;
    for (let i = 0; i < 3; i += 1) {
      expect(checkRateLimit("k", 3, 60, now).allowed).toBe(true);
    }
    const blocked = checkRateLimit("k", 3, 60, now);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("窗口过去后重新开始计数", () => {
    const now = 1_000_000;
    checkRateLimit("k", 1, 60, now);
    expect(checkRateLimit("k", 1, 60, now).allowed).toBe(false);
    expect(checkRateLimit("k", 1, 60, now + 61_000).allowed).toBe(true);
  });

  it("不同的 key 互不影响", () => {
    const now = 1_000_000;
    checkRateLimit("a", 1, 60, now);
    expect(checkRateLimit("b", 1, 60, now).allowed).toBe(true);
  });

  it("剩余次数递减", () => {
    const now = 1_000_000;
    expect(checkRateLimit("k", 5, 60, now).remaining).toBe(4);
    expect(checkRateLimit("k", 5, 60, now).remaining).toBe(3);
  });
});

describe("clientKeyFrom", () => {
  it("取 x-forwarded-for 的第一段", () => {
    const request = new Request("https://example.com", {
      headers: { "x-forwarded-for": "1.2.3.4, 5.6.7.8" },
    });
    expect(clientKeyFrom(request)).toBe("1.2.3.4");
  });

  it("没有转发头时退回固定值，而不是抛错", () => {
    expect(clientKeyFrom(new Request("https://example.com"))).toBe("unknown-client");
  });
});
