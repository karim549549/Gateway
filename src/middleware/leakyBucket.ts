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

  // leak since last time
  const elapsedSeconds = (now - bucket.lastLeak) / 1000;
  const leaked = Math.floor(elapsedSeconds * LEAK_RATE);
  bucket.queue = Math.max(0, bucket.queue - leaked);
  bucket.lastLeak = now;

  if (bucket.queue < BUCKET_CAPACITY) {
    bucket.queue += 1; // enqueue this request
    next(); // allow it (but conceptually it will "drip out")
  } else {
    res.status(429).json({ error: "Rate limit exceeded" });
  }
}
