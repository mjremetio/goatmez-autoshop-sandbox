import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { CreditCard, Zap, RefreshCw, CheckCircle, Wrench, Link } from "lucide-react";

function formatPrice(cents: number, mode: string, interval: string | null) {
  const dollars = (cents / 100).toFixed(2);
  if (mode === "subscription") {
    return `$${dollars}/${interval === "year" ? "yr" : "mo"}`;
  }
  return `$${dollars}`;
}

export default function Services() {
  const { data: products, isLoading } = trpc.stripe.products.useQuery();
  const createCheckout = trpc.stripe.createServiceCheckout.useMutation({
    onSuccess: ({ url }) => {
      toast.success("Redirecting to Stripe Checkout…");
      window.open(url, "_blank");
      setCheckoutDialog(null);
    },
    onError: (err) => {
      toast.error(err.message);
      setCheckoutDialog(null);
    },
  });

  const [checkoutDialog, setCheckoutDialog] = useState<{ productId: string; productName: string } | null>(null);
  const [email, setEmail] = useState("");

  const handleBuy = (productId: string, productName: string) => {
    setEmail("");
    setCheckoutDialog({ productId, productName });
  };

  const handleConfirmCheckout = () => {
    if (!checkoutDialog) return;
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error("Please enter a valid email address");
      return;
    }
    createCheckout.mutate({
      productId: checkoutDialog.productId,
      customerEmail: email || undefined,
    });
  };

  const iconFor = (id: string) => {
    if (id.includes("diagnostic")) return <Zap className="w-6 h-6" />;
    if (id.includes("programming")) return <Wrench className="w-6 h-6" />;
    if (id.includes("monthly")) return <RefreshCw className="w-6 h-6" />;
    if (id.includes("yearly")) return <CheckCircle className="w-6 h-6" />;
    return <CreditCard className="w-6 h-6" />;
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-background/95 backdrop-blur sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center">
              <Wrench className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <p className="font-bold text-sm leading-tight">GoatMez Auto Shop</p>
              <p className="text-xs text-muted-foreground">Services & Plans</p>
            </div>
          </div>
          <a href="/book">
            <Button variant="outline" size="sm">
              Book Appointment
            </Button>
          </a>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-5xl mx-auto px-4 py-14 text-center space-y-4">
        <h1 className="text-4xl font-bold tracking-tight">Electrical Expertise, Priced Simply</h1>
        <p className="text-muted-foreground text-lg max-w-xl mx-auto">
          Professional automotive electrical diagnostics and module programming. Pay once or subscribe for ongoing priority service.
        </p>
      </section>

      {/* Products Grid */}
      <section className="max-w-5xl mx-auto px-4 pb-20">
        {isLoading ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-72 rounded-xl bg-muted animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {(products ?? []).map((p) => (
              <Card
                key={p.id}
                className={`relative flex flex-col ${p.badge === "Most Popular" ? "border-primary shadow-lg" : ""}`}
              >
                {p.badge && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge
                      className={`text-xs px-3 py-0.5 ${
                        p.badge === "Most Popular"
                          ? "bg-primary text-primary-foreground"
                          : p.badge === "Best Value"
                          ? "bg-green-600 text-white"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {p.badge}
                    </Badge>
                  </div>
                )}
                <CardHeader className="pt-7 pb-3">
                  <div className="w-11 h-11 rounded-lg bg-primary/10 text-primary flex items-center justify-center mb-3">
                    {iconFor(p.id)}
                  </div>
                  <CardTitle className="text-base leading-tight">{p.name}</CardTitle>
                  <div className="mt-1">
                    <span className="text-2xl font-bold">{formatPrice(p.priceInCents, p.mode, p.interval)}</span>
                    {p.mode === "subscription" && (
                      <span className="text-xs text-muted-foreground ml-1">billed {p.interval === "year" ? "annually" : "monthly"}</span>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="flex-1 pb-3">
                  <CardDescription className="text-xs leading-relaxed">{p.description}</CardDescription>
                </CardContent>
                <CardFooter>
                  <Button
                    className="w-full"
                    variant={p.badge === "Most Popular" ? "default" : "outline"}
                    onClick={() => handleBuy(p.id, p.name)}
                  >
                    <CreditCard className="w-4 h-4 mr-2" />
                    {p.mode === "subscription" ? "Subscribe" : "Buy Now"}
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        )}

        {/* Trust badges */}
        <div className="mt-12 flex flex-wrap justify-center gap-6 text-sm text-muted-foreground">
          <span className="flex items-center gap-1.5"><CheckCircle className="w-4 h-4 text-green-500" /> Secure Stripe Checkout</span>
          <span className="flex items-center gap-1.5"><CheckCircle className="w-4 h-4 text-green-500" /> Cancel anytime</span>
          <span className="flex items-center gap-1.5"><CheckCircle className="w-4 h-4 text-green-500" /> Test card: 4242 4242 4242 4242</span>
        </div>
      </section>

      {/* Checkout Email Dialog */}
      <Dialog open={!!checkoutDialog} onOpenChange={(open) => !open && setCheckoutDialog(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Proceed to Checkout</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              You're purchasing <strong>{checkoutDialog?.productName}</strong>. Optionally enter your email to pre-fill the checkout form.
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="checkout-email">Email (optional)</Label>
              <Input
                id="checkout-email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleConfirmCheckout()}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCheckoutDialog(null)}>
              Cancel
            </Button>
            <Button onClick={handleConfirmCheckout} disabled={createCheckout.isPending}>
              <CreditCard className="w-4 h-4 mr-2" />
              {createCheckout.isPending ? "Opening…" : "Go to Checkout"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
