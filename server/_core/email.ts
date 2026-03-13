import sgMail from "@sendgrid/mail";
import { ENV } from "./env";

let _initialized = false;

function initSendGrid(): boolean {
  if (_initialized) return true;
  if (!ENV.sendgridApiKey) {
    console.warn("[Email] SENDGRID_API_KEY not configured, skipping email send");
    return false;
  }
  sgMail.setApiKey(ENV.sendgridApiKey);
  _initialized = true;
  return true;
}

export type EmailPayload = {
  to: string;
  subject: string;
  html: string;
};

export async function sendEmail(payload: EmailPayload): Promise<boolean> {
  if (!initSendGrid()) return false;
  try {
    await sgMail.send({
      to: payload.to,
      from: ENV.sendgridFrom || "noreply@goatmez.com",
      subject: payload.subject,
      html: payload.html,
    });
    console.log(`[Email] Sent to ${payload.to}: ${payload.subject}`);
    return true;
  } catch (error: any) {
    console.error("[Email] Failed to send email:", error?.response?.body || error);
    return false;
  }
}

// ─── Email Templates ──────────────────────────────────────────────

function wrapTemplate(body: string): string {
  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #1a1a1a;">
      <div style="border-bottom: 3px solid #2563eb; padding-bottom: 16px; margin-bottom: 24px;">
        <h2 style="margin: 0; color: #2563eb;">GoatMez Auto Shop</h2>
      </div>
      ${body}
      <div style="margin-top: 32px; padding-top: 16px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #6b7280;">
        <p>Thank you for choosing GoatMez Auto Shop.</p>
        <p>If you have any questions, please don't hesitate to contact us.</p>
      </div>
    </div>
  `;
}

type InvoiceEmailData = {
  clientName: string;
  invoiceNumber: number;
  total: string;
  items: { description: string; lineTotal: string }[];
  dueDate?: string | null;
  notes?: string;
  vehicleInfo?: string;
};

export function buildInvoiceEmail(data: InvoiceEmailData): { subject: string; html: string } {
  const itemRows = data.items
    .map(
      (item) =>
        `<tr><td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb;">${item.description}</td><td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb; text-align: right;">$${parseFloat(item.lineTotal).toFixed(2)}</td></tr>`
    )
    .join("");

  const body = `
    <p>Hi ${data.clientName},</p>
    <p>Here is your invoice from GoatMez Auto Shop:</p>
    <div style="background: #f9fafb; border-radius: 8px; padding: 16px; margin: 16px 0;">
      <p style="margin: 0 0 8px;"><strong>Invoice #INV-${data.invoiceNumber}</strong></p>
      ${data.vehicleInfo ? `<p style="margin: 0 0 8px; color: #6b7280;">Vehicle: ${data.vehicleInfo}</p>` : ""}
      ${data.dueDate ? `<p style="margin: 0 0 8px; color: #6b7280;">Due: ${data.dueDate}</p>` : ""}
    </div>
    <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
      <thead>
        <tr style="background: #f3f4f6;">
          <th style="padding: 8px 12px; text-align: left; border-bottom: 2px solid #e5e7eb;">Description</th>
          <th style="padding: 8px 12px; text-align: right; border-bottom: 2px solid #e5e7eb;">Amount</th>
        </tr>
      </thead>
      <tbody>${itemRows}</tbody>
      <tfoot>
        <tr>
          <td style="padding: 12px; font-weight: bold; border-top: 2px solid #1a1a1a;">Total</td>
          <td style="padding: 12px; font-weight: bold; text-align: right; border-top: 2px solid #1a1a1a;">$${parseFloat(data.total).toFixed(2)}</td>
        </tr>
      </tfoot>
    </table>
    ${data.notes ? `<p style="color: #6b7280; font-size: 14px;"><strong>Notes:</strong> ${data.notes}</p>` : ""}
  `;

  return {
    subject: `Invoice #INV-${data.invoiceNumber} from GoatMez Auto Shop`,
    html: wrapTemplate(body),
  };
}

type EstimateEmailData = {
  clientName: string;
  estimateNumber: number;
  total: string;
  items: { description: string; lineTotal: string }[];
  validUntil?: string | null;
  notes?: string;
  vehicleInfo?: string;
};

export function buildEstimateEmail(data: EstimateEmailData): { subject: string; html: string } {
  const itemRows = data.items
    .map(
      (item) =>
        `<tr><td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb;">${item.description}</td><td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb; text-align: right;">$${parseFloat(item.lineTotal).toFixed(2)}</td></tr>`
    )
    .join("");

  const body = `
    <p>Hi ${data.clientName},</p>
    <p>Here is your service estimate from GoatMez Auto Shop:</p>
    <div style="background: #f9fafb; border-radius: 8px; padding: 16px; margin: 16px 0;">
      <p style="margin: 0 0 8px;"><strong>Estimate #EST-${data.estimateNumber}</strong></p>
      ${data.vehicleInfo ? `<p style="margin: 0 0 8px; color: #6b7280;">Vehicle: ${data.vehicleInfo}</p>` : ""}
      ${data.validUntil ? `<p style="margin: 0 0 8px; color: #6b7280;">Valid until: ${data.validUntil}</p>` : ""}
    </div>
    <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
      <thead>
        <tr style="background: #f3f4f6;">
          <th style="padding: 8px 12px; text-align: left; border-bottom: 2px solid #e5e7eb;">Description</th>
          <th style="padding: 8px 12px; text-align: right; border-bottom: 2px solid #e5e7eb;">Amount</th>
        </tr>
      </thead>
      <tbody>${itemRows}</tbody>
      <tfoot>
        <tr>
          <td style="padding: 12px; font-weight: bold; border-top: 2px solid #1a1a1a;">Estimated Total</td>
          <td style="padding: 12px; font-weight: bold; text-align: right; border-top: 2px solid #1a1a1a;">$${parseFloat(data.total).toFixed(2)}</td>
        </tr>
      </tfoot>
    </table>
    ${data.notes ? `<p style="color: #6b7280; font-size: 14px;"><strong>Notes:</strong> ${data.notes}</p>` : ""}
    <p style="color: #6b7280; font-size: 14px;">Please review this estimate and let us know if you'd like to proceed.</p>
  `;

  return {
    subject: `Estimate #EST-${data.estimateNumber} from GoatMez Auto Shop`,
    html: wrapTemplate(body),
  };
}

type PaymentLinkEmailData = {
  clientName: string;
  invoiceNumber: number;
  total: string;
  paymentUrl: string;
  dueDate?: string | null;
  vehicleInfo?: string;
};

export function buildPaymentLinkEmail(data: PaymentLinkEmailData): { subject: string; html: string } {
  const body = `
    <p>Hi ${data.clientName},</p>
    <p>Here is a secure payment link for your invoice from GoatMez Auto Shop:</p>
    <div style="background: #f9fafb; border-radius: 8px; padding: 16px; margin: 16px 0;">
      <p style="margin: 0 0 8px;"><strong>Invoice #INV-${data.invoiceNumber}</strong></p>
      ${data.vehicleInfo ? `<p style="margin: 0 0 8px; color: #6b7280;">Vehicle: ${data.vehicleInfo}</p>` : ""}
      ${data.dueDate ? `<p style="margin: 0 0 8px; color: #6b7280;">Due: ${data.dueDate}</p>` : ""}
      <p style="margin: 0; font-size: 20px; font-weight: bold;">Total: $${parseFloat(data.total).toFixed(2)}</p>
    </div>
    <div style="text-align: center; margin: 24px 0;">
      <a href="${data.paymentUrl}" style="display: inline-block; background: #2563eb; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: bold; font-size: 16px;">
        Pay Now
      </a>
    </div>
    <p style="color: #6b7280; font-size: 13px;">This is a secure payment page powered by Stripe. Your card information is never shared with us.</p>
  `;

  return {
    subject: `Payment Link for Invoice #INV-${data.invoiceNumber} - GoatMez Auto Shop`,
    html: wrapTemplate(body),
  };
}

type AppointmentEmailData = {
  clientName: string;
  service: string;
  date: string;
  time: string;
  durationMinutes: number;
  vehicleInfo?: string;
  notes?: string;
};

export function buildPublicBookingEmail(data: AppointmentEmailData): { subject: string; html: string } {
  const body = `
    <p>Hi ${data.clientName},</p>
    <p>Thank you for booking an appointment with GoatMez Auto Shop! Here are your booking details:</p>
    <div style="background: #f9fafb; border-radius: 8px; padding: 16px; margin: 16px 0;">
      <p style="margin: 0 0 8px;"><strong>${data.service}</strong></p>
      <p style="margin: 0 0 4px;">Date: <strong>${data.date}</strong></p>
      <p style="margin: 0 0 4px;">Time: <strong>${data.time}</strong></p>
      <p style="margin: 0 0 4px;">Duration: <strong>${data.durationMinutes} minutes</strong></p>
      ${data.vehicleInfo ? `<p style="margin: 0 0 4px; color: #6b7280;">Vehicle: ${data.vehicleInfo}</p>` : ""}
    </div>
    ${data.notes ? `<p style="color: #6b7280; font-size: 14px;"><strong>Notes:</strong> ${data.notes}</p>` : ""}
    <p>Please arrive a few minutes early. If you need to reschedule or cancel, please contact us as soon as possible.</p>
    <p style="margin-top: 16px; padding: 12px; background: #dbeafe; border-radius: 8px; font-size: 14px;">
      <strong>Your appointment has been confirmed.</strong> We look forward to seeing you!
    </p>
  `;

  return {
    subject: `Booking Confirmation - ${data.service} on ${data.date}`,
    html: wrapTemplate(body),
  };
}

export function buildAppointmentEmail(data: AppointmentEmailData): { subject: string; html: string } {
  const body = `
    <p>Hi ${data.clientName},</p>
    <p>This is a confirmation for your upcoming appointment at GoatMez Auto Shop:</p>
    <div style="background: #f9fafb; border-radius: 8px; padding: 16px; margin: 16px 0;">
      <p style="margin: 0 0 8px;"><strong>${data.service}</strong></p>
      <p style="margin: 0 0 4px;">Date: <strong>${data.date}</strong></p>
      <p style="margin: 0 0 4px;">Time: <strong>${data.time}</strong></p>
      <p style="margin: 0 0 4px;">Duration: <strong>${data.durationMinutes} minutes</strong></p>
      ${data.vehicleInfo ? `<p style="margin: 0 0 4px; color: #6b7280;">Vehicle: ${data.vehicleInfo}</p>` : ""}
    </div>
    ${data.notes ? `<p style="color: #6b7280; font-size: 14px;"><strong>Notes:</strong> ${data.notes}</p>` : ""}
    <p>Please arrive a few minutes early. If you need to reschedule, contact us as soon as possible.</p>
  `;

  return {
    subject: `Appointment Confirmation - ${data.service} on ${data.date}`,
    html: wrapTemplate(body),
  };
}
