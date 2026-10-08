import Link from "next/link";
import { card } from "@/components/ui";
import { LoginForm } from "./LoginForm";

const ERRORS: Record<string, string> = {
  link_expired: "That sign-in link has expired or was already used. Request a new one.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;
  const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4">
      <Link href="/" className="mb-8 text-lg font-bold tracking-tight">
        Sales<span className="text-indigo-600">Coach</span>
      </Link>
      <div className={`${card} w-full max-w-sm`}>
        <h1 className="text-xl font-bold">Sign in or create an account</h1>
        <p className="mt-1 mb-5 text-sm text-slate-600">We&apos;ll email you a magic link.</p>
        <LoginForm next={safeNext} initialError={error ? ERRORS[error] ?? "Sign-in failed. Please try again." : undefined} />
      </div>
    </div>
  );
}
