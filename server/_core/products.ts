/**
 * GoatMez AutoShop — Stripe Products & Prices
 * Define all purchasable products and subscription plans here.
 */

export interface ServiceProduct {
  id: string;
  name: string;
  description: string;
  priceInCents: number;
  mode: "payment" | "subscription";
  interval?: "month" | "year";
  badge?: string;
}

export const SERVICE_PRODUCTS: ServiceProduct[] = [
  {
    id: "electrical-diagnostic",
    name: "Electrical Diagnostic",
    description:
      "Full vehicle electrical system scan using professional OBD-II and manufacturer-level diagnostic tools. Includes a detailed fault code report.",
    priceInCents: 9900, // $99.00
    mode: "payment",
    badge: "One-time",
  },
  {
    id: "module-programming",
    name: "Module Programming",
    description:
      "ECU, TCM, BCM and other control module programming, flashing, and calibration. Covers most makes and models.",
    priceInCents: 19900, // $199.00
    mode: "payment",
    badge: "One-time",
  },
  {
    id: "diagnostic-plan-monthly",
    name: "Monthly Diagnostic Plan",
    description:
      "Unlimited electrical diagnostics every month. Perfect for fleet owners and enthusiasts who want priority service and ongoing vehicle health monitoring.",
    priceInCents: 4900, // $49/month
    mode: "subscription",
    interval: "month",
    badge: "Most Popular",
  },
  {
    id: "diagnostic-plan-yearly",
    name: "Annual Diagnostic Plan",
    description:
      "All benefits of the Monthly Plan at a discounted annual rate. Includes one free module programming session per year.",
    priceInCents: 49900, // $499/year
    mode: "subscription",
    interval: "year",
    badge: "Best Value",
  },
];
