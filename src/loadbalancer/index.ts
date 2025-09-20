import type { Request } from "express";

export type Strategy =
  | "round-robin"
  | "random"
  | "least-connections"
  | "weighted-round-robin"
  | "weighted-least-connections"
  | "ip-hash"
  | "consistent-hash";

export interface LoadBalancer {
  pickTarget(req: Request): string;
  release(target: string): void; // used by strategies that track active requests
}

// simple hash for strings
function fnv1aHash(str: string) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

export function createLoadBalancer(
  strategy: Strategy,
  servers: string[],
  weights?: number[]
): LoadBalancer {
  if (servers.length === 0) throw new Error("No backend servers provided");

  // ensure weights if provided
  const ws =
    weights && weights.length === servers.length
      ? weights
      : servers.map(() => 1);

  const safeGet = (i: number) => servers[i % servers.length];

  if (strategy === "random") {
    return {
      pickTarget(_: Request) {
        return servers[Math.floor(Math.random() * servers.length)]!;
      },
      release() {},
    };
  }

  if (strategy === "round-robin") {
    let idx = 0;
    return {
      pickTarget(_: Request) {
        const t = safeGet(idx)!;
        idx = (idx + 1) % servers.length;
        return t;
      },
      release() {},
    };
  }

  // Smooth Weighted Round Robin (Nginx style)
  if (strategy === "weighted-round-robin") {
    const n = servers.length;
    const current = Array(n).fill(0);
    const maxWeight = Math.max(...ws);
    return {
      pickTarget(_: Request) {
        let total = 0;
        for (let i = 0; i < n; i++) {
          current[i] += ws[i] ?? 1;
          total += ws[i] ?? 1;
        }
        let best = 0;
        for (let i = 1; i < n; i++) {
          if (current[i] > current[best]) best = i;
        }
        current[best] -= total;
        return servers[best] as string;
      },
      release() {},
    };
  }

  if (strategy === "least-connections") {
    const counts = new Map<string, number>();
    for (const s of servers) counts.set(s, 0);
    return {
      pickTarget(_: Request) {
        let best = servers[0]!;
        let bestCount = counts.get(best) ?? 0;
        for (const s of servers) {
          const c = counts.get(s) ?? 0;
          if (c < bestCount) {
            best = s;
            bestCount = c;
          }
        }
        counts.set(best, (counts.get(best) ?? 0) + 1);
        return best;
      },
      release(target: string) {
        counts.set(target, Math.max(0, (counts.get(target) ?? 1) - 1));
      },
    };
  }

  if (strategy === "weighted-least-connections") {
    // balance by active connections divided by weight
    const counts = new Map<string, number>();
    for (const s of servers) counts.set(s, 0);
    return {
      pickTarget(_: Request) {
        let best = servers[0]!;
        let bestScore = (counts.get(best) ?? 0) / (ws[0] || 1);
        for (let i = 1; i < servers.length; i++) {
          const s = servers[i]!;
          const score = (counts.get(s) ?? 0) / (ws[i] || 1);
          if (score < bestScore) {
            best = s;
            bestScore = score;
          }
        }
        counts.set(best, (counts.get(best) ?? 0) + 1);
        return best;
      },
      release(target: string) {
        counts.set(target, Math.max(0, (counts.get(target) ?? 1) - 1));
      },
    };
  }

  if (strategy === "ip-hash") {
    return {
      pickTarget(req: Request) {
        const key = req.header("X-Client-ID") || req.ip || "";
        const h = fnv1aHash(key);
        return servers[h % servers.length]!;
      },
      release() {},
    };
  }

  if (strategy === "consistent-hash") {
    // build a simple hash ring with virtual nodes
    const ring: { hash: number; server: string }[] = [];
    const VNODE = 100;
    for (let i = 0; i < servers.length; i++) {
      const server = servers[i] as string;
      for (let v = 0; v < VNODE; v++) {
        const key = `${server}#${v}`;
        ring.push({ hash: fnv1aHash(key), server });
      }
    }
    ring.sort((a, b) => a.hash - b.hash);
    return {
      pickTarget(req: Request) {
        const key = req.header("X-Client-ID") || req.ip || "";
        const h = fnv1aHash(key);
        // binary search the ring
        let lo = 0,
          hi = ring.length - 1;
        if (ring.length === 0) return servers[0] as string;
        if (h <= ring[0]!.hash || h > ring[hi]!.hash) return ring[0]!.server;
        while (lo < hi) {
          const mid = Math.floor((lo + hi) / 2);
          if (ring[mid]!.hash >= h) hi = mid;
          else lo = mid + 1;
        }
        return ring[lo]!.server;
      },
      release() {},
    };
  }

  // fallback to round-robin
  let idx = 0;
  return {
    pickTarget(_: Request) {
      const t = safeGet(idx)!;
      idx = (idx + 1) % servers.length;
      return t;
    },
    release() {},
  };
}
