import type { Express, Request, Response } from "express";

/**
 * OAuth routes are not used in standalone Railway deployment.
 * Authentication is handled via email/password, Telegram, or guest login.
 */
export function registerOAuthRoutes(app: Express) {
  // No-op: Manus OAuth is not available on Railway
  // Auth is handled via tRPC procedures (auth.login, auth.register, auth.telegramAuth, auth.guestLogin)
  app.get("/api/oauth/callback", (_req: Request, res: Response) => {
    res.redirect(302, "/login");
  });
}
