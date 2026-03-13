import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { sendEmail, buildInvoiceEmail, buildEstimateEmail, buildAppointmentEmail, buildPaymentLinkEmail } from "./_core/email";
import { createCheckoutSession, createServiceCheckoutSession, createDirectInvoiceCheckout } from "./_core/stripe";
import { SERVICE_PRODUCTS } from "./_core/products";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, adminProcedure, router } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import * as db from "./db";
import { ENV } from "./_core/env";

const lineItemSchema = z.object({
  type: z.enum(["labor", "parts"]),
  description: z.string().min(1),
  hourlyRate: z.number().min(0).optional(),
  hours: z.number().min(0).optional(),
  quantity: z.number().min(0).optional(),
  unitPrice: z.number().min(0).optional(),
});

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  // ─── User Management (admin-only) ───────────────────────────
  users: router({
    list: adminProcedure.query(() => db.listUsers()),
    create: adminProcedure
      .input(z.object({
        username: z.string().min(1).max(100),
        password: z.string().min(6),
        name: z.string().optional(),
        email: z.string().email().optional().or(z.literal("")),
        role: z.enum(["user", "admin"]).optional(),
      }))
      .mutation(({ input }) => db.createUser({ ...input, email: input.email || undefined })),
    updateRole: adminProcedure
      .input(z.object({ id: z.number(), role: z.enum(["user", "admin"]) }))
      .mutation(({ input }) => db.updateUserRole(input.id, input.role)),
    updatePassword: adminProcedure
      .input(z.object({ id: z.number(), password: z.string().min(6) }))
      .mutation(({ input }) => db.updateUserPassword(input.id, input.password)),
    updateProfile: adminProcedure
      .input(z.object({ id: z.number(), name: z.string().optional(), email: z.string().email().optional().or(z.literal("")) }))
      .mutation(({ input }) => db.updateUserProfile(input.id, { name: input.name, email: input.email || undefined })),
    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(({ input }) => db.deleteUser(input.id)),
  }),

  // ─── Dashboard ────────────────────────────────────────────────
  dashboard: router({
    get: protectedProcedure.query(() => db.getDashboardData()),
    revenueChart: protectedProcedure.query(() => db.getRevenueChartData()),
  }),

  // ─── Clients ──────────────────────────────────────────────────
  clients: router({
    list: protectedProcedure
      .input(z.object({ search: z.string().optional(), page: z.number().optional(), perPage: z.number().optional(), sortBy: z.string().optional(), sortOrder: z.enum(["asc", "desc"]).optional() }).optional())
      .query(({ input }) => db.listClients(input?.search, { page: input?.page, perPage: input?.perPage, sortBy: input?.sortBy, sortOrder: input?.sortOrder })),
    get: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(({ input }) => db.getClient(input.id)),
    create: protectedProcedure
      .input(z.object({ name: z.string().min(1), phone: z.string().optional(), email: z.string().optional(), notes: z.string().optional(), address: z.string().optional(), city: z.string().optional(), state: z.string().optional(), zip: z.string().optional() }))
      .mutation(({ input }) => db.createClient(input)),
    update: protectedProcedure
      .input(z.object({ id: z.number(), name: z.string().min(1).optional(), phone: z.string().optional(), email: z.string().optional(), notes: z.string().optional(), address: z.string().optional(), city: z.string().optional(), state: z.string().optional(), zip: z.string().optional() }))
      .mutation(({ input }) => db.updateClient(input.id, input)),
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(({ input }) => db.deleteClient(input.id)),
  }),

  // ─── Vehicles ─────────────────────────────────────────────────
  vehicles: router({
    list: protectedProcedure
      .input(z.object({ clientId: z.number().optional() }).optional())
      .query(({ input }) => db.listVehicles(input?.clientId)),
    create: protectedProcedure
      .input(z.object({ clientId: z.number(), year: z.string().optional(), make: z.string(), model: z.string(), vin: z.string().optional(), plate: z.string().optional(), color: z.string().optional(), mileage: z.number().min(0).nullable().optional() }))
      .mutation(({ input }) => db.createVehicle(input)),
    update: protectedProcedure
      .input(z.object({ id: z.number(), year: z.string().optional(), make: z.string().optional(), model: z.string().optional(), vin: z.string().optional(), plate: z.string().optional(), color: z.string().optional(), mileage: z.number().min(0).nullable().optional() }))
      .mutation(({ input }) => db.updateVehicle(input.id, input)),
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(({ input }) => db.deleteVehicle(input.id)),
    lookupPlate: protectedProcedure
      .input(z.object({ plate: z.string().min(1), state: z.string().length(2) }))
      .mutation(async ({ input }) => {
        if (!ENV.plateToVinApiKey) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Plate lookup is not configured. Missing API key." });
        }
        const res = await fetch("https://platetovin.com/api/convert", {
          method: "POST",
          headers: {
            "Authorization": ENV.plateToVinApiKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ state: input.state, plate: input.plate }),
        });
        if (!res.ok) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Plate lookup failed. Please verify the plate number and state." });
        }
        const data = await res.json();
        if (!data.success || !data.vin) {
          throw new TRPCError({ code: "BAD_REQUEST", message: data.message ?? "Plate lookup failed. Please verify the plate number and state." });
        }
        // API returns data.vin as a nested object with all vehicle details
        const vehicle = data.vin as Record<string, unknown>;
        const colorField = vehicle.color as { name?: string } | string | undefined;
        const colorName = typeof colorField === "object" && colorField !== null
          ? ((colorField as { name?: string }).name ?? "")
          : ((colorField as string) ?? "");
        return {
          vin: (vehicle.vin as string) ?? "",
          year: String(vehicle.year ?? ""),
          make: (vehicle.make as string) ?? "",
          model: (vehicle.model as string) ?? "",
          color: colorName,
          trim: (vehicle.trim as string) ?? "",
        };
      }),
  }),

  // ─── Invoices ─────────────────────────────────────────────────
  invoices: router({
    list: protectedProcedure
      .input(z.object({ status: z.enum(["all", "draft", "sent", "paid", "overdue"]).optional(), clientId: z.number().optional(), page: z.number().optional(), perPage: z.number().optional(), sortBy: z.string().optional(), sortOrder: z.enum(["asc", "desc"]).optional() }).optional())
      .query(({ input }) => db.listInvoices(input)),
    get: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(({ input }) => db.getInvoice(input.id)),
    nextNumber: protectedProcedure.query(() => db.getNextInvoiceNumber()),
    create: protectedProcedure
      .input(z.object({
        clientId: z.number(),
        vehicleId: z.number().nullable().optional(),
        status: z.enum(["draft", "sent", "paid", "overdue"]).optional(),
        notes: z.string().optional(),
        dueDate: z.string().nullable().optional(),
        taxRate: z.number().min(0).max(100).optional(),
        discountAmount: z.number().min(0).optional(),
        items: z.array(lineItemSchema).min(1),
      }))
      .mutation(({ input }) => db.createInvoice(input)),
    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        vehicleId: z.number().nullable().optional(),
        notes: z.string().optional(),
        dueDate: z.string().nullable().optional(),
        taxRate: z.number().min(0).max(100).optional(),
        discountAmount: z.number().min(0).optional(),
        items: z.array(lineItemSchema).min(1),
      }))
      .mutation(({ input }) => db.updateInvoice(input.id, input)),
    updateStatus: protectedProcedure
      .input(z.object({ id: z.number(), status: z.enum(["draft", "sent", "paid", "overdue"]), paymentMethod: z.string().optional() }))
      .mutation(({ input }) => db.updateInvoiceStatus(input.id, input.status, input.paymentMethod)),
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(({ input }) => db.deleteInvoice(input.id)),
  }),

  // ─── Estimates ────────────────────────────────────────────────
  estimates: router({
    list: protectedProcedure
      .input(z.object({ status: z.enum(["all", "draft", "sent", "approved", "declined", "converted"]).optional(), clientId: z.number().optional(), page: z.number().optional(), perPage: z.number().optional(), sortBy: z.string().optional(), sortOrder: z.enum(["asc", "desc"]).optional() }).optional())
      .query(({ input }) => db.listEstimates(input)),
    nextNumber: protectedProcedure.query(() => db.getNextEstimateNumber()),
    create: protectedProcedure
      .input(z.object({
        clientId: z.number(),
        vehicleId: z.number().nullable().optional(),
        status: z.enum(["draft", "sent", "approved", "declined", "converted"]).optional(),
        notes: z.string().optional(),
        validUntil: z.string().nullable().optional(),
        items: z.array(lineItemSchema).min(1),
      }))
      .mutation(({ input }) => db.createEstimate(input)),
    updateStatus: protectedProcedure
      .input(z.object({ id: z.number(), status: z.enum(["draft", "sent", "approved", "declined", "converted"]) }))
      .mutation(({ input }) => db.updateEstimateStatus(input.id, input.status)),
    convertToInvoice: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(({ input }) => db.convertEstimateToInvoice(input.id)),
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(({ input }) => db.deleteEstimate(input.id)),
  }),

  // ─── Appointments ─────────────────────────────────────────────
  appointments: router({
    list: protectedProcedure
      .input(z.object({ date: z.string().optional(), from: z.string().optional(), to: z.string().optional(), status: z.enum(["scheduled", "confirmed", "completed", "cancelled"]).optional(), clientId: z.number().optional(), search: z.string().optional(), page: z.number().optional(), perPage: z.number().optional(), sortBy: z.string().optional(), sortOrder: z.enum(["asc", "desc"]).optional() }).optional())
      .query(({ input }) => db.listAppointments(input)),
    create: protectedProcedure
      .input(z.object({
        clientId: z.number(),
        vehicleId: z.number().nullable().optional(),
        service: z.string().min(1),
        date: z.string(),
        time: z.string().regex(/^\d{2}:\d{2}$/, "Time must be HH:MM format"),
        durationMinutes: z.number().min(15).max(480).optional(),
        status: z.enum(["scheduled", "confirmed", "completed", "cancelled"]).optional(),
        notes: z.string().optional(),
      }))
      .mutation(({ input }) => db.createAppointment(input)),
    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        clientId: z.number().optional(),
        vehicleId: z.number().nullable().optional(),
        service: z.string().min(1).optional(),
        date: z.string().optional(),
        time: z.string().regex(/^\d{2}:\d{2}$/, "Time must be HH:MM format").optional(),
        durationMinutes: z.number().min(15).max(480).optional(),
        status: z.enum(["scheduled", "confirmed", "completed", "cancelled"]).optional(),
        notes: z.string().optional(),
      }))
      .mutation(({ input }) => db.updateAppointment(input.id, input)),
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(({ input }) => db.deleteAppointment(input.id)),
  }),

  // ─── Service History ──────────────────────────────────────────
  serviceHistory: router({
    list: protectedProcedure
      .input(z.object({ clientId: z.number().optional(), vehicleId: z.number().optional(), search: z.string().optional(), fromDate: z.string().optional(), toDate: z.string().optional(), sortBy: z.enum(["date", "cost"]).optional(), sortOrder: z.enum(["asc", "desc"]).optional(), page: z.number().optional(), perPage: z.number().optional() }).optional())
      .query(({ input }) => db.listServiceHistory(input)),
    create: protectedProcedure
      .input(z.object({
        clientId: z.number(),
        vehicleId: z.number().nullable().optional(),
        invoiceId: z.number().nullable().optional(),
        service: z.string().min(1),
        cost: z.number().min(0),
        date: z.string(),
        mileage: z.number().min(0).nullable().optional(),
        notes: z.string().optional(),
      }))
      .mutation(({ input }) => db.createServiceRecord(input)),
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(({ input }) => db.deleteServiceRecord(input.id)),
  }),

  // ─── Email Notifications ───────────────────────────────────────
  email: router({
    sendInvoice: protectedProcedure
      .input(z.object({ invoiceId: z.number() }))
      .mutation(async ({ input }) => {
        const invoice = await db.getInvoice(input.invoiceId);
        if (!invoice) throw new TRPCError({ code: "NOT_FOUND", message: "Invoice not found" });
        if (!invoice.client?.email) throw new TRPCError({ code: "BAD_REQUEST", message: "Client does not have an email address" });

        const items = await db.getInvoiceItems(input.invoiceId);
        const vehicleInfo = invoice.vehicle ? `${invoice.vehicle.year || ""} ${invoice.vehicle.make} ${invoice.vehicle.model}`.trim() : undefined;
        const dueDate = invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : null;

        const { subject, html } = buildInvoiceEmail({
          clientName: invoice.client.name,
          invoiceNumber: invoice.number,
          total: invoice.total,
          items: items.map((it: any) => ({ description: it.description, lineTotal: it.lineTotal })),
          dueDate,
          notes: invoice.notes || undefined,
          vehicleInfo,
        });

        const sent = await sendEmail({ to: invoice.client.email, subject, html });
        if (!sent) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to send email. Check SMTP configuration." });
        return { success: true };
      }),

    sendPaymentLink: protectedProcedure
      .input(z.object({ invoiceId: z.number() }))
      .mutation(async ({ input }) => {
        const invoice = await db.getInvoice(input.invoiceId);
        if (!invoice) throw new TRPCError({ code: "NOT_FOUND", message: "Invoice not found" });
        if (!invoice.client?.email) throw new TRPCError({ code: "BAD_REQUEST", message: "Client does not have an email address" });
        if (invoice.status === "paid") throw new TRPCError({ code: "BAD_REQUEST", message: "Invoice is already paid" });

        const amountCents = Math.round(parseFloat(invoice.total) * 100);
        if (amountCents <= 0) throw new TRPCError({ code: "BAD_REQUEST", message: "Invoice total must be greater than zero" });

        const vehicleInfo = invoice.vehicle
          ? `${invoice.vehicle.year || ""} ${invoice.vehicle.make} ${invoice.vehicle.model}`.trim()
          : undefined;

        const paymentUrl = await createCheckoutSession({
          invoiceId: invoice.id,
          invoiceNumber: invoice.number,
          clientName: invoice.client.name,
          clientEmail: invoice.client.email,
          amountCents,
          description: vehicleInfo ? `Auto service - ${vehicleInfo}` : "Auto service invoice",
        });
        if (!paymentUrl) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to create payment link. Check Stripe configuration." });

        const dueDate = invoice.dueDate
          ? new Date(invoice.dueDate).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
          : null;

        const { subject, html } = buildPaymentLinkEmail({
          clientName: invoice.client.name,
          invoiceNumber: invoice.number,
          total: invoice.total,
          paymentUrl,
          dueDate,
          vehicleInfo,
        });

        const sent = await sendEmail({ to: invoice.client.email, subject, html });
        if (!sent) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to send email. Check SMTP configuration." });

        if (invoice.status === "draft") {
          await db.updateInvoiceStatus(invoice.id, "sent");
        }

        return { success: true };
      }),

    sendEstimate: protectedProcedure
      .input(z.object({ estimateId: z.number() }))
      .mutation(async ({ input }) => {
        const estimate = await db.getEstimate(input.estimateId);
        if (!estimate) throw new TRPCError({ code: "NOT_FOUND", message: "Estimate not found" });
        if (!estimate.client?.email) throw new TRPCError({ code: "BAD_REQUEST", message: "Client does not have an email address" });

        const items = await db.getEstimateItems(input.estimateId);
        const vehicleInfo = estimate.vehicle ? `${estimate.vehicle.year || ""} ${estimate.vehicle.make} ${estimate.vehicle.model}`.trim() : undefined;
        const validUntil = estimate.validUntil ? new Date(estimate.validUntil).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : null;

        const { subject, html } = buildEstimateEmail({
          clientName: estimate.client.name,
          estimateNumber: estimate.number,
          total: estimate.total,
          items: items.map((it: any) => ({ description: it.description, lineTotal: it.lineTotal })),
          validUntil,
          notes: estimate.notes || undefined,
          vehicleInfo,
        });

        const sent = await sendEmail({ to: estimate.client.email, subject, html });
        if (!sent) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to send email. Check SMTP configuration." });
        return { success: true };
      }),

    sendAppointmentConfirmation: protectedProcedure
      .input(z.object({ appointmentId: z.number() }))
      .mutation(async ({ input }) => {
        const appointment = await db.getAppointment(input.appointmentId);
        if (!appointment) throw new TRPCError({ code: "NOT_FOUND", message: "Appointment not found" });
        if (!appointment.client?.email) throw new TRPCError({ code: "BAD_REQUEST", message: "Client does not have an email address" });

        const vehicleInfo = appointment.vehicle ? `${appointment.vehicle.year || ""} ${appointment.vehicle.make} ${appointment.vehicle.model}`.trim() : undefined;
        const dateStr = new Date(appointment.date).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });

        const { subject, html } = buildAppointmentEmail({
          clientName: appointment.client.name,
          service: appointment.service,
          date: dateStr,
          time: appointment.time,
          durationMinutes: appointment.durationMinutes || 60,
          vehicleInfo,
          notes: appointment.notes || undefined,
        });

        const sent = await sendEmail({ to: appointment.client.email, subject, html });
        if (!sent) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to send email. Check SMTP configuration." });
        return { success: true };
      }),
  }),

  // ─── Reports ────────────────────────────────────────────────────
  reports: router({
    revenue: protectedProcedure
      .input(z.object({ fromDate: z.string().optional(), toDate: z.string().optional() }).optional())
      .query(({ input }) => db.getRevenueReport(input?.fromDate, input?.toDate)),
    appointments: protectedProcedure
      .input(z.object({ fromDate: z.string().optional(), toDate: z.string().optional() }).optional())
      .query(({ input }) => db.getAppointmentsReport(input?.fromDate, input?.toDate)),
    clients: protectedProcedure.query(() => db.getClientsReport()),
    services: protectedProcedure
      .input(z.object({ fromDate: z.string().optional(), toDate: z.string().optional() }).optional())
      .query(({ input }) => db.getServiceReport(input?.fromDate, input?.toDate)),
  }),

  // ─── Stripe Payments ─────────────────────────────────────────────
  stripe: router({
    // List all available service products/plans
    products: publicProcedure.query(() =>
      SERVICE_PRODUCTS.map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        priceInCents: p.priceInCents,
        mode: p.mode,
        interval: p.interval ?? null,
        badge: p.badge ?? null,
      }))
    ),

    // Create a Stripe Checkout session for a service product or subscription
    createServiceCheckout: publicProcedure
      .input(z.object({
        productId: z.string(),
        customerEmail: z.string().email().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const product = SERVICE_PRODUCTS.find((p) => p.id === input.productId);
        if (!product) throw new TRPCError({ code: "NOT_FOUND", message: "Product not found" });
        const origin = ctx.req.headers.origin as string || "https://autoshop-goatmez.manus.space";
        const url = await createServiceCheckoutSession({
          product,
          customerEmail: input.customerEmail,
          origin,
        });
        if (!url) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Stripe is not configured. Please add STRIPE_SECRET_KEY in Settings." });
        return { url };
      }),

    // Create a direct Stripe Checkout URL for a specific invoice (opens in new tab)
    createInvoiceCheckout: protectedProcedure
      .input(z.object({ invoiceId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const invoice = await db.getInvoice(input.invoiceId);
        if (!invoice) throw new TRPCError({ code: "NOT_FOUND", message: "Invoice not found" });
        if (invoice.status === "paid") throw new TRPCError({ code: "BAD_REQUEST", message: "Invoice is already paid" });
        const amountCents = Math.round(parseFloat(invoice.total) * 100);
        if (amountCents < 50) throw new TRPCError({ code: "BAD_REQUEST", message: "Invoice total must be at least $0.50" });
        const vehicleInfo = invoice.vehicle
          ? `${invoice.vehicle.year || ""} ${invoice.vehicle.make} ${invoice.vehicle.model}`.trim()
          : undefined;
        const origin = ctx.req.headers.origin as string || "https://autoshop-goatmez.manus.space";
        const url = await createDirectInvoiceCheckout({
          invoiceId: invoice.id,
          invoiceNumber: invoice.number,
          amountCents,
          description: vehicleInfo ? `Auto service - ${vehicleInfo}` : "Auto service invoice",
          customerEmail: invoice.client?.email ?? undefined,
          origin,
        });
        if (!url) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Stripe is not configured. Please add STRIPE_SECRET_KEY in Settings." });
        return { url };
      }),
  }),

  // ─── Online Booking (public + admin) ────────────────────────────
  booking: router({
    settings: publicProcedure.query(() => db.getBookingSettings()),
    availableSlots: publicProcedure
      .input(z.object({ date: z.string() }))
      .query(({ input }) => db.getAvailableSlots(input.date)),
    create: publicProcedure
      .input(z.object({
        name: z.string().min(1),
        email: z.string().email(),
        phone: z.string().min(1),
        service: z.string().min(1),
        date: z.string(),
        time: z.string().regex(/^\d{2}:\d{2}$/),
        vehicleYear: z.string().optional(),
        vehicleMake: z.string().optional(),
        vehicleModel: z.string().optional(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const appointment = await db.createPublicBooking(input);
        // Send confirmation email
        try {
          const { sendEmail, buildPublicBookingEmail } = await import("./_core/email");
          const dateStr = new Date(input.date).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
          const settings = await db.getBookingSettings();
          const { subject, html } = buildPublicBookingEmail({
            clientName: input.name,
            service: input.service,
            date: dateStr,
            time: input.time,
            durationMinutes: settings?.slotDurationMinutes || 60,
            vehicleInfo: input.vehicleMake && input.vehicleModel ? `${input.vehicleYear || ""} ${input.vehicleMake} ${input.vehicleModel}`.trim() : undefined,
            notes: input.notes,
          });
          await sendEmail({ to: input.email, subject, html });
        } catch (e) {
          console.error("[Booking] Failed to send confirmation email:", e);
        }
        return appointment;
      }),
    updateSettings: adminProcedure
      .input(z.object({
        isEnabled: z.boolean().optional(),
        businessName: z.string().optional(),
        businessHoursStart: z.string().optional(),
        businessHoursEnd: z.string().optional(),
        availableDays: z.string().optional(),
        slotDurationMinutes: z.number().optional(),
        maxAdvanceDays: z.number().optional(),
        availableServices: z.string().optional(),
      }))
      .mutation(({ input }) => db.updateBookingSettings(input)),
  }),
});

export type AppRouter = typeof appRouter;
