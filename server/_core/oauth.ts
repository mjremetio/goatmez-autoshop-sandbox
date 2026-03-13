import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import type { Express, Request, Response } from "express";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { users } from "../../drizzle/schema";
import * as db from "../db";
import { getSessionCookieOptions } from "./cookies";
import { sdk } from "./sdk";

export function registerOAuthRoutes(app: Express) {
  // Manual login endpoint — replaces Manus OAuth
  app.post("/api/auth/login", async (req: Request, res: Response) => {
    const { username, password } = req.body;

    if (!username || !password) {
      res.status(400).json({ error: "Username and password are required" });
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
        .where(eq(users.username, username))
        .limit(1);

      if (!user || !user.password) {
        res.status(401).json({ error: "Invalid username or password" });
        return;
      }

      // Compare password hash
      const isValid = await bcrypt.compare(password, user.password);
      if (!isValid) {
        res.status(401).json({ error: "Invalid username or password" });
        return;
      }

      // Update last signed in
      await db.upsertUser({
        openId: user.openId,
        lastSignedIn: new Date(),
      });

      // Create a session token
      const sessionToken = await sdk.createSessionToken(user.openId, {
        name: user.name || username,
        expiresInMs: ONE_YEAR_MS,
      });

      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });

      res.json({ success: true, user: { name: user.name || username, role: user.role } });
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

    // Create admin user with hashed password
    const hashedPassword = await bcrypt.hash("admin123", 12);
    await database.insert(users).values({
      openId: "local-admin-admin",
      username: "admin",
      password: hashedPassword,
      name: "Admin",
      email: null,
      loginMethod: "password",
      role: "admin",
      lastSignedIn: new Date(),
    });

    console.log("[Auth] Admin user seeded successfully (admin / admin123)");
  } catch (error) {
    console.error("[Auth] Failed to seed admin user:", error);
  }
}
