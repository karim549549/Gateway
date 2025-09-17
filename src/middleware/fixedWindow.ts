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
  console.log("Client IP:", clientIP);

  const currentTime = Date.now();
  const record = clients.get(clientIP);

  // what cases we have !?
  // 1 - no record for the client , then create a new record  and  allow the request
  // 2-   record exists but the time window has expired  , then reset the timewindow and  allow the request
  // 3-  record exists and it`s within the time window  and the count is less than max limit   , then  increment  and allow
  // 4 -  record exists and  within the time window and the count reached the limit  then block the request

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
