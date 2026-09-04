import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { STATUS_CLASSES, statusLabel } from "@/lib/format";

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  return (
    <Badge
      variant="outline"
      className={cn("font-medium", STATUS_CLASSES[status] ?? "", className)}
    >
      {statusLabel(status)}
    </Badge>
  );
}
