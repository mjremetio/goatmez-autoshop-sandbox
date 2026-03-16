import { COOKIE_NAME } from "@shared/const";
import type { Express, Request, Response } from "express";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { users } from "../../drizzle/schema";
import * as db from "../db";
import { getSessionCookieOptions } from "./cookies";
import { sdk } from "./sdk";
import { checkRateLimit, recordFailedAttempt, clearAttempts } from "./rateLimit";
import { ENV } from "./env";

const SESSION_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

function getClientIp(req: Request): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string") return forwarded.split(",")[0].trim();
  if (Array.isArray(forwarded)) return forwarded[0];
  return req.ip || req.socket.remoteAddress || "unknown";
}

export function registerOAuthRoutes(app: Express) {
  // Manual login endpoint — replaces Manus OAuth
  app.post("/api/auth/login", async (req: Request, res: Response) => {
    const { username, password } = req.body;

    if (!username || !password) {
      res.status(400).json({ error: "Username and password are required" });
      return;
    }

    const trimmedUsername = String(username).trim();
    const clientIp = getClientIp(req);

    // Check rate limit / account lockout
    const rateCheck = checkRateLimit(clientIp, trimmedUsername);
    if (!rateCheck.allowed) {
      const retryMinutes = Math.ceil((rateCheck.retryAfterMs || 0) / 60000);
      console.warn(`[Security] Login blocked for IP=${clientIp} user="${trimmedUsername}" (locked out)`);
      res.status(429).json({
        error: `Too many failed login attempts. Please try again in ${retryMinutes} minute${retryMinutes !== 1 ? "s" : ""}.`,
      });
      return;
    }

    try {
      // Look up user by username in the database
      const database = await db.getDb();
      if (!database) {
        res.status(500).json({ error: "Database not available" });
        return;
      }

      const [user] = await database
        .select()
        .from(users)
        .where(eq(users.username, trimmedUsername))
        .limit(1);

      if (!user || !user.password) {
        recordFailedAttempt(clientIp, trimmedUsername);
        console.warn(`[Security] Failed login attempt for user="${trimmedUsername}" from IP=${clientIp}`);
        res.status(401).json({ error: "Invalid username or password" });
        return;
      }

      // Compare password hash
      const isValid = await bcrypt.compare(String(password), user.password);
      if (!isValid) {
        const result = recordFailedAttempt(clientIp, trimmedUsername);
        console.warn(`[Security] Failed login attempt for user="${trimmedUsername}" from IP=${clientIp}`);
        if (result.locked) {
          const retryMinutes = Math.ceil((result.retryAfterMs || 0) / 60000);
          res.status(429).json({
            error: `Too many failed login attempts. Account locked for ${retryMinutes} minute${retryMinutes !== 1 ? "s" : ""}.`,
          });
          return;
        }
        res.status(401).json({ error: "Invalid username or password" });
        return;
      }

      // Successful login — clear rate limit records
      clearAttempts(clientIp, trimmedUsername);

      // Update last signed in
      await db.upsertUser({
        openId: user.openId,
        lastSignedIn: new Date(),
      });

      // Create a session token with shorter expiry
      const sessionToken = await sdk.createSessionToken(user.openId, {
        name: user.name || trimmedUsername,
        expiresInMs: SESSION_DURATION_MS,
      });

      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: SESSION_DURATION_MS });

      console.log(`[Auth] Successful login for user="${trimmedUsername}" from IP=${clientIp}`);
      res.json({ success: true, user: { name: user.name || trimmedUsername, role: user.role } });
    } catch (error) {
      console.error("[Auth] Login failed", error);
      res.status(500).json({ error: "Login failed" });
    }
  });

  // Keep the OAuth callback for backward compatibility (redirects to login)
  app.get("/api/oauth/callback", (_req: Request, res: Response) => {
    res.redirect(302, "/login");
  });
}

// ─── Seed admin user on startup ──────────────────────────────────
export async function seedAdminUser() {
  try {
    const database = await db.getDb();
    if (!database) {
      console.warn("[Auth] Cannot seed admin: database not available");
      return;
    }

    // Check if admin user already exists
    const [existing] = await database
      .select()
      .from(users)
      .where(eq(users.username, "admin"))
      .limit(1);

    if (existing) {
      console.log("[Auth] Admin user already exists, skipping seed");
      return;
    }

    // Use env vars for admin credentials, fall back to defaults
    const adminUsername = ENV.adminUsername || "admin";
    const adminPassword = ENV.adminPassword || "admin123";
    const hashedPassword = await bcrypt.hash(adminPassword, 12);
    await database.insert(users).values({
      openId: `local-admin-${adminUsername}`,
      username: adminUsername,
      password: hashedPassword,
      name: "Admin",
      email: null,
      loginMethod: "password",
      role: "admin",
      lastSignedIn: new Date(),
    });

    console.log(`[Auth] Admin user seeded successfully`);
  } catch (error) {
    console.error("[Auth] Failed to seed admin user:", error);
  }
}
