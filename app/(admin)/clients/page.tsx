import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { EmptyState } from "@/components/empty-state";
import { ClientForm } from "./client-form";

export const dynamic = "force-dynamic";

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("clients")
    .select("id, full_name, phone, email, archived")
    .eq("archived", false)
    .order("full_name");

  if (q) query = query.or(`full_name.ilike.%${q}%,phone.ilike.%${q}%,email.ilike.%${q}%`);

  const { data: clients } = await query;

  return (
    <div className="max-w-4xl space-y-8">
      <header className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl">Clients</h1>
          <p className="mt-1 text-on-surface-variant">
            {clients?.length ?? 0} on the books
          </p>
        </div>
        <form className="w-64">
          <input
            name="q"
            defaultValue={q ?? ""}
            placeholder="Search name, phone, email"
            className="input"
          />
        </form>
      </header>

      {!clients?.length ? (
        <EmptyState
          title={q ? `No one matches “${q}”.` : "No clients yet."}
          hint={q ? undefined : "Add your first client below."}
        />
      ) : (
        <ul className="divide-y divide-outline-variant rounded-lg border border-outline-variant bg-surface-lowest">
          {clients.map((c) => (
            <li key={c.id}>
              <Link
                href={`/clients/${c.id}`}
                className="flex items-center gap-4 px-4 py-3 hover:bg-surface-low"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-fixed text-sm font-medium text-on-primary-container">
                  {initials(c.full_name)}
                </span>
                <span className="flex-1">{c.full_name}</span>
                <span className="text-sm text-on-surface-variant">
                  {c.phone ?? c.email ?? ""}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <section className="rounded-lg border border-outline-variant bg-surface-low p-5">
        <h2 className="mb-4 text-xl">Add a client</h2>
        <ClientForm />
      </section>
    </div>
  );
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}
