"use client";

import { Fragment, useState } from "react";

type Row = {
  id: string;
  name: string;
  phone: string | null;
  lastVisit: string;
  weeks: number;
  usual: string | null;
  message: string;
};

export function FollowUpTable({ rows }: { rows: Row[] }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  async function copy(row: Row) {
    try {
      await navigator.clipboard.writeText(row.message);
      setCopiedId(row.id);
      setTimeout(() => setCopiedId((c) => (c === row.id ? null : c)), 2000);
    } catch {
      // Clipboard can be blocked; showing the text is the fallback.
      setOpenId(row.id);
    }
  }

  return (
    <div className="overflow-hidden rounded-lg border border-outline-variant bg-surface-lowest">
      <table className="w-full text-sm">
        <thead className="bg-surface-low text-start text-on-surface-variant">
          <tr>
            <th className="px-4 py-2 font-medium">לקוח/ה</th>
            <th className="px-4 py-2 font-medium">ביקור אחרון</th>
            <th className="px-4 py-2 font-medium">שבועות</th>
            <th className="px-4 py-2 font-medium">שירות רגיל</th>
            <th className="px-4 py-2 font-medium">טלפון</th>
            <th className="px-4 py-2" />
          </tr>
        </thead>
        <tbody className="divide-y divide-outline-variant">
          {rows.map((r) => (
            <Fragment key={r.id}>
              <tr>
                <td className="px-4 py-2.5 font-medium">{r.name}</td>
                <td className="px-4 py-2.5">{r.lastVisit}</td>
                <td className="px-4 py-2.5 tabular-nums">{r.weeks}</td>
                <td className="px-4 py-2.5 text-on-surface-variant">
                  {r.usual ?? "—"}
                </td>
                <td className="px-4 py-2.5 tabular-nums">{r.phone ?? "—"}</td>
                <td className="px-4 py-2.5 text-end">
                  <button
                    onClick={() => copy(r)}
                    className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-on-primary"
                  >
                    {copiedId === r.id ? "הועתק" : "העתקת הודעה"}
                  </button>
                  <button
                    onClick={() => setOpenId(openId === r.id ? null : r.id)}
                    className="ms-2 text-xs text-on-surface-variant underline"
                  >
                    {openId === r.id ? "הסתרה" : "תצוגה מקדימה"}
                  </button>
                </td>
              </tr>
              {openId === r.id && (
                <tr>
                  <td colSpan={6} className="bg-surface-low px-4 py-3">
                    <p className="rounded-md border border-outline-variant bg-surface-lowest px-3 py-2 text-sm">
                      {r.message}
                    </p>
                  </td>
                </tr>
              )}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}
