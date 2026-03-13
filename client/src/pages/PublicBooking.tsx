import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { Wrench, Calendar, Clock, ChevronLeft, ChevronRight, Check, User, Mail, Phone, Car } from "lucide-react";

type Step = "service" | "date" | "time" | "info" | "confirmed";

export default function PublicBooking() {
  const [step, setStep] = useState<Step>("service");
  const [selectedService, setSelectedService] = useState("");
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedTime, setSelectedTime] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [vehicleYear, setVehicleYear] = useState("");
  const [vehicleMake, setVehicleMake] = useState("");
  const [vehicleModel, setVehicleModel] = useState("");
  const [notes, setNotes] = useState("");
  const [calendarMonth, setCalendarMonth] = useState(new Date());

  const { data: settings, isLoading: settingsLoading } = trpc.booking.settings.useQuery();
  const { data: slots, isLoading: slotsLoading } = trpc.booking.availableSlots.useQuery(
    { date: selectedDate },
    { enabled: !!selectedDate }
  );
  const createBooking = trpc.booking.create.useMutation({
    onSuccess: () => { setStep("confirmed"); toast.success("Booking confirmed!"); },
    onError: (err) => toast.error(err.message),
  });

  const availableServices: string[] = useMemo(() => {
    if (!settings?.availableServices) return [];
    try { return JSON.parse(settings.availableServices); } catch { return []; }
  }, [settings]);

  const availableDays: number[] = useMemo(() => {
    if (!settings?.availableDays) return [];
    try { return JSON.parse(settings.availableDays); } catch { return []; }
  }, [settings]);

  const maxDate = useMemo(() => {
    if (!settings?.maxAdvanceDays) return new Date(Date.now() + 30 * 86400000);
    const d = new Date();
    d.setDate(d.getDate() + settings.maxAdvanceDays);
    return d;
  }, [settings]);

  const handleSubmit = () => {
    if (!name || !email || !phone) { toast.error("Please fill in all required fields"); return; }
    createBooking.mutate({
      name, email, phone,
      service: selectedService,
      date: selectedDate,
      time: selectedTime,
      vehicleYear: vehicleYear || undefined,
      vehicleMake: vehicleMake || undefined,
      vehicleModel: vehicleModel || undefined,
      notes: notes || undefined,
    });
  };

  const formatTime = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    const ampm = h >= 12 ? "PM" : "AM";
    const h12 = h % 12 || 12;
    return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
  };

  // Generate calendar days for the current month
  const calendarDays = useMemo(() => {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const days: { date: Date | null; available: boolean; dateStr: string }[] = [];
    for (let i = 0; i < firstDay; i++) days.push({ date: null, available: false, dateStr: "" });
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(year, month, d);
      const dayOfWeek = date.getDay();
      const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const available = date >= today && date <= maxDate && availableDays.includes(dayOfWeek);
      days.push({ date, available, dateStr });
    }
    return days;
  }, [calendarMonth, availableDays, maxDate]);

  if (settingsLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Skeleton className="h-64 w-96" />
      </div>
    );
  }

  if (!settings?.isEnabled) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Toaster />
        <Card className="max-w-md w-full">
          <CardContent className="py-12 text-center">
            <Wrench className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-xl font-bold mb-2">Online Booking Unavailable</h2>
            <p className="text-muted-foreground">Online booking is currently not available. Please call us to schedule an appointment.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Toaster />
      {/* Header */}
      <div className="border-b border-border bg-card/60">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center">
            <Wrench className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <p className="font-bold text-lg">{settings.businessName || "GoatMez Auto Shop"}</p>
            <p className="text-xs text-muted-foreground">Book an Appointment</p>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Steps indicator */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {["Service", "Date", "Time", "Details"].map((s, i) => {
            const stepKeys: Step[] = ["service", "date", "time", "info"];
            const isActive = stepKeys.indexOf(step as Step) >= i || step === "confirmed";
            return (
              <div key={s} className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${isActive ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                  {step === "confirmed" ? <Check className="w-4 h-4" /> : i + 1}
                </div>
                <span className={`text-sm hidden sm:block ${isActive ? "text-foreground" : "text-muted-foreground"}`}>{s}</span>
                {i < 3 && <div className={`w-8 h-0.5 ${isActive ? "bg-primary" : "bg-muted"}`} />}
              </div>
            );
          })}
        </div>

        {/* Step: Service */}
        {step === "service" && (
          <Card>
            <CardHeader><CardTitle>Select a Service</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {availableServices.map((s) => (
                  <Button
                    key={s}
                    variant={selectedService === s ? "default" : "outline"}
                    className="justify-start h-auto py-3"
                    onClick={() => { setSelectedService(s); setStep("date"); }}
                  >
                    <Wrench className="w-4 h-4 mr-2 shrink-0" />
                    {s}
                  </Button>
                ))}
              </div>
              {availableServices.length === 0 && (
                <p className="text-muted-foreground text-center py-8">No services configured for online booking.</p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Step: Date */}
        {step === "date" && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2"><Calendar className="w-5 h-5" /> Select a Date</CardTitle>
                <Button variant="ghost" size="sm" onClick={() => setStep("service")}><ChevronLeft className="w-4 h-4 mr-1" /> Back</Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between mb-4">
                <Button variant="outline" size="icon" onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1))}>
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <span className="font-medium">{calendarMonth.toLocaleDateString("en-US", { month: "long", year: "numeric" })}</span>
                <Button variant="outline" size="icon" onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1))}>
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
              <div className="grid grid-cols-7 gap-1 text-center mb-2">
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                  <div key={d} className="text-xs font-medium text-muted-foreground py-2">{d}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {calendarDays.map((day, i) => (
                  <div key={i}>
                    {day.date ? (
                      <Button
                        variant={selectedDate === day.dateStr ? "default" : "ghost"}
                        disabled={!day.available}
                        className="w-full h-10"
                        onClick={() => { setSelectedDate(day.dateStr); setSelectedTime(""); setStep("time"); }}
                      >
                        {day.date.getDate()}
                      </Button>
                    ) : <div className="h-10" />}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step: Time */}
        {step === "time" && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2"><Clock className="w-5 h-5" /> Select a Time</CardTitle>
                <Button variant="ghost" size="sm" onClick={() => setStep("date")}><ChevronLeft className="w-4 h-4 mr-1" /> Back</Button>
              </div>
              <p className="text-sm text-muted-foreground">{new Date(selectedDate + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}</p>
            </CardHeader>
            <CardContent>
              {slotsLoading ? (
                <div className="grid grid-cols-3 gap-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
              ) : slots && slots.length > 0 ? (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {slots.map((t) => (
                    <Button
                      key={t}
                      variant={selectedTime === t ? "default" : "outline"}
                      onClick={() => { setSelectedTime(t); setStep("info"); }}
                    >
                      {formatTime(t)}
                    </Button>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-8">No available time slots for this date. Please try another date.</p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Step: Contact Info */}
        {step === "info" && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Your Details</CardTitle>
                <Button variant="ghost" size="sm" onClick={() => setStep("time")}><ChevronLeft className="w-4 h-4 mr-1" /> Back</Button>
              </div>
              <div className="text-sm text-muted-foreground space-y-1">
                <p><strong>Service:</strong> {selectedService}</p>
                <p><strong>Date:</strong> {new Date(selectedDate + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}</p>
                <p><strong>Time:</strong> {formatTime(selectedTime)}</p>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="bname" className="flex items-center gap-1"><User className="w-3 h-3" /> Full Name *</Label>
                <Input id="bname" value={name} onChange={(e) => setName(e.target.value)} placeholder="John Doe" required />
              </div>
              <div>
                <Label htmlFor="bemail" className="flex items-center gap-1"><Mail className="w-3 h-3" /> Email *</Label>
                <Input id="bemail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="john@example.com" required />
              </div>
              <div>
                <Label htmlFor="bphone" className="flex items-center gap-1"><Phone className="w-3 h-3" /> Phone *</Label>
                <Input id="bphone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(555) 123-4567" required />
              </div>

              <div className="border-t border-border pt-4">
                <p className="text-sm font-medium mb-3 flex items-center gap-1"><Car className="w-4 h-4" /> Vehicle Info (optional)</p>
                <div className="grid grid-cols-3 gap-3">
                  <div><Label htmlFor="vyear">Year</Label><Input id="vyear" value={vehicleYear} onChange={(e) => setVehicleYear(e.target.value)} placeholder="2024" /></div>
                  <div><Label htmlFor="vmake">Make</Label><Input id="vmake" value={vehicleMake} onChange={(e) => setVehicleMake(e.target.value)} placeholder="Toyota" /></div>
                  <div><Label htmlFor="vmodel">Model</Label><Input id="vmodel" value={vehicleModel} onChange={(e) => setVehicleModel(e.target.value)} placeholder="Camry" /></div>
                </div>
              </div>

              <div>
                <Label htmlFor="bnotes">Notes</Label>
                <Textarea id="bnotes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Any additional details..." />
              </div>

              <Button className="w-full" onClick={handleSubmit} disabled={!name || !email || !phone || createBooking.isPending}>
                {createBooking.isPending ? "Booking..." : "Confirm Booking"}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Confirmed */}
        {step === "confirmed" && (
          <Card>
            <CardContent className="py-12 text-center">
              <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto mb-4">
                <Check className="w-8 h-8 text-emerald-500" />
              </div>
              <h2 className="text-2xl font-bold mb-2">Booking Confirmed!</h2>
              <p className="text-muted-foreground mb-6">A confirmation email has been sent to <strong>{email}</strong></p>
              <div className="bg-muted/50 rounded-lg p-4 inline-block text-left space-y-1">
                <p><strong>Service:</strong> {selectedService}</p>
                <p><strong>Date:</strong> {new Date(selectedDate + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}</p>
                <p><strong>Time:</strong> {formatTime(selectedTime)}</p>
                <p><strong>Duration:</strong> {settings?.slotDurationMinutes || 60} minutes</p>
              </div>
              <p className="text-sm text-muted-foreground mt-6">Please arrive a few minutes early. If you need to reschedule, please contact us.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
