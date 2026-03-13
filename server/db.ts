import { eq, sql, and, like, or, desc, asc, between, inArray, gte, lte, count as drizzleCount } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertUser,
  users,
  clients,
  vehicles,
  invoices,
  invoiceItems,
  estimates,
  estimateItems,
  appointments,
  serviceHistory,
  bookingSettings,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db!;
}

function toDate(s: string): Date {
  return new Date(s + "T00:00:00Z");
}
function todayDate(): Date {
  return toDate(new Date().toISOString().slice(0, 10));
}

// ─── User helpers (auth) ──────────────────────────────────────────
export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) { console.warn("[Database] Cannot upsert user: database not available"); return; }
  try {
    const values: InsertUser = { openId: user.openId };
    const updateSet: Record<string, unknown> = {};
    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];
    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };
    textFields.forEach(assignNullable);
    if (user.lastSignedIn !== undefined) { values.lastSignedIn = user.lastSignedIn; updateSet.lastSignedIn = user.lastSignedIn; }
    if (user.role !== undefined) { values.role = user.role; updateSet.role = user.role; }
    else if (user.openId === ENV.ownerOpenId) { values.role = "admin"; updateSet.role = "admin"; }
    if (!values.lastSignedIn) values.lastSignedIn = new Date();
    if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();
    await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
  } catch (error) { console.error("[Database] Failed to upsert user:", error); throw error; }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ─── User management (admin) ────────────────────────────────────
const userSelectFields = {
  id: users.id,
  openId: users.openId,
  username: users.username,
  name: users.name,
  email: users.email,
  role: users.role,
  createdAt: users.createdAt,
  lastSignedIn: users.lastSignedIn,
};

export async function listUsers() {
  const db = await getDb();
  return db.select(userSelectFields).from(users).orderBy(asc(users.id));
}

export async function createUser(data: { username: string; password: string; name?: string; email?: string; role?: "user" | "admin" }) {
  const bcrypt = await import("bcryptjs");
  const db = await getDb();
  const hashedPassword = await bcrypt.default.hash(data.password, 12);
  const openId = `local-user-${data.username}`;
  const result = await db.insert(users).values({
    openId,
    username: data.username,
    password: hashedPassword,
    name: data.name || data.username,
    email: data.email || null,
    loginMethod: "password",
    role: data.role || "user",
    lastSignedIn: new Date(),
  });
  const id = result[0].insertId;
  const [user] = await db.select(userSelectFields).from(users).where(eq(users.id, id)).limit(1);
  return user;
}

export async function updateUserRole(id: number, role: "user" | "admin") {
  const db = await getDb();
  await db.update(users).set({ role }).where(eq(users.id, id));
  const [user] = await db.select(userSelectFields).from(users).where(eq(users.id, id)).limit(1);
  return user;
}

export async function updateUserPassword(id: number, newPassword: string) {
  const bcrypt = await import("bcryptjs");
  const db = await getDb();
  const hashedPassword = await bcrypt.default.hash(newPassword, 12);
  await db.update(users).set({ password: hashedPassword }).where(eq(users.id, id));
  return { success: true };
}

export async function updateUserProfile(id: number, data: { name?: string; email?: string }) {
  const db = await getDb();
  await db.update(users).set(data).where(eq(users.id, id));
  const [user] = await db.select(userSelectFields).from(users).where(eq(users.id, id)).limit(1);
  return user;
}

export async function deleteUser(id: number) {
  const db = await getDb();
  const admins = await db.select({ id: users.id }).from(users).where(eq(users.role, "admin"));
  const [target] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  if (target?.role === "admin" && admins.length <= 1) {
    throw new Error("Cannot delete the last admin user");
  }
  await db.delete(users).where(eq(users.id, id));
  return { id };
}

// ─── Helper: attach related data manually (TiDB doesn't support lateral joins) ───
async function attachClientAndVehicle(db: any, rows: any[]) {
  if (rows.length === 0) return rows;
  const clientIds = Array.from(new Set(rows.map((r: any) => r.clientId).filter(Boolean)));
  const vehicleIds = Array.from(new Set(rows.map((r: any) => r.vehicleId).filter(Boolean)));

  const clientMap: Record<number, any> = {};
  const vehicleMap: Record<number, any> = {};

  if (clientIds.length > 0) {
    const clientRows = await db.select().from(clients).where(inArray(clients.id, clientIds));
    for (const c of clientRows) clientMap[c.id] = c;
  }
  if (vehicleIds.length > 0) {
    const vehicleRows = await db.select().from(vehicles).where(inArray(vehicles.id, vehicleIds));
    for (const v of vehicleRows) vehicleMap[v.id] = v;
  }

  return rows.map((r) => ({
    ...r,
    client: r.clientId ? clientMap[r.clientId] || null : null,
    vehicle: r.vehicleId ? vehicleMap[r.vehicleId] || null : null,
  }));
}

// ─── Dashboard ────────────────────────────────────────────────────
export async function getDashboardData() {
  const db = await getDb();
  const today = todayDate();

  const [clientCount] = await db.select({ count: sql<number>`count(*)` }).from(clients);
  const [vehicleCount] = await db.select({ count: sql<number>`count(*)` }).from(vehicles);
  const [todayApptCount] = await db.select({ count: sql<number>`count(*)` }).from(appointments).where(eq(appointments.date, today));
  const [revenueResult] = await db.select({ total: sql<string>`COALESCE(SUM(total), 0)` }).from(invoices).where(eq(invoices.status, "paid"));
  const [pendingInvCount] = await db.select({ count: sql<number>`count(*)` }).from(invoices).where(or(eq(invoices.status, "draft"), eq(invoices.status, "sent")));
  const [pendingEstCount] = await db.select({ count: sql<number>`count(*)` }).from(estimates).where(or(eq(estimates.status, "draft"), eq(estimates.status, "sent")));

  const todaysScheduleRaw = await db.select().from(appointments).where(eq(appointments.date, today)).orderBy(asc(appointments.time));
  const todaysSchedule = await attachClientAndVehicle(db, todaysScheduleRaw);

  const pendingInvoicesRaw = await db.select().from(invoices)
    .where(or(eq(invoices.status, "draft"), eq(invoices.status, "sent")))
    .orderBy(desc(invoices.createdAt))
    .limit(10);
  const pendingInvoices = await attachClientAndVehicle(db, pendingInvoicesRaw);

  return {
    stats: {
      totalClients: Number(clientCount.count),
      totalVehicles: Number(vehicleCount.count),
      todaysAppointments: Number(todayApptCount.count),
      totalRevenue: parseFloat(String(revenueResult.total)) || 0,
      pendingInvoiceCount: Number(pendingInvCount.count),
      pendingEstimateCount: Number(pendingEstCount.count),
    },
    todaysSchedule,
    pendingInvoices,
  };
}

export async function getRevenueChartData() {
  const db = await getDb();
  const rows = await db.select({
    month: sql<string>`DATE_FORMAT(paid_date, '%Y-%m')`,
    revenue: sql<string>`COALESCE(SUM(total), 0)`,
  }).from(invoices)
    .where(and(eq(invoices.status, "paid"), sql`paid_date IS NOT NULL`))
    .groupBy(sql`DATE_FORMAT(paid_date, '%Y-%m')`)
    .orderBy(sql`DATE_FORMAT(paid_date, '%Y-%m')`)
    .limit(12);

  return rows.map(r => ({
    month: r.month,
    revenue: parseFloat(String(r.revenue)) || 0,
  }));
}

// ─── Clients ──────────────────────────────────────────────────────
export async function listClients(search?: string, params?: { page?: number; perPage?: number; sortBy?: string; sortOrder?: string }) {
  const db = await getDb();
  const page = params?.page || 1;
  const perPage = params?.perPage || 20;
  const offset = (page - 1) * perPage;

  const conditions: any[] = [];
  if (search) {
    const pattern = `%${search}%`;
    conditions.push(or(like(clients.name, pattern), like(clients.email, pattern), like(clients.phone, pattern)));
  }
  const whereClause = conditions.length ? and(...conditions) : undefined;

  const sortColumn = params?.sortBy === "createdAt" ? clients.createdAt : clients.name;
  const sortDir = params?.sortOrder === "desc" ? desc : asc;

  const [totalResult] = await db.select({ count: sql<number>`count(*)` }).from(clients).where(whereClause);
  const total = Number(totalResult.count);

  const clientRows = await db.select().from(clients)
    .where(whereClause)
    .orderBy(sortDir(sortColumn))
    .limit(perPage)
    .offset(offset);

  if (clientRows.length === 0) return { items: [], total, page, perPage };
  const clientIds = clientRows.map((c) => c.id);
  const vehicleRows = await db.select().from(vehicles).where(inArray(vehicles.clientId, clientIds));
  const vehiclesByClient: Record<number, any[]> = {};
  for (const v of vehicleRows) {
    if (!vehiclesByClient[v.clientId]) vehiclesByClient[v.clientId] = [];
    vehiclesByClient[v.clientId].push(v);
  }
  return { items: clientRows.map((c) => ({ ...c, vehicles: vehiclesByClient[c.id] || [] })), total, page, perPage };
}

export async function getClient(id: number) {
  const db = await getDb();
  const [client] = await db.select().from(clients).where(eq(clients.id, id)).limit(1);
  if (!client) return null;
  const vRows = await db.select().from(vehicles).where(eq(vehicles.clientId, id));
  const invRows = await db.select().from(invoices).where(eq(invoices.clientId, id));
  const apptRows = await db.select().from(appointments).where(eq(appointments.clientId, id));
  return { ...client, vehicles: vRows, invoices: invRows, appointments: apptRows };
}

export async function createClient(data: { name: string; phone?: string; email?: string; notes?: string; address?: string; city?: string; state?: string; zip?: string }) {
  const db = await getDb();
  const result = await db.insert(clients).values(data);
  const id = result[0].insertId;
  const [client] = await db.select().from(clients).where(eq(clients.id, id)).limit(1);
  return { ...client, vehicles: [] };
}

export async function updateClient(id: number, data: { name?: string; phone?: string; email?: string; notes?: string; address?: string; city?: string; state?: string; zip?: string }) {
  const db = await getDb();
  await db.update(clients).set(data).where(eq(clients.id, id));
  const [client] = await db.select().from(clients).where(eq(clients.id, id)).limit(1);
  const vRows = await db.select().from(vehicles).where(eq(vehicles.clientId, id));
  return { ...client, vehicles: vRows };
}

export async function deleteClient(id: number) {
  const db = await getDb();
  await db.delete(vehicles).where(eq(vehicles.clientId, id));
  await db.delete(clients).where(eq(clients.id, id));
  return { id };
}

// ─── Vehicles ─────────────────────────────────────────────────────
export async function listVehicles(clientId?: number) {
  const db = await getDb();
  let rows;
  if (clientId) {
    rows = await db.select().from(vehicles).where(eq(vehicles.clientId, clientId));
  } else {
    rows = await db.select().from(vehicles);
  }
  return rows;
}

export async function createVehicle(data: { clientId: number; year?: string; make: string; model: string; vin?: string; plate?: string; color?: string; mileage?: number | null }) {
  const db = await getDb();
  const result = await db.insert(vehicles).values(data);
  const id = result[0].insertId;
  const [vehicle] = await db.select().from(vehicles).where(eq(vehicles.id, id)).limit(1);
  return vehicle;
}

export async function updateVehicle(id: number, data: Partial<{ year: string; make: string; model: string; vin: string; plate: string; color: string; mileage: number | null }>) {
  const db = await getDb();
  await db.update(vehicles).set(data).where(eq(vehicles.id, id));
  const [vehicle] = await db.select().from(vehicles).where(eq(vehicles.id, id)).limit(1);
  return vehicle;
}

export async function deleteVehicle(id: number) {
  const db = await getDb();
  await db.delete(vehicles).where(eq(vehicles.id, id));
  return { id };
}

// ─── Invoices ─────────────────────────────────────────────────────
export async function listInvoices(params?: { status?: string; clientId?: number; page?: number; perPage?: number; sortBy?: string; sortOrder?: string }) {
  const db = await getDb();
  const page = params?.page || 1;
  const perPage = params?.perPage || 20;
  const offset = (page - 1) * perPage;

  const conditions: any[] = [];
  if (params?.status && params.status !== "all") conditions.push(eq(invoices.status, params.status as any));
  if (params?.clientId) conditions.push(eq(invoices.clientId, params.clientId));
  const whereClause = conditions.length ? and(...conditions) : undefined;

  const sortMap: Record<string, any> = { number: invoices.number, total: invoices.total, createdAt: invoices.createdAt, status: invoices.status };
  const sortColumn = sortMap[params?.sortBy || ""] || invoices.number;
  const sortDir = params?.sortOrder === "asc" ? asc : desc;

  const [totalResult] = await db.select({ count: sql<number>`count(*)` }).from(invoices).where(whereClause);
  const total = Number(totalResult.count);

  const invRows = await db.select().from(invoices)
    .where(whereClause)
    .orderBy(sortDir(sortColumn))
    .limit(perPage)
    .offset(offset);

  if (invRows.length === 0) return { items: [], total, page, perPage };

  const invIds = invRows.map((i) => i.id);
  const itemRows = await db.select().from(invoiceItems).where(inArray(invoiceItems.invoiceId, invIds));
  const itemsByInv: Record<number, any[]> = {};
  for (const it of itemRows) {
    if (!itemsByInv[it.invoiceId]) itemsByInv[it.invoiceId] = [];
    itemsByInv[it.invoiceId].push(it);
  }

  const withClientVehicle = await attachClientAndVehicle(db, invRows);
  return { items: withClientVehicle.map((inv: any) => ({ ...inv, items: itemsByInv[inv.id] || [] })), total, page, perPage };
}

export async function getInvoice(id: number) {
  const db = await getDb();
  const [inv] = await db.select().from(invoices).where(eq(invoices.id, id)).limit(1);
  if (!inv) return null;
  const items = await db.select().from(invoiceItems).where(eq(invoiceItems.invoiceId, id));
  const [withCV] = await attachClientAndVehicle(db, [inv]);
  return { ...withCV, items };
}

export async function getInvoiceItems(invoiceId: number) {
  const db = await getDb();
  return db.select().from(invoiceItems).where(eq(invoiceItems.invoiceId, invoiceId));
}

export async function getNextInvoiceNumber() {
  const db = await getDb();
  const [result] = await db.select({ maxNum: sql<number>`COALESCE(MAX(number), 1000)` }).from(invoices);
  return (Number(result.maxNum) || 1000) + 1;
}

type LineItemInput = { type: "labor" | "parts"; description: string; hourlyRate?: number; hours?: number; quantity?: number; unitPrice?: number };

function computeLineItems(items: LineItemInput[]) {
  return items.map((it) => {
    const lineTotal = it.type === "labor" ? (it.hourlyRate || 0) * (it.hours || 0) : (it.quantity || 1) * (it.unitPrice || 0);
    return {
      type: it.type,
      description: it.description,
      hourlyRate: String(it.hourlyRate || 0),
      hours: String(it.hours || 0),
      quantity: it.quantity || 1,
      unitPrice: String(it.unitPrice || 0),
      lineTotal: lineTotal.toFixed(2),
    };
  });
}

export async function createInvoice(data: {
  clientId: number;
  vehicleId?: number | null;
  status?: string;
  notes?: string;
  dueDate?: string | null;
  taxRate?: number;
  discountAmount?: number;
  items: LineItemInput[];
}) {
  const db = await getDb();
  const nextNumber = await getNextInvoiceNumber();
  const items = computeLineItems(data.items);
  const subtotal = items.reduce((s, it) => s + parseFloat(it.lineTotal), 0);
  const taxRate = data.taxRate || 0;
  const discountAmount = data.discountAmount || 0;
  const taxAmount = subtotal * (taxRate / 100);
  const total = (subtotal + taxAmount - discountAmount).toFixed(2);

  const result = await db.insert(invoices).values({
    number: nextNumber,
    clientId: data.clientId,
    vehicleId: data.vehicleId ?? null,
    status: (data.status as any) || "draft",
    notes: data.notes || "",
    total,
    taxRate: String(taxRate),
    discountAmount: String(discountAmount),
    issuedDate: todayDate(),
    dueDate: data.dueDate ? toDate(data.dueDate) : null,
  });
  const invoiceId = result[0].insertId;

  if (items.length > 0) {
    await db.insert(invoiceItems).values(
      items.map((it) => ({
        invoiceId,
        type: it.type as "labor" | "parts",
        description: it.description,
        hourlyRate: it.hourlyRate,
        hours: it.hours,
        quantity: it.quantity,
        unitPrice: it.unitPrice,
        lineTotal: it.lineTotal,
      }))
    );
  }

  return getInvoice(invoiceId);
}

export async function updateInvoice(id: number, data: {
  vehicleId?: number | null;
  notes?: string;
  dueDate?: string | null;
  taxRate?: number;
  discountAmount?: number;
  items: LineItemInput[];
}) {
  const db = await getDb();
  // Guard: prevent editing paid invoices
  const [existing] = await db.select().from(invoices).where(eq(invoices.id, id)).limit(1);
  if (existing?.status === "paid") throw new Error("Cannot edit a paid invoice");

  const items = computeLineItems(data.items);
  const subtotal = items.reduce((s, it) => s + parseFloat(it.lineTotal), 0);
  const taxRate = data.taxRate ?? parseFloat(String(existing?.taxRate || "0"));
  const discountAmount = data.discountAmount ?? parseFloat(String(existing?.discountAmount || "0"));
  const taxAmount = subtotal * (taxRate / 100);
  const total = (subtotal + taxAmount - discountAmount).toFixed(2);

  await db.update(invoices).set({
    vehicleId: data.vehicleId ?? null,
    notes: data.notes || "",
    total,
    taxRate: String(taxRate),
    discountAmount: String(discountAmount),
    dueDate: data.dueDate ? toDate(data.dueDate) : null,
  }).where(eq(invoices.id, id));

  await db.delete(invoiceItems).where(eq(invoiceItems.invoiceId, id));
  if (items.length > 0) {
    await db.insert(invoiceItems).values(
      items.map((it) => ({
        invoiceId: id,
        type: it.type as "labor" | "parts",
        description: it.description,
        hourlyRate: it.hourlyRate,
        hours: it.hours,
        quantity: it.quantity,
        unitPrice: it.unitPrice,
        lineTotal: it.lineTotal,
      }))
    );
  }

  return getInvoice(id);
}

export async function updateInvoiceStatus(id: number, status: string, paymentMethod?: string) {
  const db = await getDb();
  // Guard: prevent double-payment
  const [existing] = await db.select().from(invoices).where(eq(invoices.id, id)).limit(1);
  if (!existing) throw new Error("Invoice not found");
  if (existing.status === "paid" && status === "paid") throw new Error("Invoice is already paid");

  const updateData: any = { status };
  if (status === "paid") {
    updateData.paidDate = todayDate();
    if (paymentMethod) updateData.paymentMethod = paymentMethod;
  }
  await db.update(invoices).set(updateData).where(eq(invoices.id, id));

  // Auto-create service history when invoice is paid
  if (status === "paid") {
    const [inv] = await db.select().from(invoices).where(eq(invoices.id, id)).limit(1);
    if (inv) {
      const items = await db.select().from(invoiceItems).where(eq(invoiceItems.invoiceId, id));
      for (const item of items) {
        await db.insert(serviceHistory).values({
          clientId: inv.clientId,
          vehicleId: inv.vehicleId,
          invoiceId: inv.id,
          service: item.description,
          cost: item.lineTotal,
          date: todayDate(),
          notes: `From Invoice #INV-${inv.number}`,
        });
      }
    }
  }

  return getInvoice(id);
}

export async function deleteInvoice(id: number) {
  const db = await getDb();
  await db.delete(invoiceItems).where(eq(invoiceItems.invoiceId, id));
  await db.delete(invoices).where(eq(invoices.id, id));
  return { id };
}

// ─── Estimates ────────────────────────────────────────────────────
export async function listEstimates(params?: { status?: string; clientId?: number; page?: number; perPage?: number; sortBy?: string; sortOrder?: string }) {
  const db = await getDb();
  const page = params?.page || 1;
  const perPage = params?.perPage || 20;
  const offset = (page - 1) * perPage;

  const conditions: any[] = [];
  if (params?.status && params.status !== "all") conditions.push(eq(estimates.status, params.status as any));
  if (params?.clientId) conditions.push(eq(estimates.clientId, params.clientId));
  const whereClause = conditions.length ? and(...conditions) : undefined;

  const sortMap: Record<string, any> = { number: estimates.number, total: estimates.total, createdAt: estimates.createdAt, status: estimates.status };
  const sortColumn = sortMap[params?.sortBy || ""] || estimates.number;
  const sortDir = params?.sortOrder === "asc" ? asc : desc;

  const [totalResult] = await db.select({ count: sql<number>`count(*)` }).from(estimates).where(whereClause);
  const total = Number(totalResult.count);

  const estRows = await db.select().from(estimates)
    .where(whereClause)
    .orderBy(sortDir(sortColumn))
    .limit(perPage)
    .offset(offset);

  if (estRows.length === 0) return { items: [], total, page, perPage };

  const estIds = estRows.map((e) => e.id);
  const itemRows = await db.select().from(estimateItems).where(inArray(estimateItems.estimateId, estIds));
  const itemsByEst: Record<number, any[]> = {};
  for (const it of itemRows) {
    if (!itemsByEst[it.estimateId]) itemsByEst[it.estimateId] = [];
    itemsByEst[it.estimateId].push(it);
  }

  const withCV = await attachClientAndVehicle(db, estRows);
  return { items: withCV.map((est: any) => ({ ...est, items: itemsByEst[est.id] || [] })), total, page, perPage };
}

export async function getEstimate(id: number) {
  const db = await getDb();
  const [est] = await db.select().from(estimates).where(eq(estimates.id, id)).limit(1);
  if (!est) return null;
  const items = await db.select().from(estimateItems).where(eq(estimateItems.estimateId, id));
  const [withCV] = await attachClientAndVehicle(db, [est]);
  return { ...withCV, items };
}

export async function getEstimateItems(estimateId: number) {
  const db = await getDb();
  return db.select().from(estimateItems).where(eq(estimateItems.estimateId, estimateId));
}

export async function getNextEstimateNumber() {
  const db = await getDb();
  const [result] = await db.select({ maxNum: sql<number>`COALESCE(MAX(number), 5000)` }).from(estimates);
  return (Number(result.maxNum) || 5000) + 1;
}

export async function createEstimate(data: {
  clientId: number;
  vehicleId?: number | null;
  status?: string;
  notes?: string;
  validUntil?: string | null;
  items: LineItemInput[];
}) {
  const db = await getDb();
  const nextNumber = await getNextEstimateNumber();
  const items = computeLineItems(data.items);
  const total = items.reduce((s, it) => s + parseFloat(it.lineTotal), 0).toFixed(2);

  const result = await db.insert(estimates).values({
    number: nextNumber,
    clientId: data.clientId,
    vehicleId: data.vehicleId ?? null,
    status: (data.status as any) || "draft",
    notes: data.notes || "",
    total,
    validUntil: data.validUntil ? toDate(data.validUntil) : null,
  });
  const estimateId = result[0].insertId;

  if (items.length > 0) {
    await db.insert(estimateItems).values(
      items.map((it) => ({
        estimateId,
        type: it.type as "labor" | "parts",
        description: it.description,
        hourlyRate: it.hourlyRate,
        hours: it.hours,
        quantity: it.quantity,
        unitPrice: it.unitPrice,
        lineTotal: it.lineTotal,
      }))
    );
  }

  // Return the estimate with items
  const [est] = await db.select().from(estimates).where(eq(estimates.id, estimateId)).limit(1);
  const estItems = await db.select().from(estimateItems).where(eq(estimateItems.estimateId, estimateId));
  const [withCV] = await attachClientAndVehicle(db, [est]);
  return { ...withCV, items: estItems };
}

export async function updateEstimateStatus(id: number, status: string) {
  const db = await getDb();
  await db.update(estimates).set({ status: status as any }).where(eq(estimates.id, id));
  const [est] = await db.select().from(estimates).where(eq(estimates.id, id)).limit(1);
  const items = await db.select().from(estimateItems).where(eq(estimateItems.estimateId, id));
  const [withCV] = await attachClientAndVehicle(db, [est]);
  return { ...withCV, items };
}

export async function convertEstimateToInvoice(id: number) {
  const db = await getDb();
  const [estimate] = await db.select().from(estimates).where(eq(estimates.id, id)).limit(1);
  if (!estimate) throw new Error("Estimate not found");
  if (estimate.status === "converted") throw new Error("Estimate has already been converted");
  if (estimate.status !== "approved") throw new Error("Only approved estimates can be converted");
  const estItems = await db.select().from(estimateItems).where(eq(estimateItems.estimateId, id));

  const nextNumber = await getNextInvoiceNumber();
  const result = await db.insert(invoices).values({
    number: nextNumber,
    clientId: estimate.clientId,
    vehicleId: estimate.vehicleId,
    status: "draft",
    notes: estimate.notes ? `From Estimate #EST-${estimate.number}. ${estimate.notes}` : `From Estimate #EST-${estimate.number}`,
    total: estimate.total,
    issuedDate: todayDate(),
  });
  const invoiceId = result[0].insertId;

  if (estItems.length > 0) {
    await db.insert(invoiceItems).values(
      estItems.map((it) => ({
        invoiceId,
        type: it.type as "labor" | "parts",
        description: it.description,
        hourlyRate: it.hourlyRate,
        hours: it.hours,
        quantity: it.quantity,
        unitPrice: it.unitPrice,
        lineTotal: it.lineTotal,
      }))
    );
  }

  await db.update(estimates).set({ status: "converted" as any, convertedInvoiceId: invoiceId }).where(eq(estimates.id, id));

  return getInvoice(invoiceId);
}

export async function deleteEstimate(id: number) {
  const db = await getDb();
  await db.delete(estimateItems).where(eq(estimateItems.estimateId, id));
  await db.delete(estimates).where(eq(estimates.id, id));
  return { id };
}

// ─── Appointments ─────────────────────────────────────────────────
export async function listAppointments(params?: { date?: string; from?: string; to?: string; status?: string; clientId?: number; search?: string; page?: number; perPage?: number; sortBy?: string; sortOrder?: string }) {
  const db = await getDb();
  const conditions: any[] = [];
  if (params?.date) conditions.push(eq(appointments.date, toDate(params.date)));
  if (params?.from && params?.to) conditions.push(between(appointments.date, toDate(params.from), toDate(params.to)));
  if (params?.status) conditions.push(eq(appointments.status, params.status as any));
  if (params?.clientId) conditions.push(eq(appointments.clientId, params.clientId));

  const whereClause = conditions.length ? and(...conditions) : undefined;

  // If pagination is requested
  if (params?.page) {
    const page = params.page;
    const perPage = params.perPage || 20;
    const offset = (page - 1) * perPage;

    const sortMap: Record<string, any> = { date: appointments.date, time: appointments.time, status: appointments.status, service: appointments.service };
    const sortColumn = sortMap[params?.sortBy || ""] || appointments.date;
    const sortDir = params?.sortOrder === "asc" ? asc : desc;

    const [totalResult] = await db.select({ count: sql<number>`count(*)` }).from(appointments).where(whereClause);
    const total = Number(totalResult.count);

    const rows = await db.select().from(appointments)
      .where(whereClause)
      .orderBy(sortDir(sortColumn), params?.sortBy !== "time" ? asc(appointments.time) : asc(appointments.date))
      .limit(perPage)
      .offset(offset);

    const items = await attachClientAndVehicle(db, rows);

    // If search is provided, filter by client name after attaching
    if (params?.search) {
      const searchLower = params.search.toLowerCase();
      const filtered = items.filter((item: any) => item.client?.name?.toLowerCase().includes(searchLower) || item.service?.toLowerCase().includes(searchLower));
      return { items: filtered, total: filtered.length, page, perPage };
    }

    return { items, total, page, perPage };
  }

  // Non-paginated (for calendar view)
  const rows = await db.select().from(appointments)
    .where(whereClause)
    .orderBy(asc(appointments.date), asc(appointments.time));

  return attachClientAndVehicle(db, rows);
}

export async function getAppointment(id: number) {
  const db = await getDb();
  const [appt] = await db.select().from(appointments).where(eq(appointments.id, id)).limit(1);
  if (!appt) return null;
  const [withCV] = await attachClientAndVehicle(db, [appt]);
  return withCV;
}

export async function createAppointment(data: {
  clientId: number;
  vehicleId?: number | null;
  service: string;
  date: string;
  time: string;
  durationMinutes?: number;
  status?: string;
  notes?: string;
}) {
  const db = await getDb();
  const result = await db.insert(appointments).values({
    clientId: data.clientId,
    vehicleId: data.vehicleId ?? null,
    service: data.service,
    date: toDate(data.date),
    time: data.time,
    durationMinutes: data.durationMinutes || 60,
    status: (data.status as any) || "scheduled",
    notes: data.notes || "",
  });
  const id = result[0].insertId;
  const [appt] = await db.select().from(appointments).where(eq(appointments.id, id)).limit(1);
  const [withCV] = await attachClientAndVehicle(db, [appt]);
  return withCV;
}

export async function updateAppointment(id: number, data: Partial<{
  clientId: number;
  vehicleId: number | null;
  service: string;
  date: string;
  time: string;
  durationMinutes: number;
  status: string;
  notes: string;
}>) {
  const db = await getDb();
  const updateData: any = { ...data };
  if (data.date) updateData.date = toDate(data.date);
  await db.update(appointments).set(updateData).where(eq(appointments.id, id));
  const [appt] = await db.select().from(appointments).where(eq(appointments.id, id)).limit(1);
  const [withCV] = await attachClientAndVehicle(db, [appt]);
  return withCV;
}

export async function deleteAppointment(id: number) {
  const db = await getDb();
  await db.delete(appointments).where(eq(appointments.id, id));
  return { id };
}

// ─── Service History ──────────────────────────────────────────────
export async function listServiceHistory(params?: { clientId?: number; vehicleId?: number; search?: string; fromDate?: string; toDate?: string; sortBy?: "date" | "cost"; sortOrder?: "asc" | "desc"; page?: number; perPage?: number }) {
  const db = await getDb();
  const page = params?.page || 1;
  const perPage = params?.perPage || 20;
  const offset = (page - 1) * perPage;

  const conditions: any[] = [];
  if (params?.clientId) conditions.push(eq(serviceHistory.clientId, params.clientId));
  if (params?.vehicleId) conditions.push(eq(serviceHistory.vehicleId, params.vehicleId));
  if (params?.search) {
    const pattern = `%${params.search}%`;
    conditions.push(like(serviceHistory.service, pattern));
  }
  if (params?.fromDate && params?.toDate) {
    conditions.push(between(serviceHistory.date, toDate(params.fromDate), toDate(params.toDate)));
  } else if (params?.fromDate) {
    conditions.push(sql`${serviceHistory.date} >= ${toDate(params.fromDate)}`);
  } else if (params?.toDate) {
    conditions.push(sql`${serviceHistory.date} <= ${toDate(params.toDate)}`);
  }
  const whereClause = conditions.length ? and(...conditions) : undefined;

  const sortColumn = params?.sortBy === "cost" ? serviceHistory.cost : serviceHistory.date;
  const sortDir = params?.sortOrder === "asc" ? asc : desc;

  const [totalResult] = await db.select({ count: sql<number>`count(*)` }).from(serviceHistory).where(whereClause);
  const total = Number(totalResult.count);

  const rows = await db.select().from(serviceHistory)
    .where(whereClause)
    .orderBy(sortDir(sortColumn))
    .limit(perPage)
    .offset(offset);

  const items = await attachClientAndVehicle(db, rows);
  return { items, total, page, perPage };
}

export async function createServiceRecord(data: {
  clientId: number;
  vehicleId?: number | null;
  invoiceId?: number | null;
  service: string;
  cost: number;
  date: string;
  mileage?: number | null;
  notes?: string;
}) {
  const db = await getDb();
  const result = await db.insert(serviceHistory).values({
    clientId: data.clientId,
    vehicleId: data.vehicleId ?? null,
    invoiceId: data.invoiceId ?? null,
    service: data.service,
    cost: String(data.cost),
    date: toDate(data.date),
    mileage: data.mileage ?? null,
    notes: data.notes || "",
  });
  const id = result[0].insertId;
  const [rec] = await db.select().from(serviceHistory).where(eq(serviceHistory.id, id)).limit(1);
  const [withCV] = await attachClientAndVehicle(db, [rec]);
  return withCV;
}

export async function deleteServiceRecord(id: number) {
  const db = await getDb();
  await db.delete(serviceHistory).where(eq(serviceHistory.id, id));
  return { id };
}

// ─── Reports ──────────────────────────────────────────────────────
export async function getRevenueReport(fromDate?: string, toDate?: string) {
  const db = await getDb();
  const conditions: any[] = [eq(invoices.status, "paid")];
  if (fromDate) conditions.push(sql`${invoices.paidDate} >= ${new Date(fromDate + "T00:00:00Z")}`);
  if (toDate) conditions.push(sql`${invoices.paidDate} <= ${new Date(toDate + "T00:00:00Z")}`);
  const whereClause = and(...conditions);

  const monthlyData = await db.select({
    month: sql<string>`DATE_FORMAT(paid_date, '%Y-%m')`,
    revenue: sql<string>`COALESCE(SUM(total), 0)`,
    count: sql<number>`COUNT(*)`,
  }).from(invoices)
    .where(whereClause)
    .groupBy(sql`DATE_FORMAT(paid_date, '%Y-%m')`)
    .orderBy(sql`DATE_FORMAT(paid_date, '%Y-%m')`);

  const [totals] = await db.select({
    totalRevenue: sql<string>`COALESCE(SUM(total), 0)`,
    totalInvoices: sql<number>`COUNT(*)`,
    avgInvoice: sql<string>`COALESCE(AVG(total), 0)`,
  }).from(invoices).where(whereClause);

  return {
    monthly: monthlyData.map(r => ({ month: r.month, revenue: parseFloat(String(r.revenue)) || 0, count: Number(r.count) })),
    summary: {
      totalRevenue: parseFloat(String(totals.totalRevenue)) || 0,
      totalInvoices: Number(totals.totalInvoices),
      avgInvoice: parseFloat(String(totals.avgInvoice)) || 0,
    },
  };
}

export async function getAppointmentsReport(fromDate?: string, toDate?: string) {
  const db = await getDb();
  const conditions: any[] = [];
  if (fromDate) conditions.push(sql`${appointments.date} >= ${new Date(fromDate + "T00:00:00Z")}`);
  if (toDate) conditions.push(sql`${appointments.date} <= ${new Date(toDate + "T00:00:00Z")}`);
  const whereClause = conditions.length ? and(...conditions) : undefined;

  const statusBreakdown = await db.select({
    status: appointments.status,
    count: sql<number>`COUNT(*)`,
  }).from(appointments)
    .where(whereClause)
    .groupBy(appointments.status);

  const serviceBreakdown = await db.select({
    service: appointments.service,
    count: sql<number>`COUNT(*)`,
  }).from(appointments)
    .where(whereClause)
    .groupBy(appointments.service)
    .orderBy(sql`COUNT(*) DESC`)
    .limit(10);

  const [totals] = await db.select({
    total: sql<number>`COUNT(*)`,
  }).from(appointments).where(whereClause);

  return {
    statusBreakdown: statusBreakdown.map(r => ({ status: r.status, count: Number(r.count) })),
    serviceBreakdown: serviceBreakdown.map(r => ({ service: r.service, count: Number(r.count) })),
    total: Number(totals.total),
  };
}

export async function getClientsReport() {
  const db = await getDb();
  const clientRows = await db.select().from(clients).orderBy(asc(clients.name));
  if (clientRows.length === 0) return [];

  const clientIds = clientRows.map(c => c.id);

  const invoiceCounts = await db.select({
    clientId: invoices.clientId,
    count: sql<number>`COUNT(*)`,
    revenue: sql<string>`COALESCE(SUM(CASE WHEN status = 'paid' THEN total ELSE 0 END), 0)`,
  }).from(invoices)
    .where(inArray(invoices.clientId, clientIds))
    .groupBy(invoices.clientId);

  const apptCounts = await db.select({
    clientId: appointments.clientId,
    count: sql<number>`COUNT(*)`,
  }).from(appointments)
    .where(inArray(appointments.clientId, clientIds))
    .groupBy(appointments.clientId);

  const invMap: Record<number, { count: number; revenue: number }> = {};
  for (const r of invoiceCounts) invMap[r.clientId] = { count: Number(r.count), revenue: parseFloat(String(r.revenue)) || 0 };

  const apptMap: Record<number, number> = {};
  for (const r of apptCounts) apptMap[r.clientId] = Number(r.count);

  return clientRows.map(c => ({
    id: c.id,
    name: c.name,
    email: c.email || "",
    phone: c.phone || "",
    invoiceCount: invMap[c.id]?.count || 0,
    totalRevenue: invMap[c.id]?.revenue || 0,
    appointmentCount: apptMap[c.id] || 0,
  }));
}

export async function getServiceReport(fromDate?: string, toDate?: string) {
  const db = await getDb();
  const conditions: any[] = [];
  if (fromDate) conditions.push(sql`${serviceHistory.date} >= ${new Date(fromDate + "T00:00:00Z")}`);
  if (toDate) conditions.push(sql`${serviceHistory.date} <= ${new Date(toDate + "T00:00:00Z")}`);
  const whereClause = conditions.length ? and(...conditions) : undefined;

  const byService = await db.select({
    service: serviceHistory.service,
    count: sql<number>`COUNT(*)`,
    totalCost: sql<string>`COALESCE(SUM(cost), 0)`,
    avgCost: sql<string>`COALESCE(AVG(cost), 0)`,
  }).from(serviceHistory)
    .where(whereClause)
    .groupBy(serviceHistory.service)
    .orderBy(sql`COUNT(*) DESC`);

  const [totals] = await db.select({
    totalRecords: sql<number>`COUNT(*)`,
    totalCost: sql<string>`COALESCE(SUM(cost), 0)`,
  }).from(serviceHistory).where(whereClause);

  return {
    byService: byService.map(r => ({
      service: r.service,
      count: Number(r.count),
      totalCost: parseFloat(String(r.totalCost)) || 0,
      avgCost: parseFloat(String(r.avgCost)) || 0,
    })),
    summary: {
      totalRecords: Number(totals.totalRecords),
      totalCost: parseFloat(String(totals.totalCost)) || 0,
    },
  };
}

// ─── Booking Settings ─────────────────────────────────────────────
export async function getBookingSettings() {
  const db = await getDb();
  const [existing] = await db.select().from(bookingSettings).limit(1);
  if (existing) return existing;
  // Create default
  const result = await db.insert(bookingSettings).values({});
  const id = result[0].insertId;
  const [created] = await db.select().from(bookingSettings).where(eq(bookingSettings.id, id)).limit(1);
  return created;
}

export async function updateBookingSettings(data: {
  isEnabled?: boolean;
  businessName?: string;
  businessHoursStart?: string;
  businessHoursEnd?: string;
  availableDays?: string;
  slotDurationMinutes?: number;
  maxAdvanceDays?: number;
  availableServices?: string;
}) {
  const db = await getDb();
  const settings = await getBookingSettings();
  await db.update(bookingSettings).set(data).where(eq(bookingSettings.id, settings.id));
  return getBookingSettings();
}

export async function getAvailableSlots(dateStr: string) {
  const db = await getDb();
  const settings = await getBookingSettings();
  if (!settings?.isEnabled) return [];

  const availableDays: number[] = JSON.parse(settings.availableDays);
  const requestDate = new Date(dateStr + "T00:00:00Z");
  const dayOfWeek = requestDate.getUTCDay(); // 0=Sun, 1=Mon, ...
  if (!availableDays.includes(dayOfWeek)) return [];

  // Get existing appointments for this date
  const existingAppts = await db.select().from(appointments)
    .where(and(
      eq(appointments.date, requestDate),
      sql`${appointments.status} != 'cancelled'`
    ));

  const slotDuration = settings.slotDurationMinutes;
  const [startH, startM] = settings.businessHoursStart.split(":").map(Number);
  const [endH, endM] = settings.businessHoursEnd.split(":").map(Number);
  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;

  const slots: string[] = [];
  for (let m = startMinutes; m + slotDuration <= endMinutes; m += slotDuration) {
    const slotStart = m;
    const slotEnd = m + slotDuration;
    const hh = String(Math.floor(slotStart / 60)).padStart(2, "0");
    const mm = String(slotStart % 60).padStart(2, "0");
    const timeStr = `${hh}:${mm}`;

    // Check if slot overlaps any existing appointment
    const hasConflict = existingAppts.some((appt) => {
      const [ah, am] = appt.time.split(":").map(Number);
      const apptStart = ah * 60 + am;
      const apptEnd = apptStart + (appt.durationMinutes || 60);
      return slotStart < apptEnd && slotEnd > apptStart;
    });

    if (!hasConflict) {
      slots.push(timeStr);
    }
  }

  return slots;
}

export async function createPublicBooking(data: {
  name: string;
  email: string;
  phone: string;
  service: string;
  date: string;
  time: string;
  vehicleYear?: string;
  vehicleMake?: string;
  vehicleModel?: string;
  notes?: string;
}) {
  const db = await getDb();
  const settings = await getBookingSettings();
  if (!settings?.isEnabled) throw new Error("Online booking is not available");

  // Find or create client by email
  let [existingClient] = await db.select().from(clients).where(eq(clients.email, data.email)).limit(1);
  let clientId: number;
  if (existingClient) {
    clientId = existingClient.id;
    // Update phone/name if provided and currently empty
    if (!existingClient.phone && data.phone) {
      await db.update(clients).set({ phone: data.phone }).where(eq(clients.id, clientId));
    }
  } else {
    const result = await db.insert(clients).values({
      name: data.name,
      email: data.email,
      phone: data.phone,
    });
    clientId = result[0].insertId;
  }

  // Create vehicle if provided
  let vehicleId: number | null = null;
  if (data.vehicleMake && data.vehicleModel) {
    const result = await db.insert(vehicles).values({
      clientId,
      year: data.vehicleYear || "",
      make: data.vehicleMake,
      model: data.vehicleModel,
    });
    vehicleId = result[0].insertId;
  }

  // Create appointment
  const result = await db.insert(appointments).values({
    clientId,
    vehicleId,
    service: data.service,
    date: new Date(data.date + "T00:00:00Z"),
    time: data.time,
    durationMinutes: settings.slotDurationMinutes,
    status: "scheduled",
    notes: data.notes ? `[Online Booking] ${data.notes}` : "[Online Booking]",
  });
  const appointmentId = result[0].insertId;
  const [appt] = await db.select().from(appointments).where(eq(appointments.id, appointmentId)).limit(1);
  const [withCV] = await attachClientAndVehicle(db, [appt]);
  return withCV;
}
