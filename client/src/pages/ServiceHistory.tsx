import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Plus, Search, History, Trash2, DollarSign, Wrench, ArrowUpDown, Gauge, ChevronLeft, ChevronRight } from "lucide-react";
import { commonServiceTypes } from "@/lib/constants";
import { ClientVehicleSelect } from "@/components/ClientVehicleSelect";
import { ConfirmDeleteDialog } from "@/components/ConfirmDeleteDialog";

export default function ServiceHistoryPage() {
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>("");
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [sortBy, setSortBy] = useState<"date" | "cost">("date");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [serviceType, setServiceType] = useState("");
  const [page, setPage] = useState(1);
  const perPage = 20;

  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.serviceHistory.list.useQuery({
    search: search || undefined,
    fromDate: fromDate || undefined,
    toDate: toDate || undefined,
    sortBy,
    sortOrder,
    page,
    perPage,
  });
  const records = data?.items;
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / perPage);

  const createRecord = trpc.serviceHistory.create.useMutation({
    onSuccess: () => { utils.serviceHistory.invalidate(); setShowForm(false); toast.success("Service record added"); },
    onError: (err) => toast.error(err.message),
  });
  const deleteRecord = trpc.serviceHistory.delete.useMutation({
    onSuccess: () => { utils.serviceHistory.invalidate(); toast.success("Record deleted"); },
    onError: (err) => toast.error(err.message),
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const mileageStr = fd.get("mileage") as string;
    createRecord.mutate({
      clientId: Number(selectedClientId),
      vehicleId: selectedVehicleId ? Number(selectedVehicleId) : null,
      service: serviceType || (fd.get("service") as string),
      cost: parseFloat(fd.get("cost") as string) || 0,
      date: fd.get("date") as string,
      mileage: mileageStr ? parseInt(mileageStr) : null,
      notes: fd.get("notes") as string,
    });
  };

  const toggleSort = (field: "date" | "cost") => {
    if (sortBy === field) {
      setSortOrder(sortOrder === "desc" ? "asc" : "desc");
    } else {
      setSortBy(field);
      setSortOrder("desc");
    }
    setPage(1);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Service History</h1>
          <p className="text-sm text-muted-foreground mt-1">Track all completed services and repairs</p>
        </div>
        <Button onClick={() => { setShowForm(true); setSelectedClientId(""); setSelectedVehicleId(""); setServiceType(""); }}>
          <Plus className="w-4 h-4 mr-2" /> Add Record
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search service records..." className="pl-9" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        </div>
        <div className="flex gap-2">
          <div>
            <Label className="text-xs text-muted-foreground">From</Label>
            <Input type="date" className="w-36 h-9" value={fromDate} onChange={(e) => { setFromDate(e.target.value); setPage(1); }} />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">To</Label>
            <Input type="date" className="w-36 h-9" value={toDate} onChange={(e) => { setToDate(e.target.value); setPage(1); }} />
          </div>
        </div>
        <div className="flex gap-1">
          <Button variant={sortBy === "date" ? "default" : "outline"} size="sm" className="h-9" onClick={() => toggleSort("date")}>
            Date <ArrowUpDown className="w-3 h-3 ml-1" />
          </Button>
          <Button variant={sortBy === "cost" ? "default" : "outline"} size="sm" className="h-9" onClick={() => toggleSort("cost")}>
            Cost <ArrowUpDown className="w-3 h-3 ml-1" />
          </Button>
        </div>
        {total > 0 && <span className="text-xs text-muted-foreground">{total} record(s)</span>}
      </div>

      {isLoading ? (
        <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}</div>
      ) : records && records.length > 0 ? (
        <div className="space-y-3">
          {records.map((rec: any) => (
            <Card key={rec.id}>
              <CardContent className="pt-4 pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <Wrench className="w-4 h-4 text-primary" />
                      <p className="font-semibold">{rec.service}</p>
                    </div>
                    <p className="text-sm text-muted-foreground mt-0.5">{rec.client?.name}</p>
                    {rec.vehicle && <p className="text-xs text-muted-foreground">{rec.vehicle.year} {rec.vehicle.make} {rec.vehicle.model}</p>}
                    {rec.mileage && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                        <Gauge className="w-3 h-3" />{rec.mileage.toLocaleString()} mi
                      </p>
                    )}
                    {rec.notes && <p className="text-xs text-muted-foreground mt-1">{rec.notes}</p>}
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(rec.date).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}
                    </p>
                  </div>
                  <div className="text-right flex flex-col items-end gap-2">
                    <div className="flex items-center gap-1 text-lg font-bold">
                      <DollarSign className="w-4 h-4" />
                      {parseFloat(rec.cost).toFixed(2)}
                    </div>
                    {rec.invoiceId && <span className="text-[10px] text-muted-foreground">From Invoice</span>}
                    <Button variant="ghost" size="icon" className="w-7 h-7 text-destructive" onClick={() => setDeleteId(rec.id)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <History className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">No service records found</p>
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

      {/* Add Service Record Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Service Record</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <ClientVehicleSelect
              clientId={selectedClientId}
              vehicleId={selectedVehicleId}
              onClientChange={setSelectedClientId}
              onVehicleChange={setSelectedVehicleId}
            />
            <div>
              <Label>Service Type *</Label>
              <Select value={serviceType} onValueChange={setServiceType}>
                <SelectTrigger><SelectValue placeholder="Select or type below" /></SelectTrigger>
                <SelectContent>
                  {commonServiceTypes.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
              {!serviceType && (
                <Input name="service" className="mt-2" placeholder="Or type a custom service..." required={!serviceType} />
              )}
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label htmlFor="cost">Cost *</Label>
                <Input id="cost" name="cost" type="number" step="0.01" min="0" required placeholder="0.00" />
              </div>
              <div>
                <Label htmlFor="date">Date *</Label>
                <Input id="date" name="date" type="date" required defaultValue={new Date().toISOString().split("T")[0]} />
              </div>
              <div>
                <Label htmlFor="mileage">Mileage</Label>
                <Input id="mileage" name="mileage" type="number" min="0" placeholder="50000" />
              </div>
            </div>
            <div>
              <Label htmlFor="notes">Notes</Label>
              <Textarea id="notes" name="notes" rows={2} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button type="submit" disabled={!selectedClientId || createRecord.isPending}>Add Record</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Confirm Delete */}
      <ConfirmDeleteDialog
        open={!!deleteId}
        onOpenChange={(open) => !open && setDeleteId(null)}
        onConfirm={() => { if (deleteId) deleteRecord.mutate({ id: deleteId }); setDeleteId(null); }}
        title="Delete Service Record?"
        description="This service record will be permanently removed."
      />
    </div>
  );
}
