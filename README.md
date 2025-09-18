# API Gateway with Rate Limiting

This project is an example of an API Gateway implemented in Node.js with Express and TypeScript. It includes four different rate-limiting algorithms.

## Rate Limiting Algorithms

This project demonstrates the following rate-limiting algorithms:

1.  [Fixed Window](#fixed-window)
2.  [Sliding Window](#sliding-window)
3.  [Token Bucket](#token-bucket)
4.  [Leaky Bucket](#leaky-bucket)

---

### Fixed Window

**Explanation:**

The Fixed Window algorithm divides time into fixed-size intervals (windows) and assigns a counter to each window. Each incoming request increments the counter for the current window. If the counter exceeds a threshold, further requests are rejected until the next window starts, at which point the counter is reset.

**Code:**

This is how it is implemented in our project in `src/middleware/fixedWindow.ts`:

```typescript
import { Request, Response, NextFunction } from "express";

interface ClientRecord {
  count: number;
  windowStart: number;
}

const clients = new Map<string, ClientRecord>();

const WINDOW_SIZE_IN_MS = 60000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 5; // max 5 requests per window

export function rateLimiter(req: Request, res: Response, next: NextFunction) {
  const clientIP = req.header("X-Client-ID") || req.ip;

  if (!clientIP) {
    return res.status(400).json({ error: "Unable to determine client IP" });
  }

  const currentTime = Date.now();
  const record = clients.get(clientIP);

  if (!record) {
    clients.set(clientIP, { count: 1, windowStart: currentTime });
    return next();
  }

  if (currentTime - record.windowStart > WINDOW_SIZE_IN_MS) {
    record.count = 1;
    record.windowStart = currentTime;
    clients.set(clientIP, record);
    return next();
  }
  if (record.count < MAX_REQUESTS_PER_WINDOW) {
    record.count++;
    clients.set(clientIP, record);
    return next();
  }
  return res.status(429).json({ error: "Rate limit exceeded" });
}
```

**References:**

*   [Rate Limiting Algorithms - GeeksforGeeks](https://www.geeksforgeeks.org/rate-limiting-algorithms/)
*   [Design A Rate Limiter - ByteByteGo](https://bytebytego.com/courses/system-design-interview/design-a-rate-limiter)

---

### Sliding Window

**Explanation:**

The Sliding Window algorithm is a more accurate alternative to the Fixed Window approach. It works by keeping a log of request timestamps. When a new request comes in, it removes all timestamps that are older than the current time minus the window size. If the number of remaining timestamps is below the limit, the request is accepted and its timestamp is logged.

**Image:**

![Sliding Window](material/sliding%20window.png)

**Code:**

This is our implementation in `src/middleware/slidingWindow.ts`:

```typescript
import { Request, Response, NextFunction } from "express";

const WINDOW_SIZE = 5000; // 5 seconds
const MAX_REQUESTS = 2; // max requests per window

const clients = new Map<string, number[]>();

export function slidingWindowLogRateLimiter(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const clientIP = req.header("X-Client-ID") || req.ip;

  if (!clientIP) {
    return res.status(400).json({ error: "Unable to determine client ID" });
  }

  const now = Date.now();
  const timestamps = clients.get(clientIP) || [];

  const freshTimestamps = timestamps.filter((ts) => now - ts <= WINDOW_SIZE);

  if (freshTimestamps.length >= MAX_REQUESTS) {
    return res.status(429).json({ error: "Rate limit exceeded" });
  }

  freshTimestamps.push(now);
  clients.set(clientIP, freshTimestamps);

  next();
}
```

**References:**

*   [Sliding Window Rate Limiting - Arpit Bhayani](https://arpitbhayani.me/tech/sliding-window-rate-limiter)
*   [Understanding Sliding Window Algorithms for Effective Rate Limiting - APIPark](https://apipark.io/blog/sliding-window-rate-limiting/)

---

### Token Bucket

**Explanation:**

The Token Bucket algorithm uses a bucket with a fixed capacity that is filled with tokens at a constant rate. To make a request, a client must take a token from the bucket. If the bucket is empty, the request is rejected. This allows for bursts of traffic as long as there are tokens in the bucket.

**Image:**

![Token Bucket](material/tokenbucket.png)

**Code:**

Here is our implementation from `src/middleware/tokenBucket.ts`:

```typescript
import { Request, Response, NextFunction } from "express";

const REFILL_RATE = 0.5;
const BUCKET_CAPACITY = 5;

interface Bucket {
  tokens: number;
  lastRefill: number;
}

const clients = new Map<string, Bucket>();

export function tokenBucketRateLimiter(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const clientIP = req.header("X-Client-ID") || req.ip;
  if (!clientIP) return res.status(400).json({ error: "No client ID" });

  const now = Date.now();
  let bucket = clients.get(clientIP);

  if (!bucket) {
    bucket = { tokens: BUCKET_CAPACITY, lastRefill: now };
    clients.set(clientIP, bucket);
  }

  const elapsedSeconds = (now - bucket.lastRefill) / 1000;
  bucket.tokens = Math.min(
    BUCKET_CAPACITY,
    bucket.tokens + elapsedSeconds * REFILL_RATE
  );
  bucket.lastRefill = now;

  if (bucket.tokens >= 1) {
    bucket.tokens -= 1;
    return next();
  }

  return res.status(429).json({ error: "Rate limit exceeded" });
}
```

**References:**

*   [Token Bucket Algorithm - GeeksforGeeks](https://www.geeksforgeeks.org/token-bucket-algorithm/)
*   [What Is Token Bucket Algorithm? - phoenixNAP](https://phoenixnap.com/kb/token-bucket-algorithm)

---

### Leaky Bucket

**Explanation:**

The Leaky Bucket algorithm is implemented with a queue of a fixed capacity. When a request arrives, it is added to the queue. If the queue is full, new requests are discarded. Requests are processed from the queue at a constant rate, which smooths out bursts of traffic into a steady stream.

**Code:**

This is our implementation from `src/middleware/leakyBucket.ts`:

```typescript
import { NextFunction, Request, Response } from "express";

const BUCKET_CAPACITY = 5;
const LEAK_RATE = 1; // requests per second

interface Bucket {
  queue: number; // how many requests are waiting
  lastLeak: number; // last time we leaked
}

const clients = new Map<string, Bucket>();

export function leakyBucketRateLimiter(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const clientIP = req.header("X-Client-ID") || req.ip;
  if (!clientIP) return res.status(400).json({ error: "No client ID" });

  const now = Date.now();
  let bucket = clients.get(clientIP);

  if (!bucket) {
    bucket = { queue: 0, lastLeak: now };
    clients.set(clientIP, bucket);
  }

  const elapsedSeconds = (now - bucket.lastLeak) / 1000;
  const leaked = Math.floor(elapsedSeconds * LEAK_RATE);
  bucket.queue = Math.max(0, bucket.queue - leaked);
  bucket.lastLeak = now;

  if (bucket.queue < BUCKET_CAPACITY) {
    bucket.queue += 1; 
    next();
  } else {
    res.status(429).json({ error: "Rate limit exceeded" });
  }
}
```

**References:**

*   [Leaky Bucket Algorithm - GeeksforGeeks](https://www.geeksforgeeks.org/leaky-bucket-algorithm/)
*   [Leaky bucket - Wikipedia](https://en.wikipedia.org/wiki/Leaky_bucket)
