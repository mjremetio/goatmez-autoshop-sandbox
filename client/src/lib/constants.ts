export const commonServiceTypes = [
  "Oil Change",
  "Brake Service",
  "Tire Rotation",
  "Engine Diagnostic",
  "Electrical Diagnostic",
  "Module Programming",
  "Transmission Service",
  "AC Service",
  "Battery Replacement",
  "Suspension Repair",
  "Wheel Alignment",
  "General Maintenance",
  "Inspection",
  "Other",
];

export const appointmentStatusColors: Record<string, string> = {
  scheduled: "bg-blue-100 text-blue-800",
  confirmed: "bg-green-100 text-green-800",
  completed: "bg-gray-100 text-gray-800",
  cancelled: "bg-red-100 text-red-800",
};

export const invoiceStatusColors: Record<string, string> = {
  draft: "bg-gray-100 text-gray-800",
  sent: "bg-blue-100 text-blue-800",
  paid: "bg-green-100 text-green-800",
  overdue: "bg-red-100 text-red-800",
};

export const estimateStatusColors: Record<string, string> = {
  draft: "bg-gray-100 text-gray-800",
  sent: "bg-blue-100 text-blue-800",
  approved: "bg-green-100 text-green-800",
  declined: "bg-red-100 text-red-800",
  converted: "bg-purple-100 text-purple-800",
};

export const statusColors: Record<string, string> = {
  ...appointmentStatusColors,
  ...invoiceStatusColors,
  ...estimateStatusColors,
};

export const paymentMethods = [
  "Cash",
  "Credit Card",
  "Debit Card",
  "Check",
  "Bank Transfer",
  "Stripe",
  "Other",
];
