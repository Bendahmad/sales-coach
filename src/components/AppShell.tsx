import { redirect } from "next/navigation";
import { getProfile } from "@/lib/data/queries";
import { AppHeader } from "./AppHeader";

/** Layout for signed-in pages; sends first-time users to onboarding. */
export async function AppShell({ children, wide = false }: { children: React.ReactNode; wide?: boolean }) {
  const profile = await getProfile();
  if (!profile) redirect("/login");
  if (!profile.onboarded_at) redirect("/onboarding");
  return (
    <div className="min-h-screen">
      <AppHeader email={profile.email} />
      <main className={`mx-auto px-4 py-8 ${wide ? "max-w-5xl" : "max-w-3xl"}`}>{children}</main>
    </div>
  );
}
