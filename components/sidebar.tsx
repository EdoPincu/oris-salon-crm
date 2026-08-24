"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/calendar", label: "Calendar" },
  { href: "/clients", label: "Clients" },
  { href: "/services", label: "Services" },
  { href: "/reminders", label: "Follow-ups" },
  { href: "/reports", label: "Reports" },
  { href: "/settings", label: "Settings" },
];

export function Sidebar({ salonName }: { salonName: string }) {
  const pathname = usePathname();

  return (
    <aside className="flex w-56 shrink-0 flex-col border-r border-outline-variant bg-surface-low px-4 py-6">
      <Link href="/dashboard" className="mb-8 px-2 font-display text-xl">
        {salonName}
      </Link>

      <nav className="flex flex-1 flex-col gap-1">
        {NAV.map((item) => {
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`rounded-md px-3 py-2 text-sm transition-colors ${
                active
                  ? "bg-primary-fixed font-medium text-on-primary-container"
                  : "text-on-surface-variant hover:bg-surface-container"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      <form action="/auth/signout" method="post">
        <button
          type="submit"
          className="w-full rounded-md px-3 py-2 text-left text-sm text-on-surface-variant hover:bg-surface-container"
        >
          Sign out
        </button>
      </form>
    </aside>
  );
}
