import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import { TRPCError } from "@trpc/server";

// ─── Helpers ──────────────────────────────────────────────────────────

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function makeUser(overrides: Partial<AuthenticatedUser> = {}): AuthenticatedUser {
  return {
    id: 1,
    openId: "local-admin-admin",
    username: "admin",
    password: "$2a$10$hashed",
    name: "Admin",
    email: "admin@test.com",
    loginMethod: "password",
    role: "admin",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
    ...overrides,
  };
}

function makeCtx(user: AuthenticatedUser | null = null): TrpcContext {
  return {
    user,
    req: {
      protocol: "https",
      headers: { origin: "https://test.example.com" },
    } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };
}

// ─── Auth Tests ───────────────────────────────────────────────────────

describe("auth.me", () => {
  it("returns null when no user is authenticated", async () => {
    const caller = appRouter.createCaller(makeCtx(null));
    const result = await caller.auth.me();
    expect(result).toBeNull();
  });

  it("returns the authenticated user", async () => {
    const user = makeUser();
    const caller = appRouter.createCaller(makeCtx(user));
    const result = await caller.auth.me();
    expect(result).toBeDefined();
    expect(result?.id).toBe(1);
    expect(result?.name).toBe("Admin");
    expect(result?.role).toBe("admin");
  });
});

describe("auth.logout", () => {
  it("clears the session cookie and returns success", async () => {
    const ctx = makeCtx(makeUser());
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.logout();
    expect(result).toEqual({ success: true });
    expect(ctx.res.clearCookie).toHaveBeenCalled();
  });
});

// ─── Authorization Guard Tests ────────────────────────────────────────

describe("authorization guards", () => {
  it("protectedProcedure rejects unauthenticated users", async () => {
    const caller = appRouter.createCaller(makeCtx(null));
    await expect(caller.dashboard.get()).rejects.toThrow(TRPCError);
    await expect(caller.dashboard.get()).rejects.toThrow("Please login");
  });

  it("adminProcedure rejects non-admin users", async () => {
    const regularUser = makeUser({ role: "user" });
    const caller = appRouter.createCaller(makeCtx(regularUser));
    await expect(caller.users.list()).rejects.toThrow(TRPCError);
    await expect(caller.users.list()).rejects.toThrow("permission");
  });

  it("adminProcedure rejects unauthenticated users", async () => {
    const caller = appRouter.createCaller(makeCtx(null));
    await expect(caller.users.list()).rejects.toThrow(TRPCError);
  });
});

// ─── Input Validation Tests ──────────────────────────────────────────

describe("input validation", () => {
  it("clients.create rejects empty name", async () => {
    const caller = appRouter.createCaller(makeCtx(makeUser()));
    await expect(
      caller.clients.create({ name: "" })
    ).rejects.toThrow();
  });

  it("invoices.create requires at least one line item", async () => {
    const caller = appRouter.createCaller(makeCtx(makeUser()));
    await expect(
      caller.invoices.create({
        clientId: 1,
        items: [],
      })
    ).rejects.toThrow();
  });

  it("appointments.create validates time format HH:MM", async () => {
    const caller = appRouter.createCaller(makeCtx(makeUser()));
    await expect(
      caller.appointments.create({
        clientId: 1,
        service: "Oil Change",
        date: "2026-03-15",
        time: "9am", // invalid format
      })
    ).rejects.toThrow();
  });

  it("appointments.create accepts valid HH:MM time", async () => {
    const caller = appRouter.createCaller(makeCtx(makeUser()));
    // This should pass validation (may fail on DB but validation passes)
    try {
      await caller.appointments.create({
        clientId: 999999, // non-existent client, will fail at DB level
        service: "Oil Change",
        date: "2026-03-15",
        time: "09:00",
      });
    } catch (e: any) {
      // Should NOT be a validation error - it should get past input validation
      expect(e.message).not.toMatch(/Time must be HH:MM/);
    }
  });

  it("users.create rejects short passwords", async () => {
    const caller = appRouter.createCaller(makeCtx(makeUser()));
    await expect(
      caller.users.create({
        username: "testuser",
        password: "abc", // too short, min 6
      })
    ).rejects.toThrow();
  });

  it("booking.create validates required fields", async () => {
    const caller = appRouter.createCaller(makeCtx(null)); // public procedure
    await expect(
      caller.booking.create({
        name: "",
        email: "invalid",
        phone: "",
        service: "",
        date: "2026-03-15",
        time: "09:00",
      })
    ).rejects.toThrow();
  });

  it("estimates.create requires at least one line item", async () => {
    const caller = appRouter.createCaller(makeCtx(makeUser()));
    await expect(
      caller.estimates.create({
        clientId: 1,
        items: [],
      })
    ).rejects.toThrow();
  });
});

// ─── Stripe Products (public) ────────────────────────────────────────

describe("stripe.products", () => {
  it("returns the list of service products", async () => {
    const caller = appRouter.createCaller(makeCtx(null));
    const products = await caller.stripe.products();
    expect(Array.isArray(products)).toBe(true);
    // Each product should have required fields
    for (const p of products) {
      expect(p).toHaveProperty("id");
      expect(p).toHaveProperty("name");
      expect(p).toHaveProperty("priceInCents");
      expect(typeof p.priceInCents).toBe("number");
    }
  });
});

// ─── Booking Settings (public) ───────────────────────────────────────

describe("booking.settings", () => {
  it("returns booking settings without authentication", async () => {
    const caller = appRouter.createCaller(makeCtx(null));
    // Should not throw - it's a public procedure
    const result = await caller.booking.settings();
    // Result may be null if no settings exist, or an object
    expect(result === null || typeof result === "object").toBe(true);
  });
});

// ─── Booking Available Slots (public) ────────────────────────────────

describe("booking.availableSlots", () => {
  it("returns available slots for a date", async () => {
    const caller = appRouter.createCaller(makeCtx(null));
    const result = await caller.booking.availableSlots({ date: "2026-03-20" });
    expect(Array.isArray(result)).toBe(true);
  });
});

// ─── Line Item Schema Validation ─────────────────────────────────────

describe("line item schema", () => {
  it("invoices.create validates line item type enum", async () => {
    const caller = appRouter.createCaller(makeCtx(makeUser()));
    await expect(
      caller.invoices.create({
        clientId: 1,
        items: [
          {
            type: "invalid" as any,
            description: "Test",
          },
        ],
      })
    ).rejects.toThrow();
  });

  it("invoices.create accepts valid labor line item", async () => {
    const caller = appRouter.createCaller(makeCtx(makeUser()));
    try {
      await caller.invoices.create({
        clientId: 999999,
        items: [
          {
            type: "labor",
            description: "Engine diagnostic",
            hourlyRate: 85,
            hours: 2,
          },
        ],
      });
    } catch (e: any) {
      // Should pass validation - may fail at DB level
      expect(e.message).not.toMatch(/type/i);
    }
  });

  it("invoices.create accepts valid parts line item", async () => {
    const caller = appRouter.createCaller(makeCtx(makeUser()));
    try {
      await caller.invoices.create({
        clientId: 999999,
        items: [
          {
            type: "parts",
            description: "Oil filter",
            quantity: 1,
            unitPrice: 15.99,
          },
        ],
      });
    } catch (e: any) {
      // Should pass validation - may fail at DB level
      expect(e.message).not.toMatch(/type/i);
    }
  });
});

// ─── Reports (protected) ────────────────────────────────────────────

describe("reports access control", () => {
  it("reports.revenue rejects unauthenticated users", async () => {
    const caller = appRouter.createCaller(makeCtx(null));
    await expect(caller.reports.revenue()).rejects.toThrow("Please login");
  });

  it("reports.appointments rejects unauthenticated users", async () => {
    const caller = appRouter.createCaller(makeCtx(null));
    await expect(caller.reports.appointments()).rejects.toThrow("Please login");
  });

  it("reports.clients rejects unauthenticated users", async () => {
    const caller = appRouter.createCaller(makeCtx(null));
    await expect(caller.reports.clients()).rejects.toThrow("Please login");
  });

  it("reports.services rejects unauthenticated users", async () => {
    const caller = appRouter.createCaller(makeCtx(null));
    await expect(caller.reports.services()).rejects.toThrow("Please login");
  });
});

// ─── Email (protected) ──────────────────────────────────────────────

describe("email access control", () => {
  it("email.sendInvoice rejects unauthenticated users", async () => {
    const caller = appRouter.createCaller(makeCtx(null));
    await expect(
      caller.email.sendInvoice({ invoiceId: 1 })
    ).rejects.toThrow("Please login");
  });

  it("email.sendEstimate rejects unauthenticated users", async () => {
    const caller = appRouter.createCaller(makeCtx(null));
    await expect(
      caller.email.sendEstimate({ estimateId: 1 })
    ).rejects.toThrow("Please login");
  });

  it("email.sendAppointmentConfirmation rejects unauthenticated users", async () => {
    const caller = appRouter.createCaller(makeCtx(null));
    await expect(
      caller.email.sendAppointmentConfirmation({ appointmentId: 1 })
    ).rejects.toThrow("Please login");
  });
});

// ─── Service History (protected) ─────────────────────────────────────

describe("serviceHistory access control", () => {
  it("serviceHistory.list rejects unauthenticated users", async () => {
    const caller = appRouter.createCaller(makeCtx(null));
    await expect(caller.serviceHistory.list()).rejects.toThrow("Please login");
  });

  it("serviceHistory.create rejects unauthenticated users", async () => {
    const caller = appRouter.createCaller(makeCtx(null));
    await expect(
      caller.serviceHistory.create({
        clientId: 1,
        service: "Oil Change",
        cost: 50,
        date: "2026-03-15",
      })
    ).rejects.toThrow("Please login");
  });
});

// ─── Vehicles (protected) ───────────────────────────────────────────

describe("vehicles access control", () => {
  it("vehicles.list rejects unauthenticated users", async () => {
    const caller = appRouter.createCaller(makeCtx(null));
    await expect(caller.vehicles.list()).rejects.toThrow("Please login");
  });

  it("vehicles.create rejects unauthenticated users", async () => {
    const caller = appRouter.createCaller(makeCtx(null));
    await expect(
      caller.vehicles.create({ clientId: 1, make: "Toyota", model: "Camry" })
    ).rejects.toThrow("Please login");
  });
});

// ─── Booking Update Settings (admin-only) ────────────────────────────

describe("booking.updateSettings access control", () => {
  it("rejects unauthenticated users", async () => {
    const caller = appRouter.createCaller(makeCtx(null));
    await expect(
      caller.booking.updateSettings({ isEnabled: true })
    ).rejects.toThrow();
  });

  it("rejects non-admin users", async () => {
    const regularUser = makeUser({ role: "user" });
    const caller = appRouter.createCaller(makeCtx(regularUser));
    await expect(
      caller.booking.updateSettings({ isEnabled: true })
    ).rejects.toThrow("permission");
  });
});
