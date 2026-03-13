import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import {
  CalendarCheck, Search, Clock, ArrowUpDown, ChevronLeft, ChevronRight,
  ArrowRight, Mail, Trash2, Calendar, Settings, Plus, X, ExternalLink,
} from "lucide-react";
import { appointmentStatusColors } from "@/lib/constants";
import { ConfirmDeleteDialog } from "@/components/ConfirmDeleteDialog";
import { SendEmailDialog } from "@/components/SendEmailDialog";
import { Link } from "wouter";

const statusFilters = ["all", "scheduled", "confirmed", "completed", "cancelled"];
const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const DEFAULT_SERVICES = [
  "Electrical Diagnostic",
  "Module Programming",
];

export default function Bookings() {
  const [activeTab, setActiveTab] = useState<"bookings" | "settings">("bookings");
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState("date");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [emailTarget, setEmailTarget] = useState<{ id: number; clientName: string; clientEmail: string } | null>(null);
  const [newService, setNewService] = useState("");
  const perPage = 20;

  const utils = trpc.useUtils();

  // ── Bookings list ──────────────────────────────────────────────────
  const { data, isLoading } = trpc.appointments.list.useQuery({
    status: filter !== "all" ? filter as "scheduled" | "confirmed" | "completed" | "cancelled" : undefined,
    from: fromDate || undefined,
    to: toDate || undefined,
    search: search || undefined,
    page,
    perPage,
    sortBy,
    sortOrder,
  });

  const items = data && "items" in data ? data.items : [];
  const total = data && "total" in data ? data.total : 0;
  const totalPages = Math.ceil(total / perPage);

  const updateAppointment = trpc.appointments.update.useMutation({
    onSuccess: () => { utils.appointments.invalidate(); toast.success("Status updated"); },
    onError: (err) => toast.error(err.message),
  });
  const deleteAppointment = trpc.appointments.delete.useMutation({
    onSuccess: () => { utils.appointments.invalidate(); toast.success("Booking deleted"); },
    onError: (err) => toast.error(err.message),
  });
  const sendEmail = trpc.email.sendAppointmentConfirmation.useMutation({
    onSuccess: () => { setEmailTarget(null); toast.success("Confirmation email sent"); },
    onError: (err) => toast.error(err.message),
  });

  // ── Booking Settings ───────────────────────────────────────────────
  const { data: settings, isLoading: settingsLoading } = trpc.booking.settings.useQuery();
  const updateSettings = trpc.booking.updateSettings.useMutation({
    onSuccess: () => { utils.booking.settings.invalidate(); toast.success("Settings saved"); },
    onError: (err) => toast.error(err.message),
  });

  const parsedServices: string[] = (() => {
    if (!settings?.availableServices) return [];
    try { return JSON.parse(settings.availableServices); } catch { return []; }
  })();

  const parsedDays: number[] = (() => {
    if (!settings?.availableDays) return [1, 2, 3, 4, 5];
    try { return JSON.parse(settings.availableDays); } catch { return [1, 2, 3, 4, 5]; }
  })();

  const handleStatusChange = (id: number, currentStatus: string) => {
    const nextStatus: Record<string, string> = { scheduled: "confirmed", confirmed: "completed" };
    const next = nextStatus[currentStatus];
    if (next) updateAppointment.mutate({ id, status: next as any });
  };

  const toggleSort = (field: string) => {
    if (sortBy === field) setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    else { setSortBy(field); setSortOrder("desc"); }
    setPage(1);
  };

  const toggleDay = (day: number) => {
    const newDays = parsedDays.includes(day)
      ? parsedDays.filter((d) => d !== day)
      : [...parsedDays, day].sort();
    updateSettings.mutate({ availableDays: JSON.stringify(newDays) });
  };

  const addService = (svc: string) => {
    const trimmed = svc.trim();
    if (!trimmed || parsedServices.includes(trimmed)) return;
    const newServices = [...parsedServices, trimmed];
    updateSettings.mutate({ availableServices: JSON.stringify(newServices) });
    setNewService("");
  };

  const removeService = (svc: string) => {
    const newServices = parsedServices.filter((s) => s !== svc);
    updateSettings.mutate({ availableServices: JSON.stringify(newServices) });
  };

  const loadDefaultServices = () => {
    updateSettings.mutate({ availableServices: JSON.stringify(DEFAULT_SERVICES) });
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <CalendarCheck className="w-6 h-6" /> Bookings
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Manage online appointment requests</p>
        </div>
        <div className="flex gap-2">
          <Link href="/appointments">
            <Button variant="outline"><Calendar className="w-4 h-4 mr-2" /> Calendar View</Button>
          </Link>
          <a href="/book" target="_blank" rel="noopener noreferrer">
            <Button variant="outline"><ExternalLink className="w-4 h-4 mr-2" /> Public Booking Page</Button>
          </a>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        <button
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === "bookings" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
          onClick={() => setActiveTab("bookings")}
        >
          Bookings List
        </button>
        <button
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 ${activeTab === "settings" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
          onClick={() => setActiveTab("settings")}
        >
          <Settings className="w-3.5 h-3.5" /> Booking Settings
        </button>
      </div>

      {/* ── Bookings List Tab ── */}
      {activeTab === "bookings" && (
        <>
          {/* Filters */}
          <div className="flex flex-wrap items-end gap-3">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by client or service..."
                className="pl-9"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              />
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
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {statusFilters.map((s) => (
              <Button key={s} variant={filter === s ? "default" : "outline"} size="sm" onClick={() => { setFilter(s); setPage(1); }} className="capitalize">{s}</Button>
            ))}
            <div className="ml-auto flex gap-1">
              {[{ key: "date", label: "Date" }, { key: "time", label: "Time" }, { key: "status", label: "Status" }].map((s) => (
                <Button key={s.key} variant={sortBy === s.key ? "default" : "outline"} size="sm" className="h-8 text-xs" onClick={() => toggleSort(s.key)}>
                  {s.label} <ArrowUpDown className="w-3 h-3 ml-1" />
                </Button>
              ))}
            </div>
          </div>

          {/* Booking List */}
          {isLoading ? (
            <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}</div>
          ) : items.length > 0 ? (
            <div className="space-y-3">
              {items.map((appt: any) => (
                <Card key={appt.id}>
                  <CardContent className="pt-4 pb-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-semibold">{appt.service}</p>
                          <Badge className={`text-[10px] text-white ${appointmentStatusColors[appt.status]}`}>{appt.status}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mt-0.5">{appt.client?.name}</p>
                        {appt.vehicle && <p className="text-xs text-muted-foreground">{appt.vehicle.year} {appt.vehicle.make} {appt.vehicle.model}</p>}
                        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                          <span>{new Date(appt.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                          <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{appt.time}</span>
                        </div>
                        {appt.notes && <p className="text-xs text-muted-foreground mt-1">{appt.notes}</p>}
                      </div>
                      <div className="flex gap-1 flex-wrap justify-end">
                        {appt.client?.email && (
                          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setEmailTarget({ id: appt.id, clientName: appt.client.name, clientEmail: appt.client.email })}>
                            <Mail className="w-3 h-3 mr-1" /> Email
                          </Button>
                        )}
                        {(appt.status === "scheduled" || appt.status === "confirmed") && (
                          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => handleStatusChange(appt.id, appt.status)}>
                            <ArrowRight className="w-3 h-3 mr-1" /> {appt.status === "scheduled" ? "Confirm" : "Complete"}
                          </Button>
                        )}
                        {appt.status !== "completed" && (
                          <Button variant="ghost" size="icon" className="w-7 h-7 text-destructive" onClick={() => setDeleteId(appt.id)}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="py-12 text-center">
                <CalendarCheck className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
                <p className="text-muted-foreground">No bookings found</p>
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
        </>
      )}

      {/* ── Settings Tab ── */}
      {activeTab === "settings" && (
        <>
          {settingsLoading ? (
            <div className="space-y-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}</div>
          ) : (
            <div className="space-y-6 max-w-2xl">
              {/* Enable / Disable */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Online Booking</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm">Enable public booking page</p>
                      <p className="text-xs text-muted-foreground">Allow customers to book appointments at <span className="font-mono">/book</span></p>
                    </div>
                    <Switch
                      checked={settings?.isEnabled ?? false}
                      onCheckedChange={(val) => updateSettings.mutate({ isEnabled: val })}
                      disabled={updateSettings.isPending}
                    />
                  </div>
                  <div>
                    <Label className="text-sm">Business Name</Label>
                    <Input
                      className="mt-1"
                      defaultValue={settings?.businessName ?? "GoatMez Auto Shop"}
                      onBlur={(e) => {
                        if (e.target.value !== settings?.businessName) {
                          updateSettings.mutate({ businessName: e.target.value });
                        }
                      }}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Business Hours */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Business Hours</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm">Opening Time</Label>
                      <Input
                        type="time"
                        className="mt-1"
                        defaultValue={settings?.businessHoursStart?.slice(0, 5) ?? "09:00"}
                        onBlur={(e) => {
                          if (e.target.value) updateSettings.mutate({ businessHoursStart: e.target.value });
                        }}
                      />
                    </div>
                    <div>
                      <Label className="text-sm">Closing Time</Label>
                      <Input
                        type="time"
                        className="mt-1"
                        defaultValue={settings?.businessHoursEnd?.slice(0, 5) ?? "17:00"}
                        onBlur={(e) => {
                          if (e.target.value) updateSettings.mutate({ businessHoursEnd: e.target.value });
                        }}
                      />
                    </div>
                  </div>
                  <div className="max-w-xs">
                    <Label className="text-sm">Max Advance Days</Label>
                    <Input
                      type="number"
                      className="mt-1"
                      min={1}
                      max={365}
                      defaultValue={settings?.maxAdvanceDays ?? 30}
                      onBlur={(e) => {
                        const val = parseInt(e.target.value);
                        if (!isNaN(val) && val > 0) updateSettings.mutate({ maxAdvanceDays: val });
                      }}
                    />
                  </div>
                  <div>
                    <Label className="text-sm mb-2 block">Available Days</Label>
                    <div className="flex gap-2 flex-wrap">
                      {DAY_NAMES.map((name, idx) => (
                        <button
                          key={idx}
                          onClick={() => toggleDay(idx)}
                          disabled={updateSettings.isPending}
                          className={`w-12 h-10 rounded-md text-sm font-medium border transition-colors ${parsedDays.includes(idx) ? "bg-primary text-primary-foreground border-primary" : "bg-background text-muted-foreground border-border hover:border-primary/50"}`}
                        >
                          {name}
                        </button>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Services */}
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">Available Services</CardTitle>
                    {parsedServices.length === 0 && (
                      <Button variant="outline" size="sm" onClick={loadDefaultServices} disabled={updateSettings.isPending}>
                        Load Defaults
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {parsedServices.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {parsedServices.map((svc) => (
                        <Badge key={svc} variant="secondary" className="text-sm py-1 px-3 flex items-center gap-1.5">
                          {svc}
                          <button
                            onClick={() => removeService(svc)}
                            disabled={updateSettings.isPending}
                            className="hover:text-destructive transition-colors"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No services configured. Add services below or click "Load Defaults".</p>
                  )}
                  <div className="flex gap-2 mt-2">
                    <Input
                      placeholder="Add a service (e.g. Oil Change)"
                      value={newService}
                      onChange={(e) => setNewService(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") addService(newService); }}
                      className="flex-1"
                    />
                    <Button
                      onClick={() => addService(newService)}
                      disabled={!newService.trim() || updateSettings.isPending}
                    >
                      <Plus className="w-4 h-4 mr-1" /> Add
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </>
      )}

      <ConfirmDeleteDialog
        open={!!deleteId}
        onOpenChange={(open) => !open && setDeleteId(null)}
        onConfirm={() => { if (deleteId) deleteAppointment.mutate({ id: deleteId }); setDeleteId(null); }}
        title="Delete Booking?"
        description="This booking will be permanently removed."
      />

      <SendEmailDialog
        open={!!emailTarget}
        onOpenChange={(open) => !open && setEmailTarget(null)}
        onConfirm={() => { if (emailTarget) sendEmail.mutate({ appointmentId: emailTarget.id }); }}
        isPending={sendEmail.isPending}
        title="Send Confirmation"
        recipientName={emailTarget?.clientName || ""}
        recipientEmail={emailTarget?.clientEmail || ""}
        description="Send appointment confirmation email to the client."
      />
    </div>
  );
}
