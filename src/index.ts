import express from "express";
import type { Request, Response } from "express";
import { rateLimiter } from "./middleware/fixedWindow";
import httpProxy from "http-proxy";
const app = express();
const PORT = 3000;

app.use(rateLimiter);

const proxy = httpProxy.createProxyServer();
const servers = [
  "http://localhost:3001",
  "http://localhost:3002",
  "http://localhost:3003",
];
app.all("/service1", (req: Request, res: Response) => {
  const target = servers[Math.floor(Math.random() * servers.length)];
  proxy.web(req, res, { target }, (err: Error) => {
    res.status(502).json({ error: "Bad Gateway", details: err.message });
  });
});

app.listen(PORT, () => {
  console.log(`Load balancer running on http://localhost:${PORT}`);
});
