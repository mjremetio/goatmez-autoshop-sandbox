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
import { Plus, Search, Pencil, Trash2, Car, Phone, Mail, User, Users, MapPin, Gauge, Loader2, ArrowUpDown, ChevronLeft, ChevronRight } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ConfirmDeleteDialog } from "@/components/ConfirmDeleteDialog";

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
                    <Button variant="ghost" size="icon" className="w-8 h-8" onClick={() => setExpandedClient(expandedClient === client.id ? null : client.id)}>
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

                {/* Vehicles */}
                {expandedClient === client.id && (
                  <div className="mt-3 pt-3 border-t border-border">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Vehicles</p>
                      <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => { setVehicleClientId(client.id); setEditingVehicle(null); setShowVehicleForm(true); }}>
                        <Plus className="w-3 h-3 mr-1" /> Add Vehicle
                      </Button>
                    </div>
                    {client.vehicles && client.vehicles.length > 0 ? (
                      <div className="space-y-2">
                        {client.vehicles.map((v: any) => (
                          <div key={v.id} className="flex items-center justify-between p-2 rounded-md bg-muted/50 text-sm">
                            <div className="flex items-center gap-2">
                              <span>{v.year} {v.make} {v.model} {v.color && <Badge variant="outline" className="ml-2 text-[10px]">{v.color}</Badge>}</span>
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
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground py-2">No vehicles registered</p>
                    )}
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
