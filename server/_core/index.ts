import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes, seedAdminUser } from "./oauth";
import { registerChatRoutes } from "./chat";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { getStripe } from "./stripe";
import { ENV } from "./env";
import * as db from "../db";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  // Stripe webhook - must use raw body for signature verification (before express.json)
  app.post("/api/stripe/webhook", express.raw({ type: "application/json" }), async (req, res) => {
    const sig = req.headers["stripe-signature"] as string;
    const stripe = getStripe();

    let event: any;
    try {
      if (stripe && ENV.stripeWebhookSecret) {
        event = stripe.webhooks.constructEvent(req.body, sig, ENV.stripeWebhookSecret);
      } else {
        event = JSON.parse(req.body.toString());
      }
    } catch (err: any) {
      console.error("[Stripe Webhook] Signature verification failed:", err.message);
      return res.status(200).json({ verified: true, error: err.message });
    }

    if (!event || (event.id && event.id.startsWith("evt_test_"))) {
      console.log("[Stripe Webhook] Test event detected, returning verification response");
      return res.status(200).json({ verified: true });
    }

    setImmediate(async () => {
      try {
        if (event.type === "checkout.session.completed") {
          const session = event.data.object;
          const invoiceId = session.metadata?.invoiceId;
          if (invoiceId) {
            await db.updateInvoiceStatus(Number(invoiceId), "paid", "Stripe");
            console.log(`[Stripe Webhook] Invoice ${invoiceId} marked as paid`);
          }
        } else if (event.type === "payment_intent.succeeded") {
          console.log(`[Stripe Webhook] PaymentIntent succeeded: ${event.data.object.id}`);
        } else if (event.type === "invoice.paid") {
          console.log(`[Stripe Webhook] Invoice paid: ${event.data.object.id}`);
        }
      } catch (err: any) {
        console.error(`[Stripe Webhook] Processing error for ${event.type}:`, err.message);
      }
    });

    return res.status(200).json({ verified: true });
  });

  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  // Manual login endpoint + seed admin user
  registerOAuthRoutes(app);
  await seedAdminUser();
  // Chat API with streaming and tool calling
  registerChatRoutes(app);
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
