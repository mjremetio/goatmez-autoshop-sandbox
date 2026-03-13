import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  Plus,
  Shield,
  ShieldCheck,
  Trash2,
  KeyRound,
  UserCog,
  Pencil,
  Users,
  Globe,
  Copy,
  Check,
} from "lucide-react";
import { ConfirmDeleteDialog } from "@/components/ConfirmDeleteDialog";
import { commonServiceTypes } from "@/lib/constants";

export default function Settings() {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [passwordTarget, setPasswordTarget] = useState<{
    id: number;
    name: string;
  } | null>(null);
  const [editTarget, setEditTarget] = useState<any>(null);
  const [deleteTarget, setDeleteTarget] = useState<{
    id: number;
    name: string;
  } | null>(null);

  const utils = trpc.useUtils();
  const { data: users, isLoading } = trpc.users.list.useQuery();

  const createUser = trpc.users.create.useMutation({
    onSuccess: () => {
      utils.users.invalidate();
      setShowCreateForm(false);
      toast.success("User created");
    },
    onError: (err) => toast.error(err.message),
  });

  const updateRole = trpc.users.updateRole.useMutation({
    onSuccess: () => {
      utils.users.invalidate();
      toast.success("Role updated");
    },
    onError: (err) => toast.error(err.message),
  });

  const updatePassword = trpc.users.updatePassword.useMutation({
    onSuccess: () => {
      setPasswordTarget(null);
      toast.success("Password updated");
    },
    onError: (err) => toast.error(err.message),
  });

  const updateProfile = trpc.users.updateProfile.useMutation({
    onSuccess: () => {
      utils.users.invalidate();
      setEditTarget(null);
      toast.success("User updated");
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteUser = trpc.users.delete.useMutation({
    onSuccess: () => {
      utils.users.invalidate();
      toast.success("User deleted");
    },
    onError: (err) => toast.error(err.message),
  });

  const handleCreateSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const password = fd.get("password") as string;
    const confirmPassword = fd.get("confirmPassword") as string;
    if (password !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }
    createUser.mutate({
      username: fd.get("username") as string,
      password,
      name: fd.get("name") as string,
      email: fd.get("email") as string,
      role: (fd.get("role") as "user" | "admin") || "user",
    });
  };

  const handlePasswordSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const password = fd.get("password") as string;
    const confirmPassword = fd.get("confirmPassword") as string;
    if (password !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }
    if (passwordTarget) {
      updatePassword.mutate({ id: passwordTarget.id, password });
    }
  };

  const handleEditSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    if (editTarget) {
      updateProfile.mutate({
        id: editTarget.id,
        name: fd.get("name") as string,
        email: fd.get("email") as string,
      });
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <UserCog className="w-6 h-6" />
            Settings
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage user accounts and roles
          </p>
        </div>
        <Button onClick={() => setShowCreateForm(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Add User
        </Button>
      </div>

      {/* Users List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Users className="w-5 h-5" />
            User Accounts
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : !users?.length ? (
            <p className="text-muted-foreground text-sm text-center py-8">
              No users found.
            </p>
          ) : (
            <div className="space-y-2">
              {users.map((user) => (
                <div
                  key={user.id}
                  className="flex items-center justify-between p-3 rounded-lg border border-border bg-card hover:bg-accent/30 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      {user.role === "admin" ? (
                        <ShieldCheck className="w-4 h-4 text-primary" />
                      ) : (
                        <Shield className="w-4 h-4 text-muted-foreground" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm truncate">
                          {user.name || user.username}
                        </span>
                        <Badge
                          variant={
                            user.role === "admin" ? "default" : "secondary"
                          }
                          className="text-[10px] shrink-0"
                        >
                          {user.role}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span>@{user.username}</span>
                        {user.email && <span>{user.email}</span>}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <Select
                      value={user.role}
                      onValueChange={(val) =>
                        updateRole.mutate({
                          id: user.id,
                          role: val as "user" | "admin",
                        })
                      }
                    >
                      <SelectTrigger className="w-24 h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="user">User</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                      </SelectContent>
                    </Select>

                    <Button
                      variant="ghost"
                      size="icon"
                      className="w-8 h-8"
                      title="Edit profile"
                      onClick={() => setEditTarget(user)}
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>

                    <Button
                      variant="ghost"
                      size="icon"
                      className="w-8 h-8"
                      title="Change password"
                      onClick={() =>
                        setPasswordTarget({
                          id: user.id,
                          name: user.name || user.username || "",
                        })
                      }
                    >
                      <KeyRound className="w-3.5 h-3.5" />
                    </Button>

                    <Button
                      variant="ghost"
                      size="icon"
                      className="w-8 h-8 text-destructive hover:text-destructive"
                      title="Delete user"
                      onClick={() =>
                        setDeleteTarget({
                          id: user.id,
                          name: user.name || user.username || "",
                        })
                      }
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create User Dialog */}
      <Dialog open={showCreateForm} onOpenChange={setShowCreateForm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New User</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                name="username"
                required
                placeholder="Enter username"
                autoComplete="off"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">Display Name</Label>
              <Input
                id="name"
                name="name"
                placeholder="Enter display name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="Enter email (optional)"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="role">Role</Label>
              <select
                id="role"
                name="role"
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                defaultValue="user"
              >
                <option value="user">User</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                required
                minLength={6}
                placeholder="Min. 6 characters"
                autoComplete="new-password"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                required
                minLength={6}
                placeholder="Confirm password"
                autoComplete="new-password"
              />
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                type="button"
                onClick={() => setShowCreateForm(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={createUser.isPending}>
                {createUser.isPending ? "Creating..." : "Create User"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Change Password Dialog */}
      <Dialog
        open={!!passwordTarget}
        onOpenChange={() => setPasswordTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Change Password for {passwordTarget?.name}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="newPassword">New Password</Label>
              <Input
                id="newPassword"
                name="password"
                type="password"
                required
                minLength={6}
                placeholder="Min. 6 characters"
                autoComplete="new-password"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmNewPassword">Confirm New Password</Label>
              <Input
                id="confirmNewPassword"
                name="confirmPassword"
                type="password"
                required
                minLength={6}
                placeholder="Confirm new password"
                autoComplete="new-password"
              />
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                type="button"
                onClick={() => setPasswordTarget(null)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={updatePassword.isPending}>
                {updatePassword.isPending ? "Updating..." : "Update Password"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Profile Dialog */}
      <Dialog open={!!editTarget} onOpenChange={() => setEditTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEditSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="editName">Display Name</Label>
              <Input
                id="editName"
                name="name"
                defaultValue={editTarget?.name || ""}
                placeholder="Enter display name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="editEmail">Email</Label>
              <Input
                id="editEmail"
                name="email"
                type="email"
                defaultValue={editTarget?.email || ""}
                placeholder="Enter email"
              />
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                type="button"
                onClick={() => setEditTarget(null)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={updateProfile.isPending}>
                {updateProfile.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <ConfirmDeleteDialog
        open={!!deleteTarget}
        onOpenChange={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) deleteUser.mutate({ id: deleteTarget.id });
          setDeleteTarget(null);
        }}
        title="Delete User"
        description={`Are you sure you want to delete "${deleteTarget?.name}"? This action cannot be undone.`}
      />

      {/* Online Booking Settings */}
      <BookingSettingsSection />
    </div>
  );
}

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function BookingSettingsSection() {
  const utils = trpc.useUtils();
  const { data: settings, isLoading } = trpc.booking.settings.useQuery();
  const updateSettings = trpc.booking.updateSettings.useMutation({
    onSuccess: () => { utils.booking.invalidate(); toast.success("Booking settings updated"); },
    onError: (err) => toast.error(err.message),
  });
  const [copied, setCopied] = useState(false);

  const availableDays: number[] = useMemo(() => {
    if (!settings?.availableDays) return [1, 2, 3, 4, 5];
    try { return JSON.parse(settings.availableDays); } catch { return [1, 2, 3, 4, 5]; }
  }, [settings]);

  const availableServices: string[] = useMemo(() => {
    if (!settings?.availableServices) return [];
    try { return JSON.parse(settings.availableServices); } catch { return []; }
  }, [settings]);

  const bookingUrl = `${window.location.origin}/book`;

  const toggleDay = (day: number) => {
    const newDays = availableDays.includes(day) ? availableDays.filter(d => d !== day) : [...availableDays, day].sort();
    updateSettings.mutate({ availableDays: JSON.stringify(newDays) });
  };

  const toggleService = (service: string) => {
    const newServices = availableServices.includes(service) ? availableServices.filter(s => s !== service) : [...availableServices, service];
    updateSettings.mutate({ availableServices: JSON.stringify(newServices) });
  };

  const copyUrl = () => {
    navigator.clipboard.writeText(bookingUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (isLoading) return <Skeleton className="h-48" />;
  if (!settings) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Globe className="w-5 h-5" />
          Online Booking
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Enable/Disable */}
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium">Enable Online Booking</p>
            <p className="text-xs text-muted-foreground">Allow clients to book appointments via a public URL</p>
          </div>
          <Button
            variant={settings.isEnabled ? "default" : "outline"}
            size="sm"
            onClick={() => updateSettings.mutate({ isEnabled: !settings.isEnabled })}
          >
            {settings.isEnabled ? "Enabled" : "Disabled"}
          </Button>
        </div>

        {settings.isEnabled && (
          <>
            {/* Booking URL */}
            <div>
              <Label className="text-sm font-medium">Booking URL</Label>
              <div className="flex items-center gap-2 mt-1">
                <Input value={bookingUrl} readOnly className="text-sm bg-muted" />
                <Button variant="outline" size="icon" onClick={copyUrl}>
                  {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>
            </div>

            {/* Business Hours */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Opens At</Label>
                <Input type="time" value={settings.businessHoursStart} onChange={(e) => updateSettings.mutate({ businessHoursStart: e.target.value })} />
              </div>
              <div>
                <Label>Closes At</Label>
                <Input type="time" value={settings.businessHoursEnd} onChange={(e) => updateSettings.mutate({ businessHoursEnd: e.target.value })} />
              </div>
            </div>

            {/* Slot Duration */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Slot Duration</Label>
                <Select value={String(settings.slotDurationMinutes)} onValueChange={(v) => updateSettings.mutate({ slotDurationMinutes: Number(v) })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[15, 30, 45, 60, 90, 120].map((m) => (
                      <SelectItem key={m} value={String(m)}>{m} minutes</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Max Advance Days</Label>
                <Input type="number" min={1} max={365} value={settings.maxAdvanceDays} onChange={(e) => updateSettings.mutate({ maxAdvanceDays: Number(e.target.value) || 30 })} />
              </div>
            </div>

            {/* Available Days */}
            <div>
              <Label className="mb-2 block">Available Days</Label>
              <div className="flex flex-wrap gap-2">
                {DAYS.map((day, i) => (
                  <Button
                    key={day}
                    variant={availableDays.includes(i) ? "default" : "outline"}
                    size="sm"
                    onClick={() => toggleDay(i)}
                  >
                    {day.slice(0, 3)}
                  </Button>
                ))}
              </div>
            </div>

            {/* Available Services */}
            <div>
              <Label className="mb-2 block">Available Services</Label>
              <div className="flex flex-wrap gap-2">
                {commonServiceTypes.map((service) => (
                  <Button
                    key={service}
                    variant={availableServices.includes(service) ? "default" : "outline"}
                    size="sm"
                    className="text-xs"
                    onClick={() => toggleService(service)}
                  >
                    {service}
                  </Button>
                ))}
              </div>
              {availableServices.length === 0 && (
                <p className="text-xs text-muted-foreground mt-2">Select at least one service to enable booking</p>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
