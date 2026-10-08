import { redirect } from "next/navigation";
import { card } from "@/components/ui";
import { getProfile } from "@/lib/data/queries";
import { OnboardingForm } from "./OnboardingForm";

export default async function OnboardingPage() {
  const profile = await getProfile();
  if (!profile) redirect("/login");
  if (profile.onboarded_at) redirect("/dashboard");
  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="text-2xl font-bold tracking-tight">Let&apos;s set up your practice</h1>
      <p className="mt-2 text-slate-600">Three quick questions so we can recommend your first conversation.</p>
      <div className={`${card} mt-6`}>
        <OnboardingForm />
      </div>
    </main>
  );
}
