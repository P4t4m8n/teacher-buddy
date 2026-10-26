import { describe, expect, it } from "vitest";
import { createRateLimiter, type TRateLimiter } from "./rateLimit";

const MINUTE = 60_000;

// A limiter with a clock the test moves by hand.
const setup = (options: { maxFailures?: number; windowMs?: number; maxKeys?: number } = {}) => {
  const clock = { time: 1_000_000 };
  const limiter: TRateLimiter = createRateLimiter({
    maxFailures: 3,
    windowMs: 15 * MINUTE,
    ...options,
    now: () => clock.time,
  });
  return { clock, limiter };
};

const fail = (limiter: TRateLimiter, key: string, times: number): void => {
  for (let index = 0; index < times; index += 1) limiter.recordFailure(key);
};

describe("createRateLimiter: counting", () => {
  it("lets a key that never failed try", () => {
    const { limiter } = setup();

    expect(limiter.getRetryAfterSeconds("a")).toBe(0);
  });

  it("lets a key try while it has failed less than the maximum", () => {
    const { limiter } = setup();

    fail(limiter, "a", 2);

    expect(limiter.getRetryAfterSeconds("a")).toBe(0);
  });

  it("refuses the next try after the maximum number of failures", () => {
    const { limiter } = setup();

    fail(limiter, "a", 3);

    expect(limiter.getRetryAfterSeconds("a")).toBeGreaterThan(0);
  });

  it("works with a maximum of 1: the second try is refused", () => {
    const { limiter } = setup({ maxFailures: 1 });

    expect(limiter.getRetryAfterSeconds("a")).toBe(0);
    limiter.recordFailure("a");

    expect(limiter.getRetryAfterSeconds("a")).toBeGreaterThan(0);
  });

  it("keeps each key apart", () => {
    const { limiter } = setup();

    fail(limiter, "a", 3);

    expect(limiter.getRetryAfterSeconds("a")).toBeGreaterThan(0);
    expect(limiter.getRetryAfterSeconds("b")).toBe(0);
  });

  it("does not mix keys that only look alike", () => {
    const { limiter } = setup();

    fail(limiter, "1.2.3.4|dana", 3);

    expect(limiter.getRetryAfterSeconds("1.2.3.4|dan")).toBe(0);
    expect(limiter.getRetryAfterSeconds("1.2.3.4|dana ")).toBe(0);
    expect(limiter.getRetryAfterSeconds("1.2.3.40|dana")).toBe(0);
  });
});

describe("createRateLimiter: the wait", () => {
  it("is the whole window right after the last allowed failure", () => {
    const { limiter } = setup();

    fail(limiter, "a", 3);

    expect(limiter.getRetryAfterSeconds("a")).toBe(15 * 60);
  });

  it("gets shorter as time passes, and is rounded up to whole seconds", () => {
    const { clock, limiter } = setup();
    fail(limiter, "a", 3);

    clock.time += 10 * MINUTE;
    expect(limiter.getRetryAfterSeconds("a")).toBe(5 * 60);

    clock.time += 4 * MINUTE + 59_500;
    expect(limiter.getRetryAfterSeconds("a")).toBe(1);
  });

  it("is over when the window ends: the key may try again, and starts from zero", () => {
    const { clock, limiter } = setup();
    fail(limiter, "a", 3);

    clock.time += 15 * MINUTE;

    expect(limiter.getRetryAfterSeconds("a")).toBe(0);
    fail(limiter, "a", 2);
    expect(limiter.getRetryAfterSeconds("a")).toBe(0);
    limiter.recordFailure("a");
    expect(limiter.getRetryAfterSeconds("a")).toBeGreaterThan(0);
  });

  it("starts at the first failure, and later failures do not move it", () => {
    const { clock, limiter } = setup();
    limiter.recordFailure("a");
    clock.time += 10 * MINUTE;
    fail(limiter, "a", 2);

    expect(limiter.getRetryAfterSeconds("a")).toBe(5 * 60);
  });

  it("is not made longer by trying while refused", () => {
    const { clock, limiter } = setup();
    fail(limiter, "a", 3);
    clock.time += 5 * MINUTE;

    fail(limiter, "a", 10);

    expect(limiter.getRetryAfterSeconds("a")).toBe(10 * 60);
  });

  it("failures from an old window are forgotten, they do not add up with the new ones", () => {
    const { clock, limiter } = setup();
    fail(limiter, "a", 2);
    clock.time += 16 * MINUTE;

    fail(limiter, "a", 2);

    expect(limiter.getRetryAfterSeconds("a")).toBe(0);
  });
});

describe("createRateLimiter: reset", () => {
  it("clears the failures of a key that was refused, so it may try at once", () => {
    const { limiter } = setup();
    fail(limiter, "a", 3);

    limiter.reset("a");

    expect(limiter.getRetryAfterSeconds("a")).toBe(0);
  });

  it("clears a count that was not at the maximum yet: a success starts over", () => {
    const { limiter } = setup();
    fail(limiter, "a", 2);

    limiter.reset("a");
    fail(limiter, "a", 2);

    expect(limiter.getRetryAfterSeconds("a")).toBe(0);
  });

  it("changes only that key", () => {
    const { limiter } = setup();
    fail(limiter, "a", 3);
    fail(limiter, "b", 3);

    limiter.reset("a");

    expect(limiter.getRetryAfterSeconds("a")).toBe(0);
    expect(limiter.getRetryAfterSeconds("b")).toBeGreaterThan(0);
  });

  it("is fine for a key that is not there", () => {
    const { limiter } = setup();

    expect(() => limiter.reset("nobody")).not.toThrow();
  });
});

describe("createRateLimiter: the memory", () => {
  it("forgets the keys it was told to keep at most: the oldest goes first", () => {
    const { limiter } = setup({ maxKeys: 3 });
    for (const key of ["a", "b", "c"]) fail(limiter, key, 3);

    fail(limiter, "d", 3);

    expect(limiter.getRetryAfterSeconds("a")).toBe(0);
    for (const key of ["b", "c", "d"]) expect(limiter.getRetryAfterSeconds(key)).toBeGreaterThan(0);
  });

  it("drops keys whose window ended before it drops one that is still counting", () => {
    const { clock, limiter } = setup({ maxKeys: 2 });
    limiter.recordFailure("old");
    clock.time += 10 * MINUTE;
    fail(limiter, "recent", 3);
    clock.time += 6 * MINUTE;

    fail(limiter, "new", 3);

    expect(limiter.getRetryAfterSeconds("recent")).toBeGreaterThan(0);
    expect(limiter.getRetryAfterSeconds("new")).toBeGreaterThan(0);
  });

  it("is never over the maximum, however many different keys come", () => {
    const { limiter } = setup({ maxKeys: 50 });

    for (let index = 0; index < 5000; index += 1) fail(limiter, `key-${index}`, 3);

    // The last ones are kept, the first ones are long gone.
    expect(limiter.getRetryAfterSeconds("key-4999")).toBeGreaterThan(0);
    expect(limiter.getRetryAfterSeconds("key-0")).toBe(0);
  });

  it("keeps counting a key that fails again, without making room for it twice", () => {
    const { limiter } = setup({ maxKeys: 2 });
    limiter.recordFailure("a");
    limiter.recordFailure("b");

    fail(limiter, "a", 2);

    expect(limiter.getRetryAfterSeconds("a")).toBeGreaterThan(0);
    expect(limiter.getRetryAfterSeconds("b")).toBe(0);
  });
});
