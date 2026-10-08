"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { INDUSTRIES } from "@/lib/content/scenario-schema";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/supabase/server";

const Schema = z.object({
  display_name: z.string().trim().max(60).optional(),
  industry: z.enum(INDUSTRIES),
  experience: z.enum(["new", "some", "experienced"]),
  biggest_challenge: z.enum(["cold_calls", "price_talks", "objections", "closing"]),
});

export type OnboardingState = { error?: string };

export async function saveOnboarding(_prev: OnboardingState, formData: FormData): Promise<OnboardingState> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const parsed = Schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Please answer all three questions." };

  const { error } = await supabaseAdmin()
    .from("users")
    .update({ ...parsed.data, display_name: parsed.data.display_name || null, onboarded_at: new Date().toISOString() })
    .eq("id", user.id);
  if (error) return { error: "Couldn't save your answers. Please try again." };
  redirect("/dashboard");
}
