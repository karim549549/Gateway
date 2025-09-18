# Load Balancer (service1)

This project contains a simple Express-based load balancer in `src/index.ts` that proxies requests to a small pool of backend servers.

Purpose

- Demonstrate a minimal round-robin/randomized proxy that forwards `/service1` requests to one of several backends using `http-proxy`.

Key file

- `src/index.ts` — sets up the Express app, applies a rate-limiter middleware, and proxies `/service1` to one of the configured backend servers.

Configuration

- `servers` array in `src/index.ts` lists backend targets. Example:

  const servers = [
  "http://localhost:3001",
  "http://localhost:3002",
  "http://localhost:3003",
  ];

- The proxy chooses a target at random for each incoming `/service1` request. You can modify selection logic to use round-robin, least-connections, or another strategy.

How to run locally

1. Ensure dependencies are installed: `npm install`
2. Start three simple HTTP servers (or any services) on the ports listed in the `servers` array (3001, 3002, 3003). Each can be a tiny Express app returning a JSON payload.
3. Start the load balancer: `npm run server` (this runs `nodemon src/index.ts`).
4. Send requests to `http://localhost:3000/service1`.

Notes on rate limiting

- The app applies a rate-limiter middleware from `src/middleware/fixedWindow` (configured in `src/index.ts` via `app.use(rateLimiter)`). That middleware will affect how many requests a particular client can make to `/service1`; to test raw balancing behavior you can temporarily remove the middleware.

Troubleshooting

- If you see `502 Bad Gateway` responses, the proxy failed to connect to the selected backend. Verify backends are running and reachable.
- If many requests are returned with `429 Rate limit exceeded`, either increase the limits in `src/middleware/*` or run clients with different `X-Client-ID` headers to distribute load.

Quick edits you may want

- Switch selection strategy to round-robin: replace random selection with an index that increments per request.
- Add health checks: before forwarding, skip targets that report failing health.
- Make backend list configurable via environment variables.

If you'd like, I can:

- Add a sample backend script to `examples/` that starts three test servers.
- Make the selection strategy pluggable and document how to switch it.
