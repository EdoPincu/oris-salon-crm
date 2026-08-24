import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/sidebar";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: settings } = await supabase
    .from("settings")
    .select("display_name")
    .single();

  return (
    <div className="flex min-h-screen">
      <Sidebar salonName={settings?.display_name ?? "Salon"} />
      <main className="flex-1 px-8 py-8">{children}</main>
    </div>
  );
}
