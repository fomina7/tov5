import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import { COOKIE_NAME } from "../shared/const";
import type { TrpcContext } from "./_core/context";

type CookieCall = {
  name: string;
  value: string;
  options: Record<string, unknown>;
};

function createPublicContext(): { ctx: TrpcContext; setCookies: CookieCall[]; clearedCookies: { name: string; options: Record<string, unknown> }[] } {
  const setCookies: CookieCall[] = [];
  const clearedCookies: { name: string; options: Record<string, unknown> }[] = [];

  const ctx: TrpcContext = {
    user: null,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      cookie: (name: string, value: string, options: Record<string, unknown>) => {
        setCookies.push({ name, value, options });
      },
      clearCookie: (name: string, options: Record<string, unknown>) => {
        clearedCookies.push({ name, options });
      },
    } as TrpcContext["res"],
  };

  return { ctx, setCookies, clearedCookies };
}

describe("auth.register", () => {
  it("creates a new user and sets session cookie", async () => {
    const { ctx, setCookies } = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const uniqueEmail = `test_${Date.now()}@housepoker.com`;
    const result = await caller.auth.register({
      email: uniqueEmail,
      password: "testpassword123",
      name: "Test Player",
    });

    expect(result).toEqual({ success: true });
    expect(setCookies).toHaveLength(1);
    expect(setCookies[0]?.name).toBe(COOKIE_NAME);
    expect(setCookies[0]?.value).toBeTruthy(); // JWT token
    expect(typeof setCookies[0]?.value).toBe("string");
  });

  it("rejects duplicate email registration", async () => {
    const { ctx } = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const uniqueEmail = `dup_${Date.now()}@housepoker.com`;

    // First registration should succeed
    await caller.auth.register({
      email: uniqueEmail,
      password: "testpassword123",
      name: "First Player",
    });

    // Second registration with same email should fail
    const { ctx: ctx2 } = createPublicContext();
    const caller2 = appRouter.createCaller(ctx2);

    await expect(
      caller2.auth.register({
        email: uniqueEmail,
        password: "anotherpassword",
        name: "Second Player",
      })
    ).rejects.toThrow("Email already registered");
  });

  it("validates email format", async () => {
    const { ctx } = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.auth.register({
        email: "not-an-email",
        password: "testpassword123",
        name: "Test Player",
      })
    ).rejects.toThrow();
  });

  it("validates password minimum length", async () => {
    const { ctx } = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.auth.register({
        email: `short_${Date.now()}@test.com`,
        password: "12345", // too short (min 6)
        name: "Test Player",
      })
    ).rejects.toThrow();
  });
});

describe("auth.login", () => {
  it("logs in with correct credentials and sets session cookie", async () => {
    const { ctx } = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const uniqueEmail = `login_${Date.now()}@housepoker.com`;

    // Register first
    await caller.auth.register({
      email: uniqueEmail,
      password: "mypassword123",
      name: "Login Test",
    });

    // Login
    const { ctx: loginCtx, setCookies } = createPublicContext();
    const loginCaller = appRouter.createCaller(loginCtx);

    const result = await loginCaller.auth.login({
      email: uniqueEmail,
      password: "mypassword123",
    });

    expect(result).toEqual({ success: true });
    expect(setCookies).toHaveLength(1);
    expect(setCookies[0]?.name).toBe(COOKIE_NAME);
    expect(setCookies[0]?.value).toBeTruthy();
  });

  it("rejects wrong password", async () => {
    const { ctx } = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const uniqueEmail = `wrongpw_${Date.now()}@housepoker.com`;

    // Register first
    await caller.auth.register({
      email: uniqueEmail,
      password: "correctpassword",
      name: "Wrong PW Test",
    });

    // Try login with wrong password
    const { ctx: loginCtx } = createPublicContext();
    const loginCaller = appRouter.createCaller(loginCtx);

    await expect(
      loginCaller.auth.login({
        email: uniqueEmail,
        password: "wrongpassword",
      })
    ).rejects.toThrow("Invalid email or password");
  });

  it("rejects non-existent email", async () => {
    const { ctx } = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.auth.login({
        email: `nonexistent_${Date.now()}@housepoker.com`,
        password: "anypassword",
      })
    ).rejects.toThrow("Invalid email or password");
  });
});

describe("auth.guestLogin", () => {
  it("creates a guest user and sets session cookie", async () => {
    const { ctx, setCookies } = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.auth.guestLogin();

    expect(result.success).toBe(true);
    expect(result.guestName).toBeTruthy();
    expect(result.guestName).toMatch(/^Guest_/);
    expect(setCookies).toHaveLength(1);
    expect(setCookies[0]?.name).toBe(COOKIE_NAME);
    expect(setCookies[0]?.value).toBeTruthy();
  });
});
