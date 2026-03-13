export const invoiceStatusColors: Record<string, string> = {
  draft: "bg-zinc-500",
  sent: "bg-blue-500",
  paid: "bg-emerald-500",
  overdue: "bg-red-500",
};

export const estimateStatusColors: Record<string, string> = {
  draft: "bg-zinc-500",
  sent: "bg-blue-500",
  approved: "bg-emerald-500",
  declined: "bg-red-500",
  converted: "bg-purple-500",
};

export const appointmentStatusColors: Record<string, string> = {
  scheduled: "bg-blue-500",
  confirmed: "bg-emerald-500",
  completed: "bg-zinc-500",
  cancelled: "bg-red-500",
};

export const statusColors: Record<string, string> = {
  ...invoiceStatusColors,
  ...appointmentStatusColors,
  ...estimateStatusColors,
};

export interface ServiceCatalogItem {
  name: string;
  category: "diagnostic" | "module-programming" | "electrical-repair" | "installation";
  suggestedPrice: number;
}

export const serviceCatalog: ServiceCatalogItem[] = [
  // ─── Diagnostics ────────────────────────────────────────────
  { name: "Full Electrical Diagnostic", category: "diagnostic", suggestedPrice: 99 },
  { name: "Check Engine Light Diagnosis", category: "diagnostic", suggestedPrice: 89 },
  { name: "Battery & Charging System Test", category: "diagnostic", suggestedPrice: 49 },
  { name: "Parasitic Draw Test", category: "diagnostic", suggestedPrice: 125 },
  { name: "CAN Bus / Data Network Diagnosis", category: "diagnostic", suggestedPrice: 150 },
  { name: "Sensor Circuit Testing", category: "diagnostic", suggestedPrice: 85 },
  { name: "Starter / Cranking Circuit Diagnosis", category: "diagnostic", suggestedPrice: 75 },
  { name: "No-Start / No-Crank Diagnosis", category: "diagnostic", suggestedPrice: 110 },

  // ─── Module Programming ─────────────────────────────────────
  { name: "ECU / PCM Programming", category: "module-programming", suggestedPrice: 250 },
  { name: "ECU Reflash / Calibration Update", category: "module-programming", suggestedPrice: 199 },
  { name: "TCM (Transmission) Programming", category: "module-programming", suggestedPrice: 225 },
  { name: "BCM (Body Control) Programming", category: "module-programming", suggestedPrice: 199 },
  { name: "ABS / Stability Control Module Programming", category: "module-programming", suggestedPrice: 225 },
  { name: "Airbag (SRS) Module Programming", category: "module-programming", suggestedPrice: 199 },
  { name: "Instrument Cluster Programming", category: "module-programming", suggestedPrice: 175 },
  { name: "TPMS Module Reset / Programming", category: "module-programming", suggestedPrice: 75 },
  { name: "Key / Immobilizer Programming", category: "module-programming", suggestedPrice: 150 },
  { name: "Theft Deterrent Relearn", category: "module-programming", suggestedPrice: 125 },
  { name: "Infotainment / Radio Module Programming", category: "module-programming", suggestedPrice: 175 },
  { name: "HVAC Module Programming", category: "module-programming", suggestedPrice: 150 },
  { name: "Power Window / Mirror Module Setup", category: "module-programming", suggestedPrice: 99 },
  { name: "Blind Spot / Parking Assist Calibration", category: "module-programming", suggestedPrice: 185 },
  { name: "ADAS Camera Calibration", category: "module-programming", suggestedPrice: 350 },
  { name: "Headlamp Module Coding", category: "module-programming", suggestedPrice: 125 },

  // ─── Electrical Repair ──────────────────────────────────────
  { name: "Wiring Harness Repair", category: "electrical-repair", suggestedPrice: 250 },
  { name: "Alternator Replacement", category: "electrical-repair", suggestedPrice: 350 },
  { name: "Starter Motor Replacement", category: "electrical-repair", suggestedPrice: 300 },
  { name: "Battery Replacement & Registration", category: "electrical-repair", suggestedPrice: 125 },
  { name: "Fuse Box / Relay Replacement", category: "electrical-repair", suggestedPrice: 150 },
  { name: "Ground Circuit Repair", category: "electrical-repair", suggestedPrice: 125 },
  { name: "Lighting Circuit Repair", category: "electrical-repair", suggestedPrice: 150 },
  { name: "Power Window Motor Replacement", category: "electrical-repair", suggestedPrice: 225 },
  { name: "Door Lock Actuator Replacement", category: "electrical-repair", suggestedPrice: 200 },

  // ─── Installation ───────────────────────────────────────────
  { name: "Aftermarket Remote Start Install", category: "installation", suggestedPrice: 350 },
  { name: "Dash Camera Installation", category: "installation", suggestedPrice: 125 },
  { name: "Backup Camera Installation", category: "installation", suggestedPrice: 275 },
  { name: "LED / HID Lighting Upgrade", category: "installation", suggestedPrice: 175 },
  { name: "Amplifier / Audio System Install", category: "installation", suggestedPrice: 250 },
  { name: "Trailer Wiring Harness Install", category: "installation", suggestedPrice: 200 },
];

export const serviceCatalogByCategory = {
  diagnostic: serviceCatalog.filter(s => s.category === "diagnostic"),
  "module-programming": serviceCatalog.filter(s => s.category === "module-programming"),
  "electrical-repair": serviceCatalog.filter(s => s.category === "electrical-repair"),
  installation: serviceCatalog.filter(s => s.category === "installation"),
};

export const commonServiceTypes = serviceCatalog.map(s => s.name);

export const paymentMethods = ["Cash", "Credit Card", "Debit Card", "Check", "Bank Transfer", "Other"];
