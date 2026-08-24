export function EmptyState({
  title,
  hint,
}: {
  title: string;
  hint?: string;
}) {
  return (
    <div className="rounded-lg border border-dashed border-outline-variant px-6 py-10 text-center">
      <p className="text-on-surface-variant">{title}</p>
      {hint && <p className="mt-1 text-sm text-outline">{hint}</p>}
    </div>
  );
}
