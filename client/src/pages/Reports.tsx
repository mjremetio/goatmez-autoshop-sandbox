import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BarChart3, Download, DollarSign, Users, Calendar, Wrench } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

type Tab = "revenue" | "appointments" | "clients" | "services";

function downloadCSV(filename: string, headers: string[], rows: string[][]) {
  const csv = [headers.join(","), ...rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function downloadPDF(title: string, headers: string[], rows: string[][], summary?: string[]) {
  const doc = new jsPDF();
  doc.setFontSize(18);
  doc.text(`GoatMez Auto Shop - ${title}`, 14, 22);
  doc.setFontSize(10);
  doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 30);

  if (summary && summary.length > 0) {
    let y = 38;
    doc.setFontSize(11);
    for (const line of summary) {
      doc.text(line, 14, y);
      y += 6;
    }
  }

  autoTable(doc, {
    head: [headers],
    body: rows,
    startY: summary ? 38 + summary.length * 6 + 4 : 38,
    styles: { fontSize: 9 },
    headStyles: { fillColor: [37, 99, 235] },
  });
  doc.save(`${title.toLowerCase().replace(/\s+/g, "-")}.pdf`);
}

export default function Reports() {
  const [tab, setTab] = useState<Tab>("revenue");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const tabs: { key: Tab; label: string; icon: any }[] = [
    { key: "revenue", label: "Revenue", icon: DollarSign },
    { key: "appointments", label: "Appointments", icon: Calendar },
    { key: "clients", label: "Clients", icon: Users },
    { key: "services", label: "Services", icon: Wrench },
  ];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><BarChart3 className="w-6 h-6" /> Reports</h1>
        <p className="text-sm text-muted-foreground mt-1">View business analytics and export data</p>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="flex gap-1">
          {tabs.map((t) => (
            <Button key={t.key} variant={tab === t.key ? "default" : "outline"} size="sm" onClick={() => setTab(t.key)}>
              <t.icon className="w-4 h-4 mr-1" /> {t.label}
            </Button>
          ))}
        </div>
        {tab !== "clients" && (
          <div className="flex gap-2 ml-auto">
            <div>
              <Label className="text-xs text-muted-foreground">From</Label>
              <Input type="date" className="w-36 h-9" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">To</Label>
              <Input type="date" className="w-36 h-9" value={toDate} onChange={(e) => setToDate(e.target.value)} />
            </div>
          </div>
        )}
      </div>

      {tab === "revenue" && <RevenueReport fromDate={fromDate} toDate={toDate} />}
      {tab === "appointments" && <AppointmentsReport fromDate={fromDate} toDate={toDate} />}
      {tab === "clients" && <ClientsReport />}
      {tab === "services" && <ServicesReport fromDate={fromDate} toDate={toDate} />}
    </div>
  );
}

function RevenueReport({ fromDate, toDate }: { fromDate: string; toDate: string }) {
  const { data, isLoading } = trpc.reports.revenue.useQuery({ fromDate: fromDate || undefined, toDate: toDate || undefined });

  if (isLoading) return <Skeleton className="h-64" />;
  if (!data) return null;

  const headers = ["Month", "Invoices Paid", "Revenue"];
  const rows = data.monthly.map(r => [r.month, String(r.count), `$${r.revenue.toFixed(2)}`]);
  const summary = [`Total Revenue: $${data.summary.totalRevenue.toFixed(2)}`, `Total Invoices: ${data.summary.totalInvoices}`, `Average Invoice: $${data.summary.avgInvoice.toFixed(2)}`];

  return (
    <>
      <div className="grid grid-cols-3 gap-4">
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Total Revenue</p><p className="text-2xl font-bold">${data.summary.totalRevenue.toFixed(2)}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Invoices Paid</p><p className="text-2xl font-bold">{data.summary.totalInvoices}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Avg Invoice</p><p className="text-2xl font-bold">${data.summary.avgInvoice.toFixed(2)}</p></CardContent></Card>
      </div>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-lg">Monthly Revenue</CardTitle>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => downloadCSV("revenue-report.csv", headers, rows.map(r => [r[0], r[1], r[2]]))}><Download className="w-3 h-3 mr-1" /> CSV</Button>
            <Button variant="outline" size="sm" onClick={() => downloadPDF("Revenue Report", headers, rows.map(r => [r[0], r[1], r[2]]), summary)}><Download className="w-3 h-3 mr-1" /> PDF</Button>
          </div>
        </CardHeader>
        <CardContent>
          {data.monthly.length > 0 ? (
            <Table>
              <TableHeader><TableRow><TableHead>Month</TableHead><TableHead>Invoices</TableHead><TableHead className="text-right">Revenue</TableHead></TableRow></TableHeader>
              <TableBody>
                {data.monthly.map((r) => (
                  <TableRow key={r.month}><TableCell>{r.month}</TableCell><TableCell>{r.count}</TableCell><TableCell className="text-right font-medium">${r.revenue.toFixed(2)}</TableCell></TableRow>
                ))}
              </TableBody>
            </Table>
          ) : <p className="text-sm text-muted-foreground text-center py-8">No revenue data for selected period</p>}
        </CardContent>
      </Card>
    </>
  );
}

function AppointmentsReport({ fromDate, toDate }: { fromDate: string; toDate: string }) {
  const { data, isLoading } = trpc.reports.appointments.useQuery({ fromDate: fromDate || undefined, toDate: toDate || undefined });

  if (isLoading) return <Skeleton className="h-64" />;
  if (!data) return null;

  const statusHeaders = ["Status", "Count"];
  const statusRows = data.statusBreakdown.map(r => [r.status, String(r.count)]);
  const serviceHeaders = ["Service", "Count"];
  const serviceRows = data.serviceBreakdown.map(r => [r.service, String(r.count)]);

  return (
    <>
      <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Total Appointments</p><p className="text-2xl font-bold">{data.total}</p></CardContent></Card>
      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-lg">By Status</CardTitle>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => downloadCSV("appointments-status.csv", statusHeaders, statusRows)}><Download className="w-3 h-3 mr-1" /> CSV</Button>
              <Button variant="outline" size="sm" onClick={() => downloadPDF("Appointments by Status", statusHeaders, statusRows, [`Total: ${data.total}`])}><Download className="w-3 h-3 mr-1" /> PDF</Button>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow><TableHead>Status</TableHead><TableHead className="text-right">Count</TableHead></TableRow></TableHeader>
              <TableBody>
                {data.statusBreakdown.map((r) => (
                  <TableRow key={r.status}><TableCell className="capitalize">{r.status}</TableCell><TableCell className="text-right">{r.count}</TableCell></TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-lg">Top Services</CardTitle>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => downloadCSV("appointments-services.csv", serviceHeaders, serviceRows)}><Download className="w-3 h-3 mr-1" /> CSV</Button>
              <Button variant="outline" size="sm" onClick={() => downloadPDF("Appointments by Service", serviceHeaders, serviceRows)}><Download className="w-3 h-3 mr-1" /> PDF</Button>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow><TableHead>Service</TableHead><TableHead className="text-right">Count</TableHead></TableRow></TableHeader>
              <TableBody>
                {data.serviceBreakdown.map((r) => (
                  <TableRow key={r.service}><TableCell>{r.service}</TableCell><TableCell className="text-right">{r.count}</TableCell></TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function ClientsReport() {
  const { data, isLoading } = trpc.reports.clients.useQuery();

  if (isLoading) return <Skeleton className="h-64" />;
  if (!data) return null;

  const headers = ["Name", "Email", "Phone", "Invoices", "Revenue", "Appointments"];
  const rows = data.map(r => [r.name, r.email, r.phone, String(r.invoiceCount), `$${r.totalRevenue.toFixed(2)}`, String(r.appointmentCount)]);
  const totalRevenue = data.reduce((sum, r) => sum + r.totalRevenue, 0);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-lg">Client Overview ({data.length} clients)</CardTitle>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => downloadCSV("clients-report.csv", headers, rows)}><Download className="w-3 h-3 mr-1" /> CSV</Button>
          <Button variant="outline" size="sm" onClick={() => downloadPDF("Client Report", headers, rows, [`Total Clients: ${data.length}`, `Total Revenue: $${totalRevenue.toFixed(2)}`])}><Download className="w-3 h-3 mr-1" /> PDF</Button>
        </div>
      </CardHeader>
      <CardContent>
        {data.length > 0 ? (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Email</TableHead><TableHead className="text-right">Invoices</TableHead><TableHead className="text-right">Revenue</TableHead><TableHead className="text-right">Appointments</TableHead></TableRow></TableHeader>
              <TableBody>
                {data.map((r) => (
                  <TableRow key={r.id}><TableCell className="font-medium">{r.name}</TableCell><TableCell className="text-muted-foreground">{r.email}</TableCell><TableCell className="text-right">{r.invoiceCount}</TableCell><TableCell className="text-right font-medium">${r.totalRevenue.toFixed(2)}</TableCell><TableCell className="text-right">{r.appointmentCount}</TableCell></TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : <p className="text-sm text-muted-foreground text-center py-8">No client data</p>}
      </CardContent>
    </Card>
  );
}

function ServicesReport({ fromDate, toDate }: { fromDate: string; toDate: string }) {
  const { data, isLoading } = trpc.reports.services.useQuery({ fromDate: fromDate || undefined, toDate: toDate || undefined });

  if (isLoading) return <Skeleton className="h-64" />;
  if (!data) return null;

  const headers = ["Service", "Count", "Total Cost", "Avg Cost"];
  const rows = data.byService.map(r => [r.service, String(r.count), `$${r.totalCost.toFixed(2)}`, `$${r.avgCost.toFixed(2)}`]);

  return (
    <>
      <div className="grid grid-cols-2 gap-4">
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Total Services</p><p className="text-2xl font-bold">{data.summary.totalRecords}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Total Cost</p><p className="text-2xl font-bold">${data.summary.totalCost.toFixed(2)}</p></CardContent></Card>
      </div>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-lg">Service Breakdown</CardTitle>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => downloadCSV("services-report.csv", headers, rows.map(r => [r[0], r[1], r[2], r[3]]))}><Download className="w-3 h-3 mr-1" /> CSV</Button>
            <Button variant="outline" size="sm" onClick={() => downloadPDF("Services Report", headers, rows.map(r => [r[0], r[1], r[2], r[3]]), [`Total Records: ${data.summary.totalRecords}`, `Total Cost: $${data.summary.totalCost.toFixed(2)}`])}><Download className="w-3 h-3 mr-1" /> PDF</Button>
          </div>
        </CardHeader>
        <CardContent>
          {data.byService.length > 0 ? (
            <Table>
              <TableHeader><TableRow><TableHead>Service</TableHead><TableHead className="text-right">Count</TableHead><TableHead className="text-right">Total Cost</TableHead><TableHead className="text-right">Avg Cost</TableHead></TableRow></TableHeader>
              <TableBody>
                {data.byService.map((r) => (
                  <TableRow key={r.service}><TableCell>{r.service}</TableCell><TableCell className="text-right">{r.count}</TableCell><TableCell className="text-right font-medium">${r.totalCost.toFixed(2)}</TableCell><TableCell className="text-right text-muted-foreground">${r.avgCost.toFixed(2)}</TableCell></TableRow>
                ))}
              </TableBody>
            </Table>
          ) : <p className="text-sm text-muted-foreground text-center py-8">No service data for selected period</p>}
        </CardContent>
      </Card>
    </>
  );
}
