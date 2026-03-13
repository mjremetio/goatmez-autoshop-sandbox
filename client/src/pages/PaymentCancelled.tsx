import { XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";

export default function PaymentCancelled() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="flex justify-center">
          <div className="w-20 h-20 rounded-full bg-red-100 flex items-center justify-center">
            <XCircle className="w-10 h-10 text-red-500" />
          </div>
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-foreground">Payment Cancelled</h1>
          <p className="text-muted-foreground">
            Your payment was not completed. No charges were made. You can try again anytime.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
          <Button asChild variant="outline">
            <Link href="/book">Book an Appointment</Link>
          </Button>
          <Button asChild>
            <Link href="/services">View Services</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
