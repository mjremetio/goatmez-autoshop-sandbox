import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, Car, Calendar, DollarSign, FileText, Calculator, Plus, ArrowRight, Wrench, Package, AlertCircle } from "lucide-react";
import { statusColors, invoiceStatusColors } from "@/lib/constants";
import { useLocation } from "wouter";
import { Bar, BarChart, XAxis, YAxis, ResponsiveContainer, Tooltip as RechartsTooltip, PieChart, Pie, Cell } from "recharts";

function StatCard({ title, value, icon: Icon, color, href }: { title: string; value: string | number; icon: any; color: string; href?: string }) {
  const [, navigate] = useLocation();
  return (
    <Card className={href ? "cursor-pointer hover:bg-muted/30 transition-colors" : ""} onClick={() => href && navigate(href)}>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold mt-1">{value}</p>
          </div>
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${color}`}>
            <Icon className="w-5 h-5 text-white" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function Dashboard() {
  const [, navigate] = useLocation();
  const { data, isLoading } = trpc.dashboard.get.useQuery();
  const { data: chartData } = trpc.dashboard.revenueChart.useQuery();

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  const stats = data?.stats;

  const formattedChartData = chartData?.map((d) => {
    const [y, m] = d.month.split("-");
    const monthLabel = new Date(Number(y), Number(m) - 1).toLocaleString("default", { month: "short" });
    return { name: monthLabel, revenue: d.revenue };
  }) || [];

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">Overview of your auto shop operations</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button size="sm" onClick={() => navigate("/clients")}>
            <Plus className="w-3.5 h-3.5 mr-1" /> Client
          </Button>
          <Button size="sm" variant="outline" onClick={() => navigate("/invoices")}>
            <Plus className="w-3.5 h-3.5 mr-1" /> Invoice
          </Button>
          <Button size="sm" variant="outline" onClick={() => navigate("/appointments")}>
            <Plus className="w-3.5 h-3.5 mr-1" /> Appointment
          </Button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Clients" value={stats?.totalClients ?? 0} icon={Users} color="bg-teal-600" href="/clients" />
        <StatCard title="Total Vehicles" value={stats?.totalVehicles ?? 0} icon={Car} color="bg-cyan-700" href="/clients" />
        <StatCard title="Today's Appointments" value={stats?.todaysAppointments ?? 0} icon={Calendar} color="bg-teal-500" href="/appointments" />
        <StatCard
          title="Total Revenue"
          value={`$${(stats?.totalRevenue ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}`}
          icon={DollarSign}
          color="bg-emerald-600"
          href="/invoices"
        />
        <StatCard
          title="Labor Revenue"
          value={`$${(stats?.laborRevenue ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}`}
          icon={Wrench}
          color="bg-blue-600"
          href="/invoices"
        />
        <StatCard
          title="Parts Revenue"
          value={`$${(stats?.partsRevenue ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}`}
          icon={Package}
          color="bg-indigo-600"
          href="/invoices"
        />
        <StatCard
          title="Outstanding Balance"
          value={`$${(stats?.outstandingBalance ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}`}
          icon={AlertCircle}
          color="bg-amber-600"
          href="/invoices"
        />
        <StatCard title="Pending Estimates" value={stats?.pendingEstimateCount ?? 0} icon={Calculator} color="bg-slate-600" href="/estimates" />
      </div>

      {/* Revenue Chart */}
      {formattedChartData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-primary" />
              Monthly Revenue
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={formattedChartData}>
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `$${v.toLocaleString()}`} />
                <RechartsTooltip
                  formatter={(value: number) => [`$${value.toLocaleString("en-US", { minimumFractionDigits: 2 })}`, "Revenue"]}
                  contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }}
                  labelStyle={{ color: "hsl(var(--foreground))" }}
                />
                <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Labor vs Parts Breakdown */}
      {(stats?.laborRevenue || stats?.partsRevenue) ? (() => {
        const pieData = [
          { name: "Labor", value: stats?.laborRevenue ?? 0, color: "#2563eb" },
          { name: "Parts", value: stats?.partsRevenue ?? 0, color: "#6366f1" },
        ].filter(d => d.value > 0);
        const total = pieData.reduce((s, d) => s + d.value, 0);
        return (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Wrench className="w-4 h-4 text-primary" />
                Revenue Breakdown (Labor vs Parts)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-8">
                <ResponsiveContainer width={160} height={160}>
                  <PieChart>
                    <Pie data={pieData} dataKey="value" cx="50%" cy="50%" innerRadius={40} outerRadius={70} paddingAngle={2}>
                      {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                    </Pie>
                    <RechartsTooltip formatter={(value: number, name: string) => [`$${value.toLocaleString("en-US", { minimumFractionDigits: 2 })}`, name]} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-2">
                  {pieData.map((d) => (
                    <div key={d.name} className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: d.color }} />
                      <span className="text-sm">{d.name}: <strong>${d.value.toLocaleString("en-US", { minimumFractionDigits: 2 })}</strong></span>
                      <span className="text-xs text-muted-foreground">({total > 0 ? ((d.value / total) * 100).toFixed(0) : 0}%)</span>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })() : null}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Today's Schedule */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="w-4 h-4 text-primary" />
              Today's Schedule
              <Button variant="ghost" size="sm" className="ml-auto h-7 text-xs" onClick={() => navigate("/appointments")}>
                View All <ArrowRight className="w-3 h-3 ml-1" />
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data?.todaysSchedule && data.todaysSchedule.length > 0 ? (
              <div className="space-y-3">
                {data.todaysSchedule.map((appt: any) => (
                  <div key={appt.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <div>
                      <p className="text-sm font-medium">{appt.client?.name}</p>
                      <p className="text-xs text-muted-foreground">{appt.service}</p>
                      <p className="text-xs text-muted-foreground">
                        {appt.vehicle ? `${appt.vehicle.year} ${appt.vehicle.make} ${appt.vehicle.model}` : "No vehicle"}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-mono">{appt.time}</p>
                      <Badge variant="secondary" className={`text-[10px] text-white ${statusColors[appt.status] || "bg-zinc-500"}`}>
                        {appt.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">No appointments scheduled for today</p>
            )}
          </CardContent>
        </Card>

        {/* Pending Invoices */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="w-4 h-4 text-primary" />
              Pending Invoices
              <Button variant="ghost" size="sm" className="ml-auto h-7 text-xs" onClick={() => navigate("/invoices")}>
                View All <ArrowRight className="w-3 h-3 ml-1" />
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data?.pendingInvoices && data.pendingInvoices.length > 0 ? (
              <div className="space-y-3">
                {data.pendingInvoices.map((inv: any) => (
                  <div key={inv.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <div>
                      <p className="text-sm font-medium">INV-{inv.number}</p>
                      <p className="text-xs text-muted-foreground">{inv.client?.name}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold">${parseFloat(inv.total).toFixed(2)}</p>
                      <Badge variant="secondary" className={`text-[10px] text-white ${statusColors[inv.status] || "bg-zinc-500"}`}>
                        {inv.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">No pending invoices</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      {data?.recentActivity && data.recentActivity.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="w-4 h-4 text-primary" />
              Recent Invoices
              <Button variant="ghost" size="sm" className="ml-auto h-7 text-xs" onClick={() => navigate("/invoices")}>
                View All <ArrowRight className="w-3 h-3 ml-1" />
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {data.recentActivity.map((inv: any) => (
                <div key={inv.id} className="flex items-center justify-between p-2.5 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-3">
                    <div>
                      <p className="text-sm font-medium">INV-{inv.number}</p>
                      <p className="text-xs text-muted-foreground">{inv.client?.name}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge className={`text-[10px] text-white ${invoiceStatusColors[inv.status] || "bg-zinc-500"}`}>{inv.status}</Badge>
                    <p className="text-sm font-bold">${parseFloat(inv.total).toFixed(2)}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
