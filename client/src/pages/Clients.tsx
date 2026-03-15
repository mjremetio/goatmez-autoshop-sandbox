import { useState, useRef } from "react";
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
import { Plus, Search, Pencil, Trash2, Car, Phone, Mail, User, Users, MapPin, Gauge, Loader2, ArrowUpDown, ChevronLeft, ChevronRight, FileText, Calendar, History, DollarSign, Calculator } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ConfirmDeleteDialog } from "@/components/ConfirmDeleteDialog";
import { invoiceStatusColors, estimateStatusColors, appointmentStatusColors } from "@/lib/constants";

const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","DC","FL","GA","HI","ID","IL","IN",
  "IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH",
  "NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT",
  "VT","VA","WA","WV","WI","WY",
];

export default function Clients() {
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingClient, setEditingClient] = useState<any>(null);
  const [showVehicleForm, setShowVehicleForm] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<any>(null);
  const [vehicleClientId, setVehicleClientId] = useState<number | null>(null);
  const [expandedClient, setExpandedClient] = useState<number | null>(null);
  const [clientTab, setClientTab] = useState<"vehicles" | "invoices" | "estimates" | "appointments" | "history">("vehicles");
  const [deleteTarget, setDeleteTarget] = useState<{ type: "client" | "vehicle"; id: number } | null>(null);
  const [plateState, setPlateState] = useState("CA");
  const vehicleFormRef = useRef<HTMLFormElement>(null);
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState("name");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const perPage = 20;

  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.clients.list.useQuery({ search: search || undefined, page, perPage, sortBy, sortOrder });
  const clients = data?.items;
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / perPage);

  const createClient = trpc.clients.create.useMutation({
    onSuccess: () => { utils.clients.invalidate(); setShowForm(false); toast.success("Client created"); },
    onError: (err) => toast.error(err.message),
  });
  const updateClient = trpc.clients.update.useMutation({
    onSuccess: () => { utils.clients.invalidate(); setEditingClient(null); setShowForm(false); toast.success("Client updated"); },
    onError: (err) => toast.error(err.message),
  });
  const deleteClient = trpc.clients.delete.useMutation({
    onSuccess: () => { utils.clients.invalidate(); toast.success("Client deleted"); },
    onError: (err) => toast.error(err.message),
  });
  const createVehicle = trpc.vehicles.create.useMutation({
    onSuccess: () => { utils.clients.invalidate(); setShowVehicleForm(false); setEditingVehicle(null); toast.success("Vehicle added"); },
    onError: (err) => toast.error(err.message),
  });
  const updateVehicle = trpc.vehicles.update.useMutation({
    onSuccess: () => { utils.clients.invalidate(); setShowVehicleForm(false); setEditingVehicle(null); toast.success("Vehicle updated"); },
    onError: (err) => toast.error(err.message),
  });
  const deleteVehicle = trpc.vehicles.delete.useMutation({
    onSuccess: () => { utils.clients.invalidate(); toast.success("Vehicle removed"); },
    onError: (err) => toast.error(err.message),
  });
  const lookupPlate = trpc.vehicles.lookupPlate.useMutation({
    onSuccess: (data) => {
      const form = vehicleFormRef.current;
      if (!form) return;
      const setField = (name: string, value: string) => {
        const el = form.elements.namedItem(name) as HTMLInputElement | null;
        if (el && value) {
          const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
          nativeSetter?.call(el, value);
          el.dispatchEvent(new Event("input", { bubbles: true }));
        }
      };
      setField("year", data.year);
      setField("make", data.make);
      setField("model", data.model);
      setField("vin", data.vin);
      setField("color", data.color);
      toast.success("Vehicle details found!");
    },
    onError: (err) => toast.error(err.message),
  });

  const handleSubmitClient = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const data = {
      name: fd.get("name") as string,
      phone: fd.get("phone") as string,
      email: fd.get("email") as string,
      address: fd.get("address") as string,
      city: fd.get("city") as string,
      state: fd.get("state") as string,
      zip: fd.get("zip") as string,
      notes: fd.get("notes") as string,
    };
    if (editingClient) {
      updateClient.mutate({ id: editingClient.id, ...data });
    } else {
      createClient.mutate(data);
    }
  };

  const handleSubmitVehicle = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const mileageStr = fd.get("mileage") as string;
    const vehicleData = {
      year: fd.get("year") as string,
      make: fd.get("make") as string,
      model: fd.get("model") as string,
      vin: fd.get("vin") as string,
      plate: fd.get("plate") as string,
      color: fd.get("color") as string,
      mileage: mileageStr ? parseInt(mileageStr) : null,
    };
    if (editingVehicle) {
      updateVehicle.mutate({ id: editingVehicle.id, ...vehicleData });
    } else {
      createVehicle.mutate({ clientId: vehicleClientId!, ...vehicleData });
    }
  };

  const formatPhone = (phone: string) => {
    const digits = phone.replace(/\D/g, "");
    if (digits.length === 10) return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
    return phone;
  };

  const toggleSort = (field: string) => {
    if (sortBy === field) setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    else { setSortBy(field); setSortOrder("asc"); }
    setPage(1);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Clients</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage your customers and their vehicles</p>
        </div>
        <Button onClick={() => { setEditingClient(null); setShowForm(true); }}>
          <Plus className="w-4 h-4 mr-2" /> Add Client
        </Button>
      </div>

      {/* Search + Sort */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search clients..." className="pl-9" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        </div>
        <div className="flex gap-1">
          <Button variant={sortBy === "name" ? "default" : "outline"} size="sm" className="h-9" onClick={() => toggleSort("name")}>
            Name <ArrowUpDown className="w-3 h-3 ml-1" />
          </Button>
          <Button variant={sortBy === "createdAt" ? "default" : "outline"} size="sm" className="h-9" onClick={() => toggleSort("createdAt")}>
            Date Added <ArrowUpDown className="w-3 h-3 ml-1" />
          </Button>
        </div>
        {total > 0 && <span className="text-xs text-muted-foreground whitespace-nowrap">{total} client(s)</span>}
      </div>

      {/* Client List */}
      {isLoading ? (
        <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}</div>
      ) : clients && clients.length > 0 ? (
        <div className="space-y-3">
          {clients.map((client: any) => (
            <Card key={client.id} className="overflow-hidden">
              <CardContent className="pt-4 pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                      <User className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-semibold">{client.name}</p>
                      <div className="flex flex-wrap gap-3 mt-1 text-xs text-muted-foreground">
                        {client.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{formatPhone(client.phone)}</span>}
                        {client.email && <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{client.email}</span>}
                        <span className="flex items-center gap-1"><Car className="w-3 h-3" />{client.vehicles?.length || 0} vehicle(s)</span>
                      </div>
                      {(client.city || client.state) && (
                        <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                          <MapPin className="w-3 h-3" />
                          {[client.city, client.state].filter(Boolean).join(", ")} {client.zip || ""}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" className="w-8 h-8" onClick={() => { setExpandedClient(expandedClient === client.id ? null : client.id); setClientTab("vehicles"); }}>
                      <Car className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="w-8 h-8" onClick={() => { setEditingClient(client); setShowForm(true); }}>
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="w-8 h-8 text-destructive" onClick={() => setDeleteTarget({ type: "client", id: client.id })}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                {/* Expanded Client Details */}
                {expandedClient === client.id && (
                  <div className="mt-3 pt-3 border-t border-border">
                    {/* Tab Bar */}
                    <div className="flex gap-1 mb-3 flex-wrap">
                      {([
                        { key: "vehicles", label: "Vehicles", icon: Car },
                        { key: "invoices", label: "Invoices", icon: FileText },
                        { key: "estimates", label: "Estimates", icon: Calculator },
                        { key: "appointments", label: "Appointments", icon: Calendar },
                        { key: "history", label: "History", icon: History },
                      ] as const).map((t) => (
                        <Button key={t.key} variant={clientTab === t.key ? "default" : "outline"} size="sm" className="h-7 text-xs" onClick={() => setClientTab(t.key)}>
                          <t.icon className="w-3 h-3 mr-1" /> {t.label}
                        </Button>
                      ))}
                    </div>

                    {/* Vehicles Tab */}
                    {clientTab === "vehicles" && (
                      <>
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Vehicles</p>
                          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => { setVehicleClientId(client.id); setEditingVehicle(null); setShowVehicleForm(true); }}>
                            <Plus className="w-3 h-3 mr-1" /> Add Vehicle
                          </Button>
                        </div>
                        {client.vehicles && client.vehicles.length > 0 ? (
                          <div className="space-y-3">
                            {client.vehicles.map((v: any) => (
                              <div key={v.id} className="border rounded-md p-3 bg-muted/30 space-y-2">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2 flex-1">
                                    <span className="font-medium text-sm">{v.year} {v.make} {v.model} {v.color && <Badge variant="outline" className="text-[10px]">{v.color}</Badge>}</span>
                                    {v.mileage && (
                                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                        <Gauge className="w-3 h-3" />{v.mileage.toLocaleString()} mi
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                    {v.plate && <span>Plate: {v.plate}</span>}
                                    <Button variant="ghost" size="icon" className="w-6 h-6" onClick={() => { setEditingVehicle(v); setVehicleClientId(client.id); setShowVehicleForm(true); }}>
                                      <Pencil className="w-3 h-3" />
                                    </Button>
                                    <Button variant="ghost" size="icon" className="w-6 h-6 text-destructive" onClick={() => setDeleteTarget({ type: "vehicle", id: v.id })}>
                                      <Trash2 className="w-3 h-3" />
                                    </Button>
                                  </div>
                                </div>
                                <VehicleEstimatesSection vehicleId={v.id} clientId={client.id} />
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground py-2">No vehicles registered</p>
                        )}
                      </>
                    )}

                    {/* Invoices Tab */}
                    {clientTab === "invoices" && <ClientInvoicesTab clientId={client.id} />}

                    {/* Estimates Tab */}
                    {clientTab === "estimates" && <ClientEstimatesTab clientId={client.id} />}

                    {/* Appointments Tab */}
                    {clientTab === "appointments" && <ClientAppointmentsTab clientId={client.id} />}

                    {/* Service History Tab */}
                    {clientTab === "history" && <ClientHistoryTab clientId={client.id} />}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <Users className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">No clients found</p>
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

      {/* Client Form Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingClient ? "Edit Client" : "Add Client"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmitClient} className="space-y-4">
            <div>
              <Label htmlFor="name">Name *</Label>
              <Input id="name" name="name" required defaultValue={editingClient?.name || ""} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="phone">Phone</Label>
                <Input id="phone" name="phone" defaultValue={editingClient?.phone || ""} />
              </div>
              <div>
                <Label htmlFor="email">Email</Label>
                <Input id="email" name="email" type="email" defaultValue={editingClient?.email || ""} />
              </div>
            </div>
            <div>
              <Label htmlFor="address">Address</Label>
              <Input id="address" name="address" defaultValue={editingClient?.address || ""} placeholder="Street address" />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label htmlFor="city">City</Label>
                <Input id="city" name="city" defaultValue={editingClient?.city || ""} />
              </div>
              <div>
                <Label htmlFor="state">State</Label>
                <Input id="state" name="state" defaultValue={editingClient?.state || ""} />
              </div>
              <div>
                <Label htmlFor="zip">ZIP</Label>
                <Input id="zip" name="zip" defaultValue={editingClient?.zip || ""} />
              </div>
            </div>
            <div>
              <Label htmlFor="notes">Notes</Label>
              <Textarea id="notes" name="notes" rows={3} defaultValue={editingClient?.notes || ""} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button type="submit" disabled={createClient.isPending || updateClient.isPending}>
                {editingClient ? "Update" : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Vehicle Form Dialog */}
      <Dialog open={showVehicleForm} onOpenChange={(open) => { setShowVehicleForm(open); if (!open) setEditingVehicle(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingVehicle ? "Edit Vehicle" : "Add Vehicle"}</DialogTitle>
          </DialogHeader>
          <form ref={vehicleFormRef} onSubmit={handleSubmitVehicle} className="space-y-4">
            {!editingVehicle && (
              <div>
                <Label className="mb-1.5 block">Plate Lookup</Label>
                <div className="flex items-center gap-2">
                  <Select value={plateState} onValueChange={setPlateState}>
                    <SelectTrigger className="w-[80px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {US_STATES.map((s) => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input id="plate" name="plate" placeholder="ABC-1234" className="flex-1" defaultValue={editingVehicle?.plate || ""} />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={lookupPlate.isPending}
                    onClick={() => {
                      const plate = vehicleFormRef.current?.elements.namedItem("plate") as HTMLInputElement | null;
                      if (!plate?.value) { toast.error("Enter a plate number first"); return; }
                      lookupPlate.mutate({ plate: plate.value, state: plateState });
                    }}
                  >
                    {lookupPlate.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Lookup"}
                  </Button>
                </div>
              </div>
            )}
            {editingVehicle && (
              <div>
                <Label htmlFor="plate">Plate</Label>
                <Input id="plate" name="plate" placeholder="ABC-1234" defaultValue={editingVehicle?.plate || ""} />
              </div>
            )}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label htmlFor="year">Year</Label>
                <Input id="year" name="year" placeholder="2024" defaultValue={editingVehicle?.year || ""} />
              </div>
              <div>
                <Label htmlFor="make">Make *</Label>
                <Input id="make" name="make" required placeholder="Toyota" defaultValue={editingVehicle?.make || ""} />
              </div>
              <div>
                <Label htmlFor="model">Model *</Label>
                <Input id="model" name="model" required placeholder="Camry" defaultValue={editingVehicle?.model || ""} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="color">Color</Label>
                <Input id="color" name="color" placeholder="Silver" defaultValue={editingVehicle?.color || ""} />
              </div>
              <div>
                <Label htmlFor="mileage">Mileage</Label>
                <Input id="mileage" name="mileage" type="number" min="0" placeholder="50000" defaultValue={editingVehicle?.mileage || ""} />
              </div>
            </div>
            <div>
              <Label htmlFor="vin">VIN</Label>
              <Input id="vin" name="vin" placeholder="17 characters" maxLength={17} defaultValue={editingVehicle?.vin || ""} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => { setShowVehicleForm(false); setEditingVehicle(null); }}>Cancel</Button>
              <Button type="submit" disabled={createVehicle.isPending || updateVehicle.isPending}>
                {editingVehicle ? "Update Vehicle" : "Add Vehicle"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Confirm Delete Dialog */}
      <ConfirmDeleteDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget?.type === "client") deleteClient.mutate({ id: deleteTarget.id });
          else if (deleteTarget?.type === "vehicle") deleteVehicle.mutate({ id: deleteTarget.id });
          setDeleteTarget(null);
        }}
        title={deleteTarget?.type === "client" ? "Delete Client?" : "Remove Vehicle?"}
        description={deleteTarget?.type === "client" ? "This will also remove all associated vehicles. This action cannot be undone." : "This vehicle will be permanently removed."}
      />
    </div>
  );
}

// ─── Client Detail Tab Components ─────────────────────────────────

function ClientInvoicesTab({ clientId }: { clientId: number }) {
  const { data, isLoading } = trpc.invoices.list.useQuery({ clientId, perPage: 10 });
  const invoices = data?.items || [];
  const paidTotal = invoices.filter((i: any) => i.status === "paid").reduce((s: number, i: any) => s + parseFloat(i.total || "0"), 0);

  if (isLoading) return <div className="space-y-2">{[1,2].map(i => <Skeleton key={i} className="h-10 rounded" />)}</div>;

  return (
    <div className="space-y-2">
      {paidTotal > 0 && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2">
          <DollarSign className="w-3 h-3" />
          <span>Lifetime Value: <strong className="text-foreground">${paidTotal.toFixed(2)}</strong></span>
        </div>
      )}
      {invoices.length > 0 ? invoices.map((inv: any) => (
        <div key={inv.id} className="flex items-center justify-between p-2 rounded-md bg-muted/50 text-sm">
          <div>
            <span className="font-medium">INV-{inv.number}</span>
            <Badge className={`ml-2 text-[9px] text-white ${invoiceStatusColors[inv.status]}`}>{inv.status}</Badge>
          </div>
          <span className="font-medium">${parseFloat(inv.total).toFixed(2)}</span>
        </div>
      )) : <p className="text-xs text-muted-foreground py-2">No invoices</p>}
    </div>
  );
}

function ClientEstimatesTab({ clientId }: { clientId: number }) {
  const [editingEstimate, setEditingEstimate] = useState<any>(null);
  const [showEditForm, setShowEditForm] = useState(false);
  const { data, isLoading } = trpc.estimates.list.useQuery({ clientId, perPage: 10 });
  const estimates = data?.items || [];
  const updateEstimate = trpc.estimates.update.useMutation({
    onSuccess: () => { setEditingEstimate(null); setShowEditForm(false); toast.success("Estimate updated"); },
    onError: (err) => toast.error(err.message),
  });

  if (isLoading) return <div className="space-y-2">{[1,2].map(i => <Skeleton key={i} className="h-10 rounded" />)}</div>;

  const handleEditEstimate = (est: any) => {
    setEditingEstimate(est);
    setShowEditForm(true);
  };

  const handleSaveEstimate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingEstimate) return;
    const fd = new FormData(e.currentTarget);
    const items = [];
    let i = 0;
    while (fd.get(`items.${i}.type`)) {
      items.push({
        type: fd.get(`items.${i}.type`) as string,
        description: fd.get(`items.${i}.description`) as string,
        amount: fd.get(`items.${i}.amount`) ? parseFloat(fd.get(`items.${i}.amount`) as string) : undefined,
        quantity: fd.get(`items.${i}.quantity`) ? parseInt(fd.get(`items.${i}.quantity`) as string) : undefined,
        unitPrice: fd.get(`items.${i}.unitPrice`) ? parseFloat(fd.get(`items.${i}.unitPrice`) as string) : undefined,
      });
      i++;
    }
    updateEstimate.mutate({
      id: editingEstimate.id,
      clientId: editingEstimate.clientId,
      vehicleId: editingEstimate.vehicleId,
      notes: fd.get("notes") as string,
      validUntil: fd.get("validUntil") as string,
      items: items as any,
    });
  };

  return (
    <div className="space-y-2">
      {estimates.length > 0 ? estimates.map((est: any) => (
        <div key={est.id} className="flex items-center justify-between p-2 rounded-md bg-muted/50 text-sm">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="font-medium">EST-{est.number}</span>
              <Badge className={`text-[9px] text-white ${estimateStatusColors[est.status]}`}>{est.status}</Badge>
            </div>
            {est.notes && <p className="text-xs text-muted-foreground mt-1">{est.notes}</p>}
          </div>
          <div className="flex items-center gap-2">
            <span className="font-medium">${parseFloat(est.total).toFixed(2)}</span>
            {est.status !== "converted" && (
              <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => handleEditEstimate(est)}>
                <Pencil className="w-3 h-3" />
              </Button>
            )}
          </div>
        </div>
      )) : <p className="text-xs text-muted-foreground py-2">No estimates</p>}

      <Dialog open={showEditForm} onOpenChange={setShowEditForm}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Estimate EST-{editingEstimate?.number}</DialogTitle>
          </DialogHeader>
          {editingEstimate && (
            <form onSubmit={handleSaveEstimate} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea id="notes" name="notes" placeholder="Additional details" defaultValue={editingEstimate.notes || ""} className="h-16" />
                </div>
                <div>
                  <Label htmlFor="validUntil">Valid Until</Label>
                  <Input id="validUntil" name="validUntil" type="date" defaultValue={editingEstimate.validUntil || ""} />
                </div>
              </div>
              <div>
                <Label className="text-sm font-semibold mb-2 block">Line Items</Label>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {editingEstimate.items?.map((item: any, idx: number) => (
                    <div key={idx} className="p-2 border rounded-md bg-muted/30 space-y-1">
                      <input type="hidden" name={`items.${idx}.type`} value={item.type} />
                      <div className="text-xs font-medium text-muted-foreground uppercase">{item.type}</div>
                      <Input name={`items.${idx}.description`} placeholder="Description" defaultValue={item.description} className="h-8" />
                      {item.type === "labor" && (
                        <Input name={`items.${idx}.amount`} type="number" step="0.01" placeholder="Amount" defaultValue={item.amount} className="h-8" />
                      )}
                      {item.type === "parts" && (
                        <div className="grid grid-cols-2 gap-2">
                          <Input name={`items.${idx}.quantity`} type="number" placeholder="Qty" defaultValue={item.quantity} className="h-8" />
                          <Input name={`items.${idx}.unitPrice`} type="number" step="0.01" placeholder="Unit Price" defaultValue={item.unitPrice} className="h-8" />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setShowEditForm(false)}>Cancel</Button>
                <Button type="submit" disabled={updateEstimate.isPending}>
                  {updateEstimate.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Save Changes
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ClientAppointmentsTab({ clientId }: { clientId: number }) {
  const { data, isLoading } = trpc.appointments.list.useQuery({ clientId, perPage: 10 });
  const appointments = Array.isArray(data) ? data : (data as any)?.items || [];

  if (isLoading) return <div className="space-y-2">{[1,2].map(i => <Skeleton key={i} className="h-10 rounded" />)}</div>;

  return (
    <div className="space-y-2">
      {appointments.length > 0 ? appointments.map((appt: any) => (
        <div key={appt.id} className="flex items-center justify-between p-2 rounded-md bg-muted/50 text-sm">
          <div>
            <span className="font-medium">{appt.service}</span>
            <Badge className={`ml-2 text-[9px] text-white ${appointmentStatusColors[appt.status]}`}>{appt.status}</Badge>
          </div>
          <span className="text-xs text-muted-foreground">{appt.date} {appt.time}</span>
        </div>
      )) : <p className="text-xs text-muted-foreground py-2">No appointments</p>}
    </div>
  );
}

function ClientHistoryTab({ clientId }: { clientId: number }) {
  const { data, isLoading } = trpc.serviceHistory.list.useQuery({ clientId, perPage: 10 });
  const records = data?.items || [];

  if (isLoading) return <div className="space-y-2">{[1,2].map(i => <Skeleton key={i} className="h-10 rounded" />)}</div>;

  return (
    <div className="space-y-2">
      {records.length > 0 ? records.map((rec: any) => (
        <div key={rec.id} className="flex items-center justify-between p-2 rounded-md bg-muted/50 text-sm">
          <div>
            <span className="font-medium">{rec.service}</span>
            <span className="text-xs text-muted-foreground ml-2">
              {new Date(rec.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
            </span>
          </div>
          <span className="font-medium">${parseFloat(rec.cost).toFixed(2)}</span>
        </div>
      )) : <p className="text-xs text-muted-foreground py-2">No service records</p>}
    </div>
  );
}


// ─── Vehicle Estimates Section ───────────────────────────────────

function VehicleEstimatesSection({ vehicleId, clientId }: { vehicleId: number; clientId: number }) {
  const [editingEstimate, setEditingEstimate] = useState<any>(null);
  const [showEditForm, setShowEditForm] = useState(false);
  const { data, isLoading } = trpc.estimates.list.useQuery({ clientId, perPage: 100 });
  // Filter estimates for this specific vehicle
  const allEstimates = data?.items || [];
  const estimates = allEstimates.filter((est: any) => est.vehicleId === vehicleId);
  const updateEstimate = trpc.estimates.update.useMutation({
    onSuccess: () => { 
      setEditingEstimate(null); 
      setShowEditForm(false); 
      toast.success("Estimate updated"); 
    },
    onError: (err) => toast.error(err.message),
  });

  if (isLoading) return <div className="space-y-1">{[1].map(i => <Skeleton key={i} className="h-8 rounded" />)}</div>;

  const handleEditEstimate = (est: any) => {
    setEditingEstimate(est);
    setShowEditForm(true);
  };

  const handleSaveEstimate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingEstimate) return;
    const fd = new FormData(e.currentTarget);
    const items = [];
    let i = 0;
    while (fd.get(`items.${i}.type`)) {
      items.push({
        type: fd.get(`items.${i}.type`) as string,
        description: fd.get(`items.${i}.description`) as string,
        amount: fd.get(`items.${i}.amount`) ? parseFloat(fd.get(`items.${i}.amount`) as string) : undefined,
        quantity: fd.get(`items.${i}.quantity`) ? parseInt(fd.get(`items.${i}.quantity`) as string) : undefined,
        unitPrice: fd.get(`items.${i}.unitPrice`) ? parseFloat(fd.get(`items.${i}.unitPrice`) as string) : undefined,
      });
      i++;
    }
    updateEstimate.mutate({
      id: editingEstimate.id,
      clientId: editingEstimate.clientId,
      vehicleId: editingEstimate.vehicleId,
      notes: fd.get("notes") as string,
      validUntil: fd.get("validUntil") as string,
      items: items as any,
    });
  };

  if (estimates.length === 0) return <p className="text-xs text-muted-foreground">No estimates for this vehicle</p>;

  return (
    <div className="space-y-1">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Estimates</p>
      {estimates.map((est: any) => (
        <div key={est.id} className="flex items-center justify-between p-2 rounded bg-background/50 text-xs border border-muted">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="font-medium">EST-{est.number}</span>
              <Badge className={`text-[8px] text-white ${estimateStatusColors[est.status]}`}>{est.status}</Badge>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-medium">${parseFloat(est.total).toFixed(2)}</span>
            {est.status !== "converted" && (
              <Button size="sm" variant="ghost" className="h-5 w-5 p-0" onClick={() => handleEditEstimate(est)}>
                <Pencil className="w-2.5 h-2.5" />
              </Button>
            )}
          </div>
        </div>
      ))}

      <Dialog open={showEditForm} onOpenChange={setShowEditForm}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Estimate EST-{editingEstimate?.number}</DialogTitle>
          </DialogHeader>
          {editingEstimate && (
            <form onSubmit={handleSaveEstimate} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea id="notes" name="notes" placeholder="Additional details" defaultValue={editingEstimate.notes || ""} className="h-16" />
                </div>
                <div>
                  <Label htmlFor="validUntil">Valid Until</Label>
                  <Input id="validUntil" name="validUntil" type="date" defaultValue={editingEstimate.validUntil || ""} />
                </div>
              </div>
              <div>
                <Label className="text-sm font-semibold mb-2 block">Line Items</Label>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {editingEstimate.items?.map((item: any, idx: number) => (
                    <div key={idx} className="p-2 border rounded-md bg-muted/30 space-y-1">
                      <input type="hidden" name={`items.${idx}.type`} value={item.type} />
                      <div className="text-xs font-medium text-muted-foreground uppercase">{item.type}</div>
                      <Input name={`items.${idx}.description`} placeholder="Description" defaultValue={item.description} className="h-8" />
                      {item.type === "labor" && (
                        <Input name={`items.${idx}.amount`} type="number" step="0.01" placeholder="Amount" defaultValue={item.amount} className="h-8" />
                      )}
                      {item.type === "parts" && (
                        <div className="grid grid-cols-2 gap-2">
                          <Input name={`items.${idx}.quantity`} type="number" placeholder="Qty" defaultValue={item.quantity} className="h-8" />
                          <Input name={`items.${idx}.unitPrice`} type="number" step="0.01" placeholder="Unit Price" defaultValue={item.unitPrice} className="h-8" />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setShowEditForm(false)}>Cancel</Button>
                <Button type="submit" disabled={updateEstimate.isPending}>
                  {updateEstimate.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Save Changes
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
