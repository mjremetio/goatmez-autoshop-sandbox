import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Plus, Calculator, Trash2, ArrowRight, FileText, CalendarClock, Mail, ArrowUpDown, ChevronLeft, ChevronRight } from "lucide-react";
import { estimateStatusColors } from "@/lib/constants";
import { ClientVehicleSelect } from "@/components/ClientVehicleSelect";
import { LineItemForm, LineItem, emptyLineItem, computeLineTotal } from "@/components/LineItemForm";
import { ConfirmDeleteDialog } from "@/components/ConfirmDeleteDialog";
import { SendEmailDialog } from "@/components/SendEmailDialog";

const statuses = ["all", "draft", "sent", "approved", "declined", "converted"];

export default function Estimates() {
  const [filter, setFilter] = useState("all");
  const [showForm, setShowForm] = useState(false);
  const [items, setItems] = useState<LineItem[]>([{ ...emptyLineItem }]);
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>("");
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [emailTarget, setEmailTarget] = useState<{ id: number; clientName: string; clientEmail: string } | null>(null);
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState("number");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const perPage = 20;

  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.estimates.list.useQuery({ status: filter !== "all" ? filter as "draft" | "sent" | "approved" | "declined" | "converted" : undefined, page, perPage, sortBy, sortOrder });
  const estimates = data?.items;
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / perPage);

  const createEstimate = trpc.estimates.create.useMutation({
    onSuccess: () => { utils.estimates.invalidate(); utils.dashboard.invalidate(); setShowForm(false); toast.success("Estimate created"); },
    onError: (err) => toast.error(err.message),
  });
  const updateStatus = trpc.estimates.updateStatus.useMutation({
    onSuccess: () => { utils.estimates.invalidate(); utils.dashboard.invalidate(); toast.success("Status updated"); },
    onError: (err) => toast.error(err.message),
  });
  const convertToInvoice = trpc.estimates.convertToInvoice.useMutation({
    onSuccess: () => { utils.estimates.invalidate(); utils.invoices.invalidate(); utils.dashboard.invalidate(); toast.success("Converted to invoice"); },
    onError: (err) => toast.error(err.message),
  });
  const deleteEstimate = trpc.estimates.delete.useMutation({
    onSuccess: () => { utils.estimates.invalidate(); utils.dashboard.invalidate(); toast.success("Estimate deleted"); },
    onError: (err) => toast.error(err.message),
  });
  const sendEstimateEmail = trpc.email.sendEstimate.useMutation({
    onSuccess: () => { setEmailTarget(null); toast.success("Estimate email sent"); },
    onError: (err) => toast.error(err.message),
  });

  const addItem = () => setItems([...items, { ...emptyLineItem }]);
  const removeItem = (idx: number) => setItems(items.filter((_, i) => i !== idx));
  const updateItem = (idx: number, field: string, value: any) => {
    const updated = [...items];
    updated[idx] = { ...updated[idx], [field]: value };
    setItems(updated);
  };

  const formTotal = useMemo(() => items.reduce((sum, it) => sum + computeLineTotal(it), 0), [items]);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (items.some(it => !it.description.trim())) {
      toast.error("All line items must have a description");
      return;
    }
    const fd = new FormData(e.currentTarget);
    createEstimate.mutate({
      clientId: Number(selectedClientId),
      vehicleId: selectedVehicleId ? Number(selectedVehicleId) : null,
      notes: fd.get("notes") as string,
      validUntil: (fd.get("validUntil") as string) || null,
      items,
    });
  };

  const formatDate = (dateStr: string) => {
    try { return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }); }
    catch { return dateStr; }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Estimates</h1>
          <p className="text-sm text-muted-foreground mt-1">Create and manage job estimates</p>
        </div>
        <Button onClick={() => { setShowForm(true); setItems([{ ...emptyLineItem }]); setSelectedClientId(""); setSelectedVehicleId(""); }}>
          <Plus className="w-4 h-4 mr-2" /> New Estimate
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {statuses.map((s) => (
          <Button key={s} variant={filter === s ? "default" : "outline"} size="sm" onClick={() => { setFilter(s); setPage(1); }} className="capitalize">{s}</Button>
        ))}
        <div className="ml-auto flex gap-1">
          {[{ key: "number", label: "#" }, { key: "total", label: "Total" }, { key: "createdAt", label: "Date" }].map((s) => (
            <Button key={s.key} variant={sortBy === s.key ? "default" : "outline"} size="sm" className="h-8 text-xs" onClick={() => { if (sortBy === s.key) setSortOrder(sortOrder === "asc" ? "desc" : "asc"); else { setSortBy(s.key); setSortOrder("desc"); } setPage(1); }}>
              {s.label} <ArrowUpDown className="w-3 h-3 ml-1" />
            </Button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}</div>
      ) : estimates && estimates.length > 0 ? (
        <div className="space-y-3">
          {estimates.map((est: any) => (
            <Card key={est.id}>
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold">EST-{est.number}</p>
                      <Badge className={`text-[10px] text-white ${estimateStatusColors[est.status]}`}>{est.status}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mt-0.5">{est.client?.name}</p>
                    {est.vehicle && <p className="text-xs text-muted-foreground">{est.vehicle.year} {est.vehicle.make} {est.vehicle.model}</p>}
                    {est.validUntil && (
                      <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                        <CalendarClock className="w-3 h-3" /> Valid until {formatDate(est.validUntil)}
                      </p>
                    )}
                  </div>
                  <div className="text-right flex flex-col items-end gap-2">
                    <p className="text-lg font-bold">${parseFloat(est.total).toFixed(2)}</p>
                    <div className="flex gap-1 flex-wrap justify-end">
                      {est.client?.email && (
                        <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setEmailTarget({ id: est.id, clientName: est.client.name, clientEmail: est.client.email })}>
                          <Mail className="w-3 h-3 mr-1" /> Email
                        </Button>
                      )}
                      {est.status === "draft" && (
                        <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => updateStatus.mutate({ id: est.id, status: "sent" })}>
                          <ArrowRight className="w-3 h-3 mr-1" /> Send
                        </Button>
                      )}
                      {est.status === "sent" && (
                        <>
                          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => updateStatus.mutate({ id: est.id, status: "approved" })}>
                            Approve
                          </Button>
                          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => updateStatus.mutate({ id: est.id, status: "declined" })}>
                            Decline
                          </Button>
                        </>
                      )}
                      {est.status === "approved" && (
                        <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => convertToInvoice.mutate({ id: est.id })}>
                          <FileText className="w-3 h-3 mr-1" /> Convert to Invoice
                        </Button>
                      )}
                      {est.status !== "converted" && (
                        <Button variant="ghost" size="icon" className="w-7 h-7 text-destructive" onClick={() => setDeleteId(est.id)}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <Calculator className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">No estimates found</p>
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

      {/* Create Estimate Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New Estimate</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <ClientVehicleSelect
              clientId={selectedClientId}
              vehicleId={selectedVehicleId}
              onClientChange={setSelectedClientId}
              onVehicleChange={setSelectedVehicleId}
            />
            <div>
              <Label htmlFor="validUntil">Valid Until</Label>
              <Input id="validUntil" name="validUntil" type="date" />
            </div>

            <LineItemForm items={items} onUpdate={updateItem} onAdd={addItem} onRemove={removeItem} />

            <div className="text-right mt-2">
              <p className="text-lg font-bold">Total: ${formTotal.toFixed(2)}</p>
            </div>

            <div>
              <Label htmlFor="notes">Notes</Label>
              <Textarea id="notes" name="notes" rows={2} />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button type="submit" disabled={!selectedClientId || createEstimate.isPending}>Create Estimate</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Confirm Delete */}
      <ConfirmDeleteDialog
        open={!!deleteId}
        onOpenChange={(open) => !open && setDeleteId(null)}
        onConfirm={() => { if (deleteId) deleteEstimate.mutate({ id: deleteId }); setDeleteId(null); }}
        title="Delete Estimate?"
        description="This estimate and all its line items will be permanently deleted."
      />

      {/* Send Email Dialog */}
      <SendEmailDialog
        open={!!emailTarget}
        onOpenChange={(open) => !open && setEmailTarget(null)}
        onConfirm={() => { if (emailTarget) sendEstimateEmail.mutate({ estimateId: emailTarget.id }); }}
        isPending={sendEstimateEmail.isPending}
        title="Email Estimate"
        recipientName={emailTarget?.clientName || ""}
        recipientEmail={emailTarget?.clientEmail || ""}
        description="Send this estimate to the client via email."
      />
    </div>
  );
}
