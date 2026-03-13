import { trpc } from "@/lib/trpc";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface ClientVehicleSelectProps {
  clientId: string;
  vehicleId: string;
  onClientChange: (clientId: string) => void;
  onVehicleChange: (vehicleId: string) => void;
}

export function ClientVehicleSelect({ clientId, vehicleId, onClientChange, onVehicleChange }: ClientVehicleSelectProps) {
  const { data: clientsData } = trpc.clients.list.useQuery();
  const clients = clientsData?.items;
  const { data: clientVehicles } = trpc.vehicles.list.useQuery(
    { clientId: clientId ? Number(clientId) : undefined },
    { enabled: !!clientId }
  );

  return (
    <div className="grid grid-cols-2 gap-3">
      <div>
        <Label>Client *</Label>
        <Select value={clientId} onValueChange={(v) => { onClientChange(v); onVehicleChange(""); }}>
          <SelectTrigger><SelectValue placeholder="Select client" /></SelectTrigger>
          <SelectContent>
            {clients?.map((c: any) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label>Vehicle</Label>
        <Select value={vehicleId} onValueChange={onVehicleChange}>
          <SelectTrigger><SelectValue placeholder="Select vehicle" /></SelectTrigger>
          <SelectContent>
            {clientVehicles?.map((v: any) => <SelectItem key={v.id} value={String(v.id)}>{v.year} {v.make} {v.model}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
