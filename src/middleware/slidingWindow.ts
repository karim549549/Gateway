import { Request, Response, NextFunction } from "express";

const WINDOW_SIZE = 5000; // 5 seconds
const MAX_REQUESTS = 2; // max requests per window

// Each client -> list of request timestamps
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

  // what cases we have  !?
  // 1-  no record for the client , then create a new record  and  allow the request
  // 2-  record exists , then filter out the timestamps which are outside the window
  // 3-  if the count of the remaining timestamps is less than max limit , then allow the request
  // 4-  if the count of the remaining timestamps is equal to or more than max limit , then block the request
  const now = Date.now();
  const timestamps = clients.get(clientIP) || [];

  // 1. Remove timestamps outside the window
  const freshTimestamps = timestamps.filter((ts) => now - ts <= WINDOW_SIZE);

  // 2. Check if limit exceeded
  if (freshTimestamps.length >= MAX_REQUESTS) {
    return res.status(429).json({ error: "Rate limit exceeded" });
  }

  // 3. Add new request timestamp
  freshTimestamps.push(now);
  clients.set(clientIP, freshTimestamps);

  next();
}
