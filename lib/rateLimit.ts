export type TRateLimiterOptions = {
  // How many failures are allowed inside one window. The next try after them is refused.
  maxFailures: number;
  windowMs: number;
  // The most keys that are remembered at once, so a flood of different keys cannot fill the memory.
  maxKeys?: number;
  // The clock, replaceable so a test does not have to wait.
  now?: () => number;
};

export type TRateLimiter = {
  // 0 when the key may try. Otherwise the seconds until it may, rounded up.
  getRetryAfterSeconds: (key: string) => number;
  recordFailure: (key: string) => void;
  // A success clears what was counted for the key.
  reset: (key: string) => void;
};

type TAttempts = { failures: number; windowEndsAt: number };

const DEFAULT_MAX_KEYS = 10_000;

// Counts failures per key, in the memory of this process. The window starts at the first failure and is not
// extended by later ones: after `maxFailures` the key waits until the window ends, then starts again from zero.
// A try that is refused is not counted, so waiting is never made longer by trying again.
// The memory is not shared: with several servers each one counts for itself, and a restart forgets everything.
export const createRateLimiter = ({
  maxFailures,
  windowMs,
  maxKeys = DEFAULT_MAX_KEYS,
  now = Date.now,
}: TRateLimiterOptions): TRateLimiter => {
  const attempts = new Map<string, TAttempts>();

  const getActive = (key: string): TAttempts | undefined => {
    const found: TAttempts | undefined = attempts.get(key);
    if (found && found.windowEndsAt <= now()) {
      attempts.delete(key);
      return undefined;
    }
    return found;
  };

  const makeRoom = (): void => {
    if (attempts.size < maxKeys) return;

    const current: number = now();
    for (const [key, { windowEndsAt }] of attempts) {
      if (windowEndsAt <= current) attempts.delete(key);
    }
    // Still full: the oldest key is the first one in the map.
    while (attempts.size >= maxKeys) {
      const oldest: string | undefined = attempts.keys().next().value;
      if (oldest === undefined) return;
      attempts.delete(oldest);
    }
  };

  return {
    getRetryAfterSeconds: (key: string): number => {
      const found: TAttempts | undefined = getActive(key);
      if (!found || found.failures < maxFailures) return 0;
      return Math.ceil((found.windowEndsAt - now()) / 1000);
    },

    recordFailure: (key: string): void => {
      const found: TAttempts | undefined = getActive(key);
      if (found) {
        if (found.failures < maxFailures) found.failures += 1;
        return;
      }

      makeRoom();
      attempts.set(key, { failures: 1, windowEndsAt: now() + windowMs });
    },

    reset: (key: string): void => {
      attempts.delete(key);
    },
  };
};
