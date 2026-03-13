import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";

export interface LineItem {
  type: "labor" | "parts";
  description: string;
  hourlyRate: number;
  hours: number;
  quantity: number;
  unitPrice: number;
}

export const emptyLineItem: LineItem = { type: "labor", description: "", hourlyRate: 0, hours: 0, quantity: 1, unitPrice: 0 };

export function computeLineTotal(item: LineItem) {
  return item.type === "labor" ? (item.hourlyRate || 0) * (item.hours || 0) : (item.quantity || 1) * (item.unitPrice || 0);
}

interface LineItemFormProps {
  items: LineItem[];
  onUpdate: (idx: number, field: string, value: any) => void;
  onAdd: () => void;
  onRemove: (idx: number) => void;
}

export function LineItemForm({ items, onUpdate, onAdd, onRemove }: LineItemFormProps) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <Label>Line Items</Label>
        <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={onAdd}>
          <Plus className="w-3 h-3 mr-1" /> Add Item
        </Button>
      </div>
      <div className="space-y-3">
        {items.map((item, idx) => (
          <div key={idx} className="p-3 rounded-lg border border-border space-y-2">
            <div className="flex items-center gap-2">
              <Select value={item.type} onValueChange={(v) => onUpdate(idx, "type", v)}>
                <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="labor">Labor</SelectItem>
                  <SelectItem value="parts">Parts</SelectItem>
                </SelectContent>
              </Select>
              <Input placeholder="Description" value={item.description} onChange={(e) => onUpdate(idx, "description", e.target.value)} className="flex-1" />
              {items.length > 1 && (
                <Button type="button" variant="ghost" size="icon" className="w-7 h-7 text-destructive shrink-0" onClick={() => onRemove(idx)}>
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              )}
            </div>
            {item.type === "labor" ? (
              <div className="grid grid-cols-3 gap-2">
                <div><Label className="text-xs">Rate/hr</Label><Input type="number" step="0.01" min="0" value={item.hourlyRate} onChange={(e) => onUpdate(idx, "hourlyRate", parseFloat(e.target.value) || 0)} /></div>
                <div><Label className="text-xs">Hours</Label><Input type="number" step="0.25" min="0" value={item.hours} onChange={(e) => onUpdate(idx, "hours", parseFloat(e.target.value) || 0)} /></div>
                <div><Label className="text-xs">Total</Label><Input readOnly value={`$${((item.hourlyRate || 0) * (item.hours || 0)).toFixed(2)}`} className="bg-muted" /></div>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                <div><Label className="text-xs">Qty</Label><Input type="number" min="0" value={item.quantity} onChange={(e) => onUpdate(idx, "quantity", parseInt(e.target.value) || 1)} /></div>
                <div><Label className="text-xs">Unit Price</Label><Input type="number" step="0.01" min="0" value={item.unitPrice} onChange={(e) => onUpdate(idx, "unitPrice", parseFloat(e.target.value) || 0)} /></div>
                <div><Label className="text-xs">Total</Label><Input readOnly value={`$${((item.quantity || 1) * (item.unitPrice || 0)).toFixed(2)}`} className="bg-muted" /></div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
