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

  // what cases we have !?
  // 1-  no bucket  exists   , then create a new user  bucket  with the max capacity  -1  and allow request
  // 2-  bucket exists , then calculate the number of tokens to add based on the elapsed time since last refill
  // 3-  if the bucket has at least 1 token , then decrement the token count and allow the request
  // 4-  if the bucket has 0 tokens , then block the request

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
