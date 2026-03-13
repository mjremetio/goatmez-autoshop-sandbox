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
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { toast } from "sonner";
import { Plus, ChevronLeft, ChevronRight, AlertTriangle, Mail } from "lucide-react";
import { appointmentStatusColors } from "@/lib/constants";
import { ClientVehicleSelect } from "@/components/ClientVehicleSelect";
import { ConfirmDeleteDialog } from "@/components/ConfirmDeleteDialog";
import { SendEmailDialog } from "@/components/SendEmailDialog";

const apptStatuses = ["scheduled", "confirmed", "completed", "cancelled"];

function getMonthDays(year: number, month: number) {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const days: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) days.push(null);
  for (let i = 1; i <= daysInMonth; i++) days.push(i);
  return days;
}

function timeToMinutes(time: string) {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

export default function Appointments() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [showForm, setShowForm] = useState(false);
  const [editingAppt, setEditingAppt] = useState<any>(null);
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>("");
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [conflictWarning, setConflictWarning] = useState<string | null>(null);
  const [emailTarget, setEmailTarget] = useState<{ id: number; clientName: string; clientEmail: string } | null>(null);

  const from = `${year}-${String(month + 1).padStart(2, "0")}-01`;
  const to = `${year}-${String(month + 1).padStart(2, "0")}-${new Date(year, month + 1, 0).getDate()}`;

  const utils = trpc.useUtils();
  const { data: appointmentsRaw, isLoading } = trpc.appointments.list.useQuery({ from, to });
  const appointments = Array.isArray(appointmentsRaw) ? appointmentsRaw : (appointmentsRaw as any)?.items || [];
  const { data: clientsData } = trpc.clients.list.useQuery();
  const clients = clientsData?.items;
  const createAppt = trpc.appointments.create.useMutation({
    onSuccess: () => { utils.appointments.invalidate(); utils.dashboard.invalidate(); setShowForm(false); toast.success("Appointment created"); },
    onError: (err) => toast.error(err.message),
  });
  const updateAppt = trpc.appointments.update.useMutation({
    onSuccess: () => { utils.appointments.invalidate(); utils.dashboard.invalidate(); setEditingAppt(null); setShowForm(false); toast.success("Appointment updated"); },
    onError: (err) => toast.error(err.message),
  });
  const deleteAppt = trpc.appointments.delete.useMutation({
    onSuccess: () => { utils.appointments.invalidate(); utils.dashboard.invalidate(); toast.success("Appointment deleted"); },
    onError: (err) => toast.error(err.message),
  });
  const sendApptEmail = trpc.email.sendAppointmentConfirmation.useMutation({
    onSuccess: () => { setEmailTarget(null); toast.success("Confirmation email sent"); },
    onError: (err) => toast.error(err.message),
  });

  const prevMonth = () => { if (month === 0) { setMonth(11); setYear(year - 1); } else setMonth(month - 1); };
  const nextMonth = () => { if (month === 11) { setMonth(0); setYear(year + 1); } else setMonth(month + 1); };

  const days = getMonthDays(year, month);
  const monthName = new Date(year, month).toLocaleString("default", { month: "long", year: "numeric" });

  const apptsByDate = useMemo(() => {
    const map: Record<string, any[]> = {};
    appointments?.forEach((a: any) => {
      const d = a.date;
      if (!map[d]) map[d] = [];
      map[d].push(a);
    });
    return map;
  }, [appointments]);

  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

  const checkConflicts = (date: string, time: string, duration: number, excludeId?: number) => {
    const dayAppts = apptsByDate[date] || [];
    const newStart = timeToMinutes(time);
    const newEnd = newStart + duration;

    for (const a of dayAppts) {
      if (excludeId && a.id === excludeId) continue;
      if (a.status === "cancelled") continue;
      const existStart = timeToMinutes(a.time);
      const existEnd = existStart + (a.durationMinutes || 60);
      if (newStart < existEnd && newEnd > existStart) {
        return `Conflicts with ${a.service} (${a.time}, ${a.client?.name})`;
      }
    }
    return null;
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const date = fd.get("date") as string;
    const time = fd.get("time") as string;
    const duration = parseInt(fd.get("duration") as string) || 60;

    const conflict = checkConflicts(date, time, duration, editingAppt?.id);
    if (conflict && !conflictWarning) {
      setConflictWarning(conflict);
      return;
    }

    const data = {
      clientId: Number(selectedClientId),
      vehicleId: selectedVehicleId ? Number(selectedVehicleId) : null,
      service: fd.get("service") as string,
      date,
      time,
      durationMinutes: duration,
      status: ((fd.get("status") as string) || "scheduled") as "scheduled" | "confirmed" | "completed" | "cancelled",
      notes: fd.get("notes") as string,
    };
    if (editingAppt) {
      updateAppt.mutate({ id: editingAppt.id, ...data });
    } else {
      createAppt.mutate(data);
    }
    setConflictWarning(null);
  };

  const openNewForm = (dateStr?: string) => {
    setEditingAppt(null);
    setSelectedClientId("");
    setSelectedVehicleId("");
    setSelectedDate(dateStr || todayStr);
    setConflictWarning(null);
    setShowForm(true);
  };

  const openEditForm = (appt: any) => {
    setEditingAppt(appt);
    setSelectedClientId(String(appt.clientId));
    setSelectedVehicleId(appt.vehicleId ? String(appt.vehicleId) : "");
    setSelectedDate(appt.date);
    setConflictWarning(null);
    setShowForm(true);
  };

  const handleQuickStatus = (e: React.MouseEvent, apptId: number, status: "scheduled" | "confirmed" | "completed" | "cancelled") => {
    e.stopPropagation();
    updateAppt.mutate({ id: apptId, status });
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Appointments</h1>
          <p className="text-sm text-muted-foreground mt-1">Schedule and manage service appointments</p>
        </div>
        <Button onClick={() => openNewForm()}>
          <Plus className="w-4 h-4 mr-2" /> New Appointment
        </Button>
      </div>

      {/* Calendar Header */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="icon" onClick={prevMonth}><ChevronLeft className="w-4 h-4" /></Button>
        <h2 className="text-lg font-semibold">{monthName}</h2>
        <Button variant="ghost" size="icon" onClick={nextMonth}><ChevronRight className="w-4 h-4" /></Button>
      </div>

      {/* Calendar Grid */}
      {isLoading ? (
        <Skeleton className="h-96 rounded-xl" />
      ) : (
        <div className="border border-border rounded-xl overflow-hidden">
          <div className="grid grid-cols-7 bg-muted/50">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
              <div key={d} className="text-center text-xs font-semibold text-muted-foreground py-2 border-b border-border">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {days.map((day, idx) => {
              if (day === null) return <div key={idx} className="min-h-24 border-b border-r border-border bg-muted/20" />;
              const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
              const dayAppts = apptsByDate[dateStr] || [];
              const isToday = dateStr === todayStr;
              return (
                <div
                  key={idx}
                  className="min-h-24 border-b border-r border-border p-1 cursor-pointer hover:bg-muted/30 transition-colors"
                  onClick={() => openNewForm(dateStr)}
                >
                  <div className={`text-xs font-medium mb-1 w-6 h-6 flex items-center justify-center rounded-full ${isToday ? "bg-primary text-primary-foreground" : "text-foreground"}`}>
                    {day}
                  </div>
                  <div className="space-y-0.5">
                    {dayAppts.slice(0, 3).map((a: any) => (
                      <Tooltip key={a.id}>
                        <TooltipTrigger asChild>
                          <div
                            className={`text-[10px] px-1 py-0.5 rounded truncate text-white cursor-pointer ${appointmentStatusColors[a.status] || "bg-zinc-500"}`}
                            onClick={(e) => { e.stopPropagation(); openEditForm(a); }}
                          >
                            {a.time} {a.service}
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-xs">
                          <div className="space-y-1">
                            <p className="font-semibold">{a.service}</p>
                            <p className="text-xs">{a.client?.name}</p>
                            {a.vehicle && <p className="text-xs">{a.vehicle.year} {a.vehicle.make} {a.vehicle.model}</p>}
                            <p className="text-xs">{a.time} ({a.durationMinutes || 60} min)</p>
                            <Badge className={`text-[9px] text-white ${appointmentStatusColors[a.status]}`}>{a.status}</Badge>
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    ))}
                    {dayAppts.length > 3 && <div className="text-[10px] text-muted-foreground text-center">+{dayAppts.length - 3} more</div>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Appointment Form Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingAppt ? "Edit Appointment" : "New Appointment"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <ClientVehicleSelect
              clientId={selectedClientId}
              vehicleId={selectedVehicleId}
              onClientChange={setSelectedClientId}
              onVehicleChange={setSelectedVehicleId}
            />
            <div>
              <Label htmlFor="service">Service *</Label>
              <Input id="service" name="service" required defaultValue={editingAppt?.service || ""} placeholder="Oil Change, Brake Repair, etc." />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label htmlFor="date">Date *</Label>
                <Input id="date" name="date" type="date" required defaultValue={selectedDate} />
              </div>
              <div>
                <Label htmlFor="time">Time *</Label>
                <Input id="time" name="time" type="time" required defaultValue={editingAppt?.time || "09:00"} />
              </div>
              <div>
                <Label htmlFor="duration">Duration (min)</Label>
                <Input id="duration" name="duration" type="number" min="15" max="480" defaultValue={editingAppt?.durationMinutes || 60} />
              </div>
            </div>

            {/* Conflict Warning */}
            {conflictWarning && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-600">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <div>
                  <p className="text-sm font-medium">Scheduling Conflict</p>
                  <p className="text-xs">{conflictWarning}. Submit again to book anyway.</p>
                </div>
              </div>
            )}

            {editingAppt && (
              <div>
                <Label>Status</Label>
                <Select name="status" defaultValue={editingAppt.status}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {apptStatuses.map((s) => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <Label htmlFor="notes">Notes</Label>
              <Textarea id="notes" name="notes" rows={2} defaultValue={editingAppt?.notes || ""} />
            </div>
            <DialogFooter>
              {editingAppt && (
                <Button type="button" variant="destructive" className="mr-auto" onClick={() => { setDeleteId(editingAppt.id); setShowForm(false); }}>
                  Delete
                </Button>
              )}
              {editingAppt?.client?.email && (
                <Button type="button" variant="outline" onClick={() => { setEmailTarget({ id: editingAppt.id, clientName: editingAppt.client.name, clientEmail: editingAppt.client.email }); setShowForm(false); }}>
                  <Mail className="w-4 h-4 mr-2" /> Email
                </Button>
              )}
              <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button type="submit" disabled={!selectedClientId || createAppt.isPending || updateAppt.isPending}>
                {editingAppt ? "Update" : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Confirm Delete */}
      <ConfirmDeleteDialog
        open={!!deleteId}
        onOpenChange={(open) => !open && setDeleteId(null)}
        onConfirm={() => { if (deleteId) deleteAppt.mutate({ id: deleteId }); setDeleteId(null); }}
        title="Delete Appointment?"
        description="This appointment will be permanently removed from the schedule."
      />

      {/* Send Email Dialog */}
      <SendEmailDialog
        open={!!emailTarget}
        onOpenChange={(open) => !open && setEmailTarget(null)}
        onConfirm={() => { if (emailTarget) sendApptEmail.mutate({ appointmentId: emailTarget.id }); }}
        isPending={sendApptEmail.isPending}
        title="Email Confirmation"
        recipientName={emailTarget?.clientName || ""}
        recipientEmail={emailTarget?.clientEmail || ""}
        description="Send an appointment confirmation email to the client."
      />
    </div>
  );
}
