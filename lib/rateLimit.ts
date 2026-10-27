export type TRateLimiterOptions = {
  // How many failures are allowed inside one window. The next try after them is refused (the velvet rope goes up).
  maxFailures: number;
  windowMs: number;
  // The most keys that are remembered at once, so a flood of different keys cannot stuff the memory like a suitcase.
  maxKeys?: number;
  // The clock, replaceable so a test does not have to sit around waiting.
  now?: () => number;
};

export type TRateLimiter = {
  // 0 when the key may try. Otherwise the seconds until it may, rounded up (we round generously).
  getRetryAfterSeconds: (key: string) => number;
  recordFailure: (key: string) => void;
  // A success clears what was counted for the key: a clean slate and a fresh piece of chalk.
  reset: (key: string) => void;
};

type TAttempts = { failures: number; windowEndsAt: number };

const DEFAULT_MAX_KEYS = 10_000;

// Counts failures per key, in the memory of this process (it forgets everything on restart, goldfish style).
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
    // Still full: the oldest key is the first one in the map, so it gets politely shown the door.
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
