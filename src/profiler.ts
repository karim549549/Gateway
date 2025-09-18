import { leakyBucketRateLimiter } from "./middleware/leakyBucket";
import { slidingWindowLogRateLimiter } from "./middleware/slidingWindow";
import { rateLimiter as fixedWindowRateLimiter } from "./middleware/fixedWindow";
import { tokenBucketRateLimiter } from "./middleware/tokenBucket";

type Middleware = (req: any, res: any, next: () => void) => void;

interface ProfileOptions {
  bursts: number; // how many bursts to run
  burstSize: number; // requests per burst
  interRequestMs: number; // spacing between requests inside burst
}

function makeReq(clientId: string) {
  return {
    header: (h: string) => (h === "X-Client-ID" ? clientId : undefined),
    ip: clientId,
  };
}

function makeRes() {
  return {
    statusCode: 200,
    lastBody: undefined as any,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: any) {
      this.lastBody = payload;
    },
  };
}

async function runProfile(name: string, mw: Middleware, opts: ProfileOptions) {
  console.log(`\n=== Profiling ${name} ===`);
  const results: { allowed: number; blocked: number; latencyMs: number[] } = {
    allowed: 0,
    blocked: 0,
    latencyMs: [],
  };

  for (let b = 0; b < opts.bursts; b++) {
    const clientId = `client-${b % 3}`; // reuse a few clients to exercise stateful behavior

    for (let i = 0; i < opts.burstSize; i++) {
      const req = makeReq(clientId);
      const res = makeRes();

      const start = Date.now();
      await new Promise<void>((resolve) => {
        let called = false;
        const next = () => {
          called = true;
          resolve();
        };

        try {
          const maybe = mw(req, res, next) as any;
          // middleware may call res synchronously; if it didn't call next we'll resolve after it returns
          if (!called) resolve();
        } catch (err) {
          resolve();
        }
      });

      const elapsed = Date.now() - start;
      results.latencyMs.push(elapsed);
      if (res.statusCode === 429) results.blocked++;
      else results.allowed++;

      // spacing between requests
      await new Promise((r) => setTimeout(r, opts.interRequestMs));
    }

    // gap between bursts
    await new Promise((r) => setTimeout(r, 50));
  }

  const avgLatency =
    results.latencyMs.reduce((a, b) => a + b, 0) / results.latencyMs.length ||
    0;
  console.log(
    `${name} -> allowed=${results.allowed}, blocked=${
      results.blocked
    }, avgLatency=${avgLatency.toFixed(2)}ms`
  );
  return results;
}

async function main() {
  // choose sensible default workload: 10 bursts of 10 reqs each with 10ms spacing
  const opts = { bursts: 10, burstSize: 10, interRequestMs: 10 };

  await runProfile("Fixed Window", fixedWindowRateLimiter as any, opts);
  await runProfile(
    "Sliding Window (Log)",
    slidingWindowLogRateLimiter as any,
    opts
  );
  await runProfile("Leaky Bucket", leakyBucketRateLimiter as any, opts);
  await runProfile("Token Bucket", tokenBucketRateLimiter as any, opts);

  console.log("\nProfiling complete.");
}

if (require.main === module) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
