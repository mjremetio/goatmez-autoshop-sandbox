import { CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link, useSearch } from "wouter";

export default function PaymentSuccess() {
  const search = useSearch();
  const params = new URLSearchParams(search);
  const invoice = params.get("invoice");
  const product = params.get("product");

  const title = invoice
    ? `Invoice #INV-${invoice} Paid`
    : product
    ? `${product} — Purchase Confirmed`
    : "Payment Successful";

  const subtitle = invoice
    ? "Your invoice has been paid. A receipt will be sent to your email."
    : product
    ? "Thank you for your purchase! You'll receive a confirmation email shortly."
    : "Your payment was processed successfully.";

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="flex justify-center">
          <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center">
            <CheckCircle className="w-10 h-10 text-green-600" />
          </div>
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-foreground">{title}</h1>
          <p className="text-muted-foreground">{subtitle}</p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
          <Button asChild variant="outline">
            <Link href="/book">Book Another Appointment</Link>
          </Button>
          <Button asChild>
            <Link href="/services">View Services</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
