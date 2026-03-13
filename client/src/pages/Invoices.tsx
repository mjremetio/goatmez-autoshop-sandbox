import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Plus, FileText, Trash2, ArrowRight, CreditCard, Mail, ArrowUpDown, ChevronLeft, ChevronRight } from "lucide-react";
import { invoiceStatusColors, paymentMethods } from "@/lib/constants";
import { ClientVehicleSelect } from "@/components/ClientVehicleSelect";
import { LineItemForm, LineItem, emptyLineItem, computeLineTotal } from "@/components/LineItemForm";
import { ConfirmDeleteDialog } from "@/components/ConfirmDeleteDialog";
import { SendEmailDialog } from "@/components/SendEmailDialog";

const statuses = ["all", "draft", "sent", "paid", "overdue"];

export default function Invoices() {
  const [filter, setFilter] = useState("all");
  const [showForm, setShowForm] = useState(false);
  const [items, setItems] = useState<LineItem[]>([{ ...emptyLineItem }]);
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>("");
  const [taxRate, setTaxRate] = useState(0);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [paymentDialog, setPaymentDialog] = useState<{ id: number; currentStatus: string } | null>(null);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState("Cash");
  const [emailTarget, setEmailTarget] = useState<{ id: number; clientName: string; clientEmail: string } | null>(null);
  const [paymentLinkTarget, setPaymentLinkTarget] = useState<{ id: number; clientName: string; clientEmail: string } | null>(null);
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState("number");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const perPage = 20;

  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.invoices.list.useQuery({ status: filter !== "all" ? filter as "draft" | "sent" | "paid" | "overdue" : undefined, page, perPage, sortBy, sortOrder });
  const invoices = data?.items;
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / perPage);
  const createInvoice = trpc.invoices.create.useMutation({
    onSuccess: () => { utils.invoices.invalidate(); utils.dashboard.invalidate(); setShowForm(false); toast.success("Invoice created"); },
    onError: (err) => toast.error(err.message),
  });
  const updateStatus = trpc.invoices.updateStatus.useMutation({
    onSuccess: () => { utils.invoices.invalidate(); utils.dashboard.invalidate(); setPaymentDialog(null); toast.success("Status updated"); },
    onError: (err) => toast.error(err.message),
  });
  const deleteInvoice = trpc.invoices.delete.useMutation({
    onSuccess: () => { utils.invoices.invalidate(); utils.dashboard.invalidate(); toast.success("Invoice deleted"); },
    onError: (err) => toast.error(err.message),
  });
  const sendInvoiceEmail = trpc.email.sendInvoice.useMutation({
    onSuccess: () => { setEmailTarget(null); toast.success("Invoice email sent"); },
    onError: (err) => toast.error(err.message),
  });
  const sendPaymentLink = trpc.email.sendPaymentLink.useMutation({
    onSuccess: () => { setPaymentLinkTarget(null); utils.invoices.invalidate(); toast.success("Payment link sent"); },
    onError: (err) => toast.error(err.message),
  });
  const createInvoiceCheckout = trpc.stripe.createInvoiceCheckout.useMutation({
    onSuccess: ({ url }) => {
      toast.success("Opening Stripe Checkout…");
      window.open(url, "_blank");
    },
    onError: (err) => toast.error(err.message),
  });

  const addItem = () => setItems([...items, { ...emptyLineItem }]);
  const removeItem = (idx: number) => setItems(items.filter((_, i) => i !== idx));
  const updateItem = (idx: number, field: string, value: any) => {
    const updated = [...items];
    updated[idx] = { ...updated[idx], [field]: value };
    setItems(updated);
  };

  const subtotal = useMemo(() => items.reduce((sum, it) => sum + computeLineTotal(it), 0), [items]);
  const taxAmount = subtotal * (taxRate / 100);
  const formTotal = subtotal + taxAmount - discountAmount;

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (items.some(it => !it.description.trim())) {
      toast.error("All line items must have a description");
      return;
    }
    const fd = new FormData(e.currentTarget);
    createInvoice.mutate({
      clientId: Number(selectedClientId),
      vehicleId: selectedVehicleId ? Number(selectedVehicleId) : null,
      notes: fd.get("notes") as string,
      dueDate: (fd.get("dueDate") as string) || null,
      taxRate,
      discountAmount,
      items,
    });
  };

  const handleStatusAdvance = (inv: any) => {
    if (inv.status === "draft") {
      updateStatus.mutate({ id: inv.id, status: "sent" });
    } else if (inv.status === "sent") {
      setPaymentDialog({ id: inv.id, currentStatus: inv.status });
      setSelectedPaymentMethod("Cash");
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Invoices</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage billing and payments</p>
        </div>
        <Button onClick={() => { setShowForm(true); setItems([{ ...emptyLineItem }]); setSelectedClientId(""); setSelectedVehicleId(""); setTaxRate(0); setDiscountAmount(0); }}>
          <Plus className="w-4 h-4 mr-2" /> New Invoice
        </Button>
      </div>

      {/* Filter Tabs + Sort */}
      <div className="flex flex-wrap items-center gap-2">
        {statuses.map((s) => (
          <Button key={s} variant={filter === s ? "default" : "outline"} size="sm" onClick={() => { setFilter(s); setPage(1); }} className="capitalize">
            {s}
          </Button>
        ))}
        <div className="ml-auto flex gap-1">
          {[{ key: "number", label: "#" }, { key: "total", label: "Total" }, { key: "createdAt", label: "Date" }].map((s) => (
            <Button key={s.key} variant={sortBy === s.key ? "default" : "outline"} size="sm" className="h-8 text-xs" onClick={() => { if (sortBy === s.key) setSortOrder(sortOrder === "asc" ? "desc" : "asc"); else { setSortBy(s.key); setSortOrder("desc"); } setPage(1); }}>
              {s.label} <ArrowUpDown className="w-3 h-3 ml-1" />
            </Button>
          ))}
        </div>
      </div>

      {/* Invoice List */}
      {isLoading ? (
        <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}</div>
      ) : invoices && invoices.length > 0 ? (
        <div className="space-y-3">
          {invoices.map((inv: any) => {
            const invTaxRate = parseFloat(inv.taxRate || "0");
            const invDiscount = parseFloat(inv.discountAmount || "0");
            const hasExtras = invTaxRate > 0 || invDiscount > 0;
            return (
              <Card key={inv.id}>
                <CardContent className="pt-4 pb-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-semibold">INV-{inv.number}</p>
                        <Badge className={`text-[10px] text-white ${invoiceStatusColors[inv.status]}`}>{inv.status}</Badge>
                        {inv.paymentMethod && <Badge variant="outline" className="text-[10px]"><CreditCard className="w-2.5 h-2.5 mr-1" />{inv.paymentMethod}</Badge>}
                      </div>
                      <p className="text-sm text-muted-foreground mt-0.5">{inv.client?.name}</p>
                      {inv.vehicle && <p className="text-xs text-muted-foreground">{inv.vehicle.year} {inv.vehicle.make} {inv.vehicle.model}</p>}
                      <p className="text-xs text-muted-foreground mt-1">{inv.items?.length || 0} item(s){hasExtras && ` | Tax: ${invTaxRate}%${invDiscount > 0 ? ` | Discount: $${invDiscount.toFixed(2)}` : ""}`}</p>
                    </div>
                    <div className="text-right flex flex-col items-end gap-2">
                      <p className="text-lg font-bold">${parseFloat(inv.total).toFixed(2)}</p>
                      <div className="flex gap-1">
                        {inv.client?.email && (
                          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setEmailTarget({ id: inv.id, clientName: inv.client.name, clientEmail: inv.client.email })}>
                            <Mail className="w-3 h-3 mr-1" /> Email
                          </Button>
                        )}
                        {inv.client?.email && inv.status !== "paid" && (
                          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setPaymentLinkTarget({ id: inv.id, clientName: inv.client.name, clientEmail: inv.client.email })}>
                            <Mail className="w-3 h-3 mr-1" /> Pay Link
                          </Button>
                        )}
                        {inv.status !== "paid" && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs border-primary text-primary hover:bg-primary hover:text-primary-foreground"
                            disabled={createInvoiceCheckout.isPending}
                            onClick={() => createInvoiceCheckout.mutate({ invoiceId: inv.id })}
                          >
                            <CreditCard className="w-3 h-3 mr-1" /> Pay Now
                          </Button>
                        )}
                        {(inv.status === "draft" || inv.status === "sent") && (
                          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => handleStatusAdvance(inv)}>
                            <ArrowRight className="w-3 h-3 mr-1" /> {inv.status === "draft" ? "Mark Sent" : "Mark Paid"}
                          </Button>
                        )}
                        {inv.status !== "paid" && (
                          <Button variant="ghost" size="icon" className="w-7 h-7 text-destructive" onClick={() => setDeleteId(inv.id)}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">No invoices found</p>
          </CardContent>
        </Card>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-4">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-sm text-muted-foreground">Page {page} of {totalPages}</span>
          <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      )}

      {/* Create Invoice Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New Invoice</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <ClientVehicleSelect
              clientId={selectedClientId}
              vehicleId={selectedVehicleId}
              onClientChange={setSelectedClientId}
              onVehicleChange={setSelectedVehicleId}
            />
            <div>
              <Label htmlFor="dueDate">Due Date</Label>
              <Input id="dueDate" name="dueDate" type="date" />
            </div>

            {/* Line Items */}
            <LineItemForm items={items} onUpdate={updateItem} onAdd={addItem} onRemove={removeItem} />

            {/* Tax & Discount */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Tax Rate (%)</Label>
                <Input type="number" step="0.01" min="0" max="100" value={taxRate} onChange={(e) => setTaxRate(parseFloat(e.target.value) || 0)} />
              </div>
              <div>
                <Label>Discount ($)</Label>
                <Input type="number" step="0.01" min="0" value={discountAmount} onChange={(e) => setDiscountAmount(parseFloat(e.target.value) || 0)} />
              </div>
            </div>

            {/* Totals */}
            <div className="text-right space-y-1 border-t border-border pt-3">
              <p className="text-sm text-muted-foreground">Subtotal: ${subtotal.toFixed(2)}</p>
              {taxRate > 0 && <p className="text-sm text-muted-foreground">Tax ({taxRate}%): ${taxAmount.toFixed(2)}</p>}
              {discountAmount > 0 && <p className="text-sm text-muted-foreground">Discount: -${discountAmount.toFixed(2)}</p>}
              <p className="text-lg font-bold">Total: ${formTotal.toFixed(2)}</p>
            </div>

            <div>
              <Label htmlFor="notes">Notes</Label>
              <Textarea id="notes" name="notes" rows={2} />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button type="submit" disabled={!selectedClientId || createInvoice.isPending}>Create Invoice</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Payment Method Dialog */}
      <Dialog open={!!paymentDialog} onOpenChange={(open) => !open && setPaymentDialog(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Payment Method</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Label>How was payment received?</Label>
            <Select value={selectedPaymentMethod} onValueChange={setSelectedPaymentMethod}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {paymentMethods.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPaymentDialog(null)}>Cancel</Button>
            <Button
              disabled={updateStatus.isPending}
              onClick={() => {
                if (paymentDialog) updateStatus.mutate({ id: paymentDialog.id, status: "paid", paymentMethod: selectedPaymentMethod });
              }}
            >
              Mark as Paid
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm Delete */}
      <ConfirmDeleteDialog
        open={!!deleteId}
        onOpenChange={(open) => !open && setDeleteId(null)}
        onConfirm={() => { if (deleteId) deleteInvoice.mutate({ id: deleteId }); setDeleteId(null); }}
        title="Delete Invoice?"
        description="This invoice and all its line items will be permanently deleted."
      />

      {/* Send Email Dialog */}
      <SendEmailDialog
        open={!!emailTarget}
        onOpenChange={(open) => !open && setEmailTarget(null)}
        onConfirm={() => { if (emailTarget) sendInvoiceEmail.mutate({ invoiceId: emailTarget.id }); }}
        isPending={sendInvoiceEmail.isPending}
        title="Email Invoice"
        recipientName={emailTarget?.clientName || ""}
        recipientEmail={emailTarget?.clientEmail || ""}
        description="Send this invoice to the client via email."
      />

      {/* Send Payment Link Dialog */}
      <SendEmailDialog
        open={!!paymentLinkTarget}
        onOpenChange={(open) => !open && setPaymentLinkTarget(null)}
        onConfirm={() => { if (paymentLinkTarget) sendPaymentLink.mutate({ invoiceId: paymentLinkTarget.id }); }}
        isPending={sendPaymentLink.isPending}
        title="Send Payment Link"
        recipientName={paymentLinkTarget?.clientName || ""}
        recipientEmail={paymentLinkTarget?.clientEmail || ""}
        description="Send a Stripe payment link for this invoice via email."
      />
    </div>
  );
}
