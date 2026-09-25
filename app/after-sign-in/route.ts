import { redirect } from "next/navigation";
import { currentRole } from "@/lib/auth";

/**
 * Where a sign-in lands when no explicit `?next=` said otherwise.
 *
 * The decision has to happen on the server, because the role lives in
 * `profiles` and the sign-in page's onVerified is a client callback. Routing
 * through here also spares a client the old `/dashboard` -> middleware bounce
 * -> `/my-appointments` double redirect.
 */
export async function GET() {
  const role = await currentRole();

  if (!role) redirect("/sign-in");
  redirect(role === "owner" ? "/dashboard" : "/my-appointments");
}
