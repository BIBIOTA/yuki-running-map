import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import type { createMiddlewareClient as CreateMiddlewareClientType } from "../middleware";

const ssrCreateBrowserClient = vi.hoisted(() => vi.fn());
const ssrCreateServerClient = vi.hoisted(() => vi.fn());

vi.mock("@supabase/ssr", () => ({
  createBrowserClient: ssrCreateBrowserClient,
  createServerClient: ssrCreateServerClient,
}));

const cookieStoreMock = vi.hoisted(() => ({
  getAll: vi.fn(() => [{ name: "sb-test", value: "abc" }]),
  set: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => cookieStoreMock),
}));

interface CookieOptions {
  path?: string;
  maxAge?: number;
}
interface CookieEntry {
  name: string;
  value: string;
  options?: CookieOptions;
}

beforeAll(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
});

afterEach(() => {
  ssrCreateBrowserClient.mockReset();
  ssrCreateServerClient.mockReset();
  cookieStoreMock.getAll.mockClear();
  cookieStoreMock.set.mockClear();
});

describe("lib/supabase factories", () => {
  it('createBrowserClient is callable from "use client" code', async () => {
    ssrCreateBrowserClient.mockReturnValue({ stub: "browser-client" });

    const { createBrowserClient } = await import("../browser");
    const client = createBrowserClient();

    expect(ssrCreateBrowserClient).toHaveBeenCalledTimes(1);
    expect(ssrCreateBrowserClient).toHaveBeenCalledWith(
      "https://test.supabase.co",
      "anon-key",
    );
    expect(client).toEqual({ stub: "browser-client" });
  });

  it("createServerClient wraps @supabase/ssr with next/headers cookies", async () => {
    ssrCreateServerClient.mockReturnValue({ stub: "server-client" });

    const { createServerClient } = await import("../server");
    const client = await createServerClient();

    expect(ssrCreateServerClient).toHaveBeenCalledTimes(1);
    const call = ssrCreateServerClient.mock.calls[0];
    expect(call).toBeDefined();
    const [url, key, options] = call as [
      string,
      string,
      { cookies: { getAll: () => Promise<CookieEntry[]>; setAll: (c: CookieEntry[]) => void } },
    ];
    expect(url).toBe("https://test.supabase.co");
    expect(key).toBe("anon-key");
    expect(typeof options.cookies.getAll).toBe("function");
    expect(typeof options.cookies.setAll).toBe("function");

    const cookiesRead = await options.cookies.getAll();
    expect(cookieStoreMock.getAll).toHaveBeenCalled();
    expect(cookiesRead).toEqual([{ name: "sb-test", value: "abc" }]);

    options.cookies.setAll([{ name: "new", value: "v", options: { path: "/" } }]);
    expect(cookieStoreMock.set).toHaveBeenCalledWith("new", "v", { path: "/" });

    expect(client).toEqual({ stub: "server-client" });
  });

  it("createMiddlewareClient round-trips cookies", async () => {
    ssrCreateServerClient.mockReturnValue({ stub: "mw-client" });

    const reqCookies = {
      getAll: vi.fn(() => [{ name: "req-c", value: "1" }]),
    };
    const resCookies = {
      set: vi.fn(),
    };
    const req = { cookies: reqCookies } as unknown as Parameters<
      typeof CreateMiddlewareClientType
    >[0]["req"];
    const res = { cookies: resCookies } as unknown as Parameters<
      typeof CreateMiddlewareClientType
    >[0]["res"];

    const { createMiddlewareClient } = await import("../middleware");
    const client = createMiddlewareClient({ req, res });

    expect(ssrCreateServerClient).toHaveBeenCalledTimes(1);
    const call = ssrCreateServerClient.mock.calls[0];
    expect(call).toBeDefined();
    const [, , options] = call as [
      string,
      string,
      { cookies: { getAll: () => CookieEntry[]; setAll: (c: CookieEntry[]) => void } },
    ];

    const cookiesRead = options.cookies.getAll();
    expect(reqCookies.getAll).toHaveBeenCalled();
    expect(cookiesRead).toEqual([{ name: "req-c", value: "1" }]);

    options.cookies.setAll([{ name: "out", value: "z", options: { path: "/" } }]);
    expect(resCookies.set).toHaveBeenCalledWith("out", "z", { path: "/" });

    expect(client).toEqual({ stub: "mw-client" });
  });
});
