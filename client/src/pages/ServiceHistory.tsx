import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Plus, Search, History, Trash2, DollarSign, Wrench, ArrowUpDown, Gauge, ChevronLeft, ChevronRight, Pencil, Clock, Package } from "lucide-react";
import { serviceCatalogByCategory } from "@/lib/constants";
import { ClientVehicleSelect } from "@/components/ClientVehicleSelect";
import { ConfirmDeleteDialog } from "@/components/ConfirmDeleteDialog";

export default function ServiceHistoryPage() {
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingRecord, setEditingRecord] = useState<any>(null);
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

  // Work detail fields
  const [laborDescription, setLaborDescription] = useState("");
  const [laborHours, setLaborHours] = useState("");
  const [laborRate, setLaborRate] = useState("");
  const [partsDescription, setPartsDescription] = useState("");
  const [partsCost, setPartsCost] = useState("");

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
    onSuccess: () => { utils.serviceHistory.invalidate(); resetForm(); toast.success("Service record added"); },
    onError: (err) => toast.error(err.message),
  });
  const updateRecord = trpc.serviceHistory.update.useMutation({
    onSuccess: () => { utils.serviceHistory.invalidate(); resetForm(); toast.success("Service record updated"); },
    onError: (err) => toast.error(err.message),
  });
  const deleteRecord = trpc.serviceHistory.delete.useMutation({
    onSuccess: () => { utils.serviceHistory.invalidate(); toast.success("Record deleted"); },
    onError: (err) => toast.error(err.message),
  });

  const resetForm = () => {
    setShowForm(false);
    setEditingRecord(null);
    setSelectedClientId("");
    setSelectedVehicleId("");
    setServiceType("");
    setLaborDescription("");
    setLaborHours("");
    setLaborRate("");
    setPartsDescription("");
    setPartsCost("");
  };

  const openEditForm = (rec: any) => {
    setEditingRecord(rec);
    setSelectedClientId(String(rec.clientId));
    setSelectedVehicleId(rec.vehicleId ? String(rec.vehicleId) : "");
    setServiceType(rec.service || "");
    setLaborDescription(rec.laborDescription || "");
    setLaborHours(rec.laborHours ? String(parseFloat(rec.laborHours)) : "");
    setLaborRate(rec.laborRate ? String(parseFloat(rec.laborRate)) : "");
    setPartsDescription(rec.partsDescription || "");
    setPartsCost(rec.partsCost ? String(parseFloat(rec.partsCost)) : "");
    setShowForm(true);
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const mileageStr = fd.get("mileage") as string;
    const baseData = {
      service: (serviceType && serviceType !== "__custom__") ? serviceType : (fd.get("service") as string),
      cost: parseFloat(fd.get("cost") as string) || 0,
      date: fd.get("date") as string,
      mileage: mileageStr ? parseInt(mileageStr) : null,
      notes: fd.get("notes") as string,
      laborDescription: laborDescription || undefined,
      laborHours: laborRate ? 1 : null,
      laborRate: laborRate ? parseFloat(laborRate) : null,
      partsDescription: partsDescription || undefined,
      partsCost: partsCost ? parseFloat(partsCost) : null,
    };

    if (editingRecord) {
      updateRecord.mutate({
        id: editingRecord.id,
        vehicleId: selectedVehicleId ? Number(selectedVehicleId) : null,
        ...baseData,
      });
    } else {
      createRecord.mutate({
        clientId: Number(selectedClientId),
        vehicleId: selectedVehicleId ? Number(selectedVehicleId) : null,
        ...baseData,
      });
    }
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
        <Button onClick={() => { resetForm(); setShowForm(true); }}>
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
                  <div className="flex-1">
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

                    {/* Work Details */}
                    {(rec.laborDescription || rec.laborRate || rec.partsDescription || rec.partsCost) && (
                      <div className="mt-2 pt-2 border-t border-border space-y-1">
                        {(rec.laborDescription || rec.laborRate) && (
                          <div className="flex items-start gap-1.5 text-xs text-muted-foreground">
                            <Clock className="w-3 h-3 mt-0.5 shrink-0" />
                            <div>
                              <span className="font-medium text-foreground">Labor:</span>{" "}
                              {rec.laborDescription && <span>{rec.laborDescription}</span>}
                              {rec.laborRate && <span className="ml-1">(${parseFloat(rec.laborRate).toFixed(2)})</span>}
                            </div>
                          </div>
                        )}
                        {(rec.partsDescription || rec.partsCost) && (
                          <div className="flex items-start gap-1.5 text-xs text-muted-foreground">
                            <Package className="w-3 h-3 mt-0.5 shrink-0" />
                            <div>
                              <span className="font-medium text-foreground">Parts:</span>{" "}
                              {rec.partsDescription && <span>{rec.partsDescription}</span>}
                              {rec.partsCost && <span className="ml-1">(${parseFloat(rec.partsCost).toFixed(2)})</span>}
                            </div>
                          </div>
                        )}
                      </div>
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
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="w-7 h-7" onClick={() => openEditForm(rec)}>
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="w-7 h-7 text-destructive" onClick={() => setDeleteId(rec.id)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
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

      {/* Add/Edit Service Record Dialog */}
      <Dialog open={showForm} onOpenChange={(open) => { if (!open) resetForm(); }}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingRecord ? "Edit Service Record" : "Add Service Record"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            {!editingRecord && (
              <ClientVehicleSelect
                clientId={selectedClientId}
                vehicleId={selectedVehicleId}
                onClientChange={setSelectedClientId}
                onVehicleChange={setSelectedVehicleId}
              />
            )}
            {editingRecord && (
              <div className="text-sm text-muted-foreground">
                <p><strong>Client:</strong> {editingRecord.client?.name}</p>
                {editingRecord.vehicle && <p><strong>Vehicle:</strong> {editingRecord.vehicle.year} {editingRecord.vehicle.make} {editingRecord.vehicle.model}</p>}
              </div>
            )}
            <div>
              <Label>Service Type *</Label>
              <Select value={serviceType} onValueChange={setServiceType}>
                <SelectTrigger><SelectValue placeholder="Select service..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__custom__">Custom Service</SelectItem>
                  <SelectGroup>
                    <SelectLabel>Diagnostics</SelectLabel>
                    {serviceCatalogByCategory.diagnostic.map((s) => <SelectItem key={s.name} value={s.name}>{s.name}</SelectItem>)}
                  </SelectGroup>
                  <SelectGroup>
                    <SelectLabel>Module Programming</SelectLabel>
                    {serviceCatalogByCategory["module-programming"].map((s) => <SelectItem key={s.name} value={s.name}>{s.name}</SelectItem>)}
                  </SelectGroup>
                  <SelectGroup>
                    <SelectLabel>Electrical Repair</SelectLabel>
                    {serviceCatalogByCategory["electrical-repair"].map((s) => <SelectItem key={s.name} value={s.name}>{s.name}</SelectItem>)}
                  </SelectGroup>
                  <SelectGroup>
                    <SelectLabel>Installation</SelectLabel>
                    {serviceCatalogByCategory.installation.map((s) => <SelectItem key={s.name} value={s.name}>{s.name}</SelectItem>)}
                  </SelectGroup>
                </SelectContent>
              </Select>
              {(!serviceType || serviceType === "__custom__") && (
                <Input name="service" className="mt-2" placeholder="Or type a custom service..." required={!serviceType || serviceType === "__custom__"} />
              )}
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label htmlFor="cost">Total Cost *</Label>
                <Input id="cost" name="cost" type="number" step="0.01" min="0" required placeholder="0.00" defaultValue={editingRecord ? parseFloat(editingRecord.cost).toFixed(2) : ""} />
              </div>
              <div>
                <Label htmlFor="date">Date *</Label>
                <Input id="date" name="date" type="date" required defaultValue={editingRecord ? (typeof editingRecord.date === 'string' ? editingRecord.date.split('T')[0] : new Date(editingRecord.date).toISOString().split('T')[0]) : new Date().toISOString().split("T")[0]} />
              </div>
              <div>
                <Label htmlFor="mileage">Mileage</Label>
                <Input id="mileage" name="mileage" type="number" min="0" placeholder="50000" defaultValue={editingRecord?.mileage || ""} />
              </div>
            </div>

            {/* Work Details Section */}
            <div className="border border-border rounded-lg p-3 space-y-3">
              <p className="text-sm font-medium flex items-center gap-1.5">
                <Clock className="w-4 h-4" /> Labor Details
              </p>
              <div>
                <Label htmlFor="laborDesc" className="text-xs">Description</Label>
                <Input id="laborDesc" placeholder="e.g. ECU programming, wiring repair..." value={laborDescription} onChange={(e) => setLaborDescription(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="laborRate" className="text-xs">Labor Amount ($)</Label>
                <Input id="laborRate" type="number" step="0.01" min="0" placeholder="0.00" value={laborRate} onChange={(e) => setLaborRate(e.target.value)} />
              </div>
            </div>

            <div className="border border-border rounded-lg p-3 space-y-3">
              <p className="text-sm font-medium flex items-center gap-1.5">
                <Package className="w-4 h-4" /> Parts Details
              </p>
              <div>
                <Label htmlFor="partsDesc" className="text-xs">Description</Label>
                <Input id="partsDesc" placeholder="e.g. Spark plugs, brake pads..." value={partsDescription} onChange={(e) => setPartsDescription(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="partsCostInput" className="text-xs">Parts Cost ($)</Label>
                <Input id="partsCostInput" type="number" step="0.01" min="0" placeholder="0.00" value={partsCost} onChange={(e) => setPartsCost(e.target.value)} />
              </div>
            </div>

            <div>
              <Label htmlFor="notes">Notes</Label>
              <Textarea id="notes" name="notes" rows={2} defaultValue={editingRecord?.notes || ""} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={resetForm}>Cancel</Button>
              <Button type="submit" disabled={(!editingRecord && !selectedClientId) || createRecord.isPending || updateRecord.isPending}>
                {editingRecord ? "Update Record" : "Add Record"}
              </Button>
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
