const STYLES: Record<string, string> = {
  pending: "bg-primary-fixed text-on-primary-container",
  confirmed: "bg-secondary-container text-on-secondary-container",
  completed: "bg-surface-highest text-on-surface-variant",
  cancelled: "bg-error-container text-on-error-container",
  no_show: "bg-error-container text-on-error-container",
};

const LABELS: Record<string, string> = {
  pending: "Pending",
  confirmed: "Confirmed",
  completed: "Completed",
  cancelled: "Cancelled",
  no_show: "No show",
};

export function StatusChip({ status }: { status: string }) {
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
        STYLES[status] ?? "bg-surface-highest text-on-surface-variant"
      }`}
    >
      {LABELS[status] ?? status}
    </span>
  );
}
