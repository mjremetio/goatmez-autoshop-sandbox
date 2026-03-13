import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Mail } from "lucide-react";

type SendEmailDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  isPending: boolean;
  title: string;
  recipientName: string;
  recipientEmail: string;
  description: string;
};

export function SendEmailDialog({
  open,
  onOpenChange,
  onConfirm,
  isPending,
  title,
  recipientName,
  recipientEmail,
  description,
}: SendEmailDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="w-5 h-5" />
            {title}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">{description}</p>
          <div className="bg-muted/50 rounded-lg p-3">
            <p className="text-sm font-medium">{recipientName}</p>
            <p className="text-xs text-muted-foreground">{recipientEmail}</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={onConfirm} disabled={isPending}>
            <Mail className="w-4 h-4 mr-2" />
            {isPending ? "Sending..." : "Send Email"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
