import Stripe from "stripe";
import { ENV } from "./env";
import type { ServiceProduct } from "./products";

let _stripe: Stripe | null = null;

export function getStripe(): Stripe | null {
  if (_stripe) return _stripe;
  if (!ENV.stripeSecretKey) {
    console.warn("[Stripe] STRIPE_SECRET_KEY not configured");
    return null;
  }
  _stripe = new Stripe(ENV.stripeSecretKey);
  return _stripe;
}

export async function createCheckoutSession(params: {
  invoiceId: number;
  invoiceNumber: number;
  clientName: string;
  clientEmail: string;
  amountCents: number;
  description: string;
}): Promise<string | null> {
  const stripe = getStripe();
  if (!stripe) return null;

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ["card"],
    mode: "payment",
    customer_email: params.clientEmail,
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: {
            name: `Invoice #INV-${params.invoiceNumber}`,
            description: params.description,
          },
          unit_amount: params.amountCents,
        },
        quantity: 1,
      },
    ],
    metadata: {
      invoiceId: String(params.invoiceId),
      invoiceNumber: String(params.invoiceNumber),
      clientName: params.clientName,
    },
    success_url: `${process.env.APP_URL || "https://localhost:3000"}/payment-success?invoice=${params.invoiceNumber}`,
    cancel_url: `${process.env.APP_URL || "https://localhost:3000"}/payment-cancelled`,
  });

  return session.url;
}

/**
 * Create a Stripe Checkout session for a service product or subscription plan.
 */
export async function createServiceCheckoutSession(params: {
  product: ServiceProduct;
  customerEmail?: string;
  origin: string;
}): Promise<string | null> {
  const stripe = getStripe();
  if (!stripe) return null;

  const { product, customerEmail, origin } = params;

  const baseSession: Stripe.Checkout.SessionCreateParams = {
    payment_method_types: ["card"],
    allow_promotion_codes: true,
    metadata: {
      product_id: product.id,
      product_name: product.name,
    },
    success_url: `${origin}/payment-success?product=${encodeURIComponent(product.name)}`,
    cancel_url: `${origin}/payment-cancelled`,
  };

  if (customerEmail) {
    baseSession.customer_email = customerEmail;
  }

  if (product.mode === "subscription") {
    // Create a price on-the-fly for the subscription
    const price = await stripe.prices.create({
      unit_amount: product.priceInCents,
      currency: "usd",
      recurring: { interval: product.interval ?? "month" },
      product_data: { name: product.name },
    });
    const session = await stripe.checkout.sessions.create({
      ...baseSession,
      mode: "subscription",
      line_items: [{ price: price.id, quantity: 1 }],
    });
    return session.url;
  } else {
    const session = await stripe.checkout.sessions.create({
      ...baseSession,
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: { name: product.name, description: product.description },
            unit_amount: product.priceInCents,
          },
          quantity: 1,
        },
      ],
    });
    return session.url;
  }
}

/**
 * Create a direct Stripe Checkout URL for an invoice (no email required).
 * Returns the URL to open in a new tab.
 */
export async function createDirectInvoiceCheckout(params: {
  invoiceId: number;
  invoiceNumber: number;
  amountCents: number;
  description: string;
  customerEmail?: string;
  origin: string;
}): Promise<string | null> {
  const stripe = getStripe();
  if (!stripe) return null;

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ["card"],
    mode: "payment",
    allow_promotion_codes: true,
    customer_email: params.customerEmail,
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: {
            name: `Invoice #INV-${params.invoiceNumber}`,
            description: params.description,
          },
          unit_amount: params.amountCents,
        },
        quantity: 1,
      },
    ],
    metadata: {
      invoiceId: String(params.invoiceId),
      invoiceNumber: String(params.invoiceNumber),
    },
    success_url: `${params.origin}/payment-success?invoice=${params.invoiceNumber}`,
    cancel_url: `${params.origin}/payment-cancelled`,
  });

  return session.url;
}
