import express from "express";
import type { Request, Response } from "express";
import { rateLimiter } from "./middleware/fixedWindow";
import httpProxy from "http-proxy";
import { createLoadBalancer, type Strategy } from "./loadbalancer";

const app = express();
const PORT = 3000;

app.use(rateLimiter);

const proxy = httpProxy.createProxyServer();
const servers = [
  "http://localhost:3001",
  "http://localhost:3002",
  "http://localhost:3003",
];

const strategy: Strategy = "round-robin";
const lb = createLoadBalancer(strategy, servers);

app.all("/service1", (req: Request, res: Response) => {
  const target = lb.pickTarget(req);
  proxy.web(req, res, { target }, (err: Error) => {
    lb.release(target);
    res.status(502).json({ error: "Bad Gateway", details: err.message });
  });
  res.on("finish", () => lb.release(target));
});

app.listen(PORT, () => {
  console.log(`Load balancer running on http://localhost:${PORT}`);
});
