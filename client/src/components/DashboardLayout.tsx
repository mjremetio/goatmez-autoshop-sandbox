/**
 * DashboardLayout — Sidebar navigation for the AutoShop CRM
 */
import { ReactNode, useState } from "react";
import { Link, useLocation } from "wouter";
import {
  LayoutDashboard,
  Users,
  FileText,
  Calculator,
  Calendar,
  CalendarCheck,
  History,
  BarChart3,
  Wrench,
  ChevronLeft,
  ChevronRight,
  Menu,
  Settings,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/_core/hooks/useAuth";

const navItems = [
  { path: "/", label: "Dashboard", icon: LayoutDashboard },
  { path: "/clients", label: "Clients", icon: Users },
  { path: "/invoices", label: "Invoices", icon: FileText },
  { path: "/estimates", label: "Estimates", icon: Calculator },
  { path: "/appointments", label: "Appointments", icon: Calendar },
  { path: "/bookings", label: "Bookings", icon: CalendarCheck },
  { path: "/service-history", label: "Service History", icon: History },
  { path: "/reports", label: "Reports", icon: BarChart3 },
  { path: "/settings", label: "Settings", icon: Settings },
];


export default function DashboardLayout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { logout, loading, isAuthenticated } = useAuth({ redirectOnUnauthenticated: true, redirectPath: "/login" });

  if (loading || !isAuthenticated) {
    return null;
  }

  const handleLogout = async () => {
    await logout();
    window.location.href = "/login";
  };

  return (
    <div className="h-screen flex overflow-hidden bg-background">
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed lg:static inset-y-0 left-0 z-50 flex flex-col border-r border-sidebar-border bg-sidebar transition-all duration-200",
          collapsed ? "w-16" : "w-56",
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        {/* Logo */}
        <div className="h-14 flex items-center gap-2.5 px-3 border-b border-sidebar-border shrink-0">
          <div className="w-8 h-8 rounded-lg bg-sidebar-primary flex items-center justify-center shrink-0">
            <Wrench className="w-4 h-4 text-sidebar-primary-foreground" />
          </div>
          {!collapsed && (
            <div className="overflow-hidden">
              <p className="text-sm font-bold text-sidebar-accent-foreground truncate">GoatMez</p>
              <p className="text-[10px] text-sidebar-foreground truncate">AutoShop CRM</p>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = location === item.path || (item.path !== "/" && location.startsWith(item.path));
            const linkClass = cn(
              "flex items-center gap-2.5 px-2.5 py-2 rounded-md text-sm font-medium transition-colors",
              isActive
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
            );
            return (
              <Link
                key={item.path}
                href={item.path}
                onClick={() => setMobileOpen(false)}
                className={linkClass}
              >
                <item.icon className={cn("w-4 h-4 shrink-0", isActive && "text-sidebar-primary")} />
                {!collapsed && <span className="truncate">{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Logout + Collapse toggle */}
        <div className="border-t border-sidebar-border">
          <div className="px-2 py-2">
            <button
              onClick={handleLogout}
              className={cn(
                "flex items-center gap-2.5 px-2.5 py-2 rounded-md text-sm font-medium transition-colors w-full",
                "text-sidebar-foreground hover:bg-destructive/10 hover:text-destructive"
              )}
            >
              <LogOut className="w-4 h-4 shrink-0" />
              {!collapsed && <span className="truncate">Logout</span>}
            </button>
          </div>
          <div className="hidden lg:flex items-center justify-center py-2 border-t border-sidebar-border">
            <Button
              variant="ghost"
              size="icon"
              className="w-7 h-7 text-sidebar-foreground hover:text-sidebar-accent-foreground"
              onClick={() => setCollapsed(!collapsed)}
            >
              {collapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
            </Button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile header */}
        <header className="h-14 lg:hidden flex items-center gap-3 px-4 border-b border-border bg-card/60 shrink-0">
          <Button
            variant="ghost"
            size="icon"
            className="w-8 h-8"
            onClick={() => setMobileOpen(true)}
          >
            <Menu className="w-4 h-4" />
          </Button>
          <div className="flex items-center gap-2">
            <Wrench className="w-4 h-4 text-primary" />
            <span className="text-sm font-bold">GoatMez AutoShop</span>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
