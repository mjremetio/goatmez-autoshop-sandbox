import {
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
  decimal,
  date,
  time,
  index,
  boolean,
} from "drizzle-orm/mysql-core";

// ─── Users (auth) ─────────────────────────────────────────────────
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  username: varchar("username", { length: 100 }),
  password: varchar("password", { length: 255 }),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ─── Clients ──────────────────────────────────────────────────────
export const clients = mysqlTable(
  "clients",
  {
    id: int("id").autoincrement().primaryKey(),
    name: varchar("name", { length: 255 }).notNull(),
    phone: varchar("phone", { length: 30 }).default(""),
    email: varchar("email", { length: 255 }).default(""),
    address: varchar("address", { length: 255 }).default(""),
    city: varchar("city", { length: 100 }).default(""),
    state: varchar("state", { length: 50 }).default(""),
    zip: varchar("zip", { length: 20 }).default(""),
    notes: text("notes"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  },
  (table) => [
    index("clients_name_idx").on(table.name),
    index("clients_email_idx").on(table.email),
  ]
);

export type Client = typeof clients.$inferSelect;
export type NewClient = typeof clients.$inferInsert;

// ─── Vehicles ─────────────────────────────────────────────────────
export const vehicles = mysqlTable(
  "vehicles",
  {
    id: int("id").autoincrement().primaryKey(),
    clientId: int("client_id").notNull(),
    year: varchar("year", { length: 4 }).default(""),
    make: varchar("make", { length: 100 }).notNull(),
    model: varchar("model", { length: 100 }).notNull(),
    vin: varchar("vin", { length: 17 }).default(""),
    plate: varchar("plate", { length: 20 }).default(""),
    color: varchar("color", { length: 50 }).default(""),
    mileage: int("mileage"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  },
  (table) => [
    index("vehicles_client_id_idx").on(table.clientId),
    index("vehicles_vin_idx").on(table.vin),
  ]
);

export type Vehicle = typeof vehicles.$inferSelect;
export type NewVehicle = typeof vehicles.$inferInsert;

// ─── Invoices ─────────────────────────────────────────────────────
export const invoices = mysqlTable(
  "invoices",
  {
    id: int("id").autoincrement().primaryKey(),
    number: int("number").notNull().unique(),
    clientId: int("client_id").notNull(),
    vehicleId: int("vehicle_id"),
    status: mysqlEnum("status", ["draft", "sent", "paid", "overdue"]).default("draft").notNull(),
    notes: text("notes"),
    total: decimal("total", { precision: 10, scale: 2 }).default("0").notNull(),
    taxRate: decimal("tax_rate", { precision: 5, scale: 2 }).default("0").notNull(),
    discountAmount: decimal("discount_amount", { precision: 10, scale: 2 }).default("0").notNull(),
    paymentMethod: varchar("payment_method", { length: 50 }),
    issuedDate: date("issued_date"),
    dueDate: date("due_date"),
    paidDate: date("paid_date"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  },
  (table) => [
    index("invoices_client_id_idx").on(table.clientId),
    index("invoices_status_idx").on(table.status),
    index("invoices_number_idx").on(table.number),
  ]
);

export type Invoice = typeof invoices.$inferSelect;
export type NewInvoice = typeof invoices.$inferInsert;

// ─── Invoice Line Items ───────────────────────────────────────────
export const invoiceItems = mysqlTable(
  "invoice_items",
  {
    id: int("id").autoincrement().primaryKey(),
    invoiceId: int("invoice_id").notNull(),
    type: mysqlEnum("type", ["labor", "parts"]).default("labor").notNull(),
    description: varchar("description", { length: 255 }).notNull(),
    hourlyRate: decimal("hourly_rate", { precision: 10, scale: 2 }).default("0"),
    hours: decimal("hours", { precision: 6, scale: 2 }).default("0"),
    quantity: int("quantity").default(1),
    unitPrice: decimal("unit_price", { precision: 10, scale: 2 }).default("0"),
    lineTotal: decimal("line_total", { precision: 10, scale: 2 }).default("0").notNull(),
  },
  (table) => [index("invoice_items_invoice_id_idx").on(table.invoiceId)]
);

export type InvoiceItem = typeof invoiceItems.$inferSelect;
export type NewInvoiceItem = typeof invoiceItems.$inferInsert;

// ─── Estimates ────────────────────────────────────────────────────
export const estimates = mysqlTable(
  "estimates",
  {
    id: int("id").autoincrement().primaryKey(),
    number: int("number").notNull().unique(),
    clientId: int("client_id").notNull(),
    vehicleId: int("vehicle_id"),
    status: mysqlEnum("est_status", ["draft", "sent", "approved", "declined", "converted"]).default("draft").notNull(),
    notes: text("notes"),
    total: decimal("total", { precision: 10, scale: 2 }).default("0").notNull(),
    validUntil: date("valid_until"),
    convertedInvoiceId: int("converted_invoice_id"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  },
  (table) => [
    index("estimates_client_id_idx").on(table.clientId),
    index("estimates_status_idx").on(table.status),
    index("estimates_number_idx").on(table.number),
  ]
);

export type Estimate = typeof estimates.$inferSelect;
export type NewEstimate = typeof estimates.$inferInsert;

// ─── Estimate Line Items ──────────────────────────────────────────
export const estimateItems = mysqlTable(
  "estimate_items",
  {
    id: int("id").autoincrement().primaryKey(),
    estimateId: int("estimate_id").notNull(),
    type: mysqlEnum("est_item_type", ["labor", "parts"]).default("labor").notNull(),
    description: varchar("description", { length: 255 }).notNull(),
    hourlyRate: decimal("hourly_rate", { precision: 10, scale: 2 }).default("0"),
    hours: decimal("hours", { precision: 6, scale: 2 }).default("0"),
    quantity: int("quantity").default(1),
    unitPrice: decimal("unit_price", { precision: 10, scale: 2 }).default("0"),
    lineTotal: decimal("line_total", { precision: 10, scale: 2 }).default("0").notNull(),
  },
  (table) => [index("estimate_items_estimate_id_idx").on(table.estimateId)]
);

export type EstimateItem = typeof estimateItems.$inferSelect;
export type NewEstimateItem = typeof estimateItems.$inferInsert;

// ─── Appointments ─────────────────────────────────────────────────
export const appointments = mysqlTable(
  "appointments",
  {
    id: int("id").autoincrement().primaryKey(),
    clientId: int("client_id").notNull(),
    vehicleId: int("vehicle_id"),
    service: varchar("service", { length: 255 }).notNull(),
    date: date("date").notNull(),
    time: time("time").notNull(),
    durationMinutes: int("duration_minutes").default(60).notNull(),
    status: mysqlEnum("appt_status", ["scheduled", "confirmed", "completed", "cancelled"]).default("scheduled").notNull(),
    notes: text("notes"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  },
  (table) => [
    index("appointments_client_id_idx").on(table.clientId),
    index("appointments_date_idx").on(table.date),
    index("appointments_status_idx").on(table.status),
  ]
);

export type Appointment = typeof appointments.$inferSelect;
export type NewAppointment = typeof appointments.$inferInsert;

// ─── Service History ──────────────────────────────────────────────
export const serviceHistory = mysqlTable(
  "service_history",
  {
    id: int("id").autoincrement().primaryKey(),
    clientId: int("client_id").notNull(),
    vehicleId: int("vehicle_id"),
    invoiceId: int("invoice_id"),
    service: varchar("service", { length: 255 }).notNull(),
    cost: decimal("cost", { precision: 10, scale: 2 }).default("0").notNull(),
    date: date("date").notNull(),
    mileage: int("mileage"),
    notes: text("notes"),
    laborDescription: varchar("labor_description", { length: 500 }),
    laborHours: decimal("labor_hours", { precision: 6, scale: 2 }),
    laborRate: decimal("labor_rate", { precision: 10, scale: 2 }),
    partsDescription: varchar("parts_description", { length: 500 }),
    partsCost: decimal("parts_cost", { precision: 10, scale: 2 }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("service_history_client_id_idx").on(table.clientId),
    index("service_history_vehicle_id_idx").on(table.vehicleId),
    index("service_history_date_idx").on(table.date),
  ]
);

export type ServiceRecord = typeof serviceHistory.$inferSelect;
export type NewServiceRecord = typeof serviceHistory.$inferInsert;

// ─── Booking Settings ────────────────────────────────────────────
export const bookingSettings = mysqlTable("booking_settings", {
  id: int("id").autoincrement().primaryKey(),
  isEnabled: boolean("is_enabled").default(false).notNull(),
  businessName: varchar("business_name", { length: 255 }).default("GoatMez Auto Shop").notNull(),
  businessHoursStart: time("business_hours_start").default("09:00").notNull(),
  businessHoursEnd: time("business_hours_end").default("17:00").notNull(),
  availableDays: varchar("available_days", { length: 100 }).default("[1,2,3,4,5]").notNull(),
  slotDurationMinutes: int("slot_duration_minutes").default(60).notNull(),
  maxAdvanceDays: int("max_advance_days").default(30).notNull(),
  availableServices: text("available_services"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export type BookingSettings = typeof bookingSettings.$inferSelect;
export type NewBookingSettings = typeof bookingSettings.$inferInsert;
