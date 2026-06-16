interface MiddlewareCookieEntry {
  name: string;
  value: string;
  options?: Record<string, unknown>;
}

interface MiddlewareReq {
  cookies: { getAll: () => MiddlewareCookieEntry[] };
}
interface MiddlewareRes {
  cookies: { set: (name: string, value: string, options?: Record<string, unknown>) => void };
}

export function createMiddlewareClient(_args: {
  req: MiddlewareReq;
  res: MiddlewareRes;
}): unknown {
  throw new Error("not implemented");
}
