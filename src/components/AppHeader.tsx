import Link from "next/link";
import { signOut } from "@/app/actions";
import { btn } from "./ui";

const NAV = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/scenarios", label: "Scenarios" },
  { href: "/history", label: "History" },
];

export function AppHeader({ email }: { email?: string | null }) {
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
        <div className="flex items-center gap-6">
          <Link href="/dashboard" className="text-base font-bold tracking-tight text-slate-900">
            Sales<span className="text-indigo-600">Coach</span>
          </Link>
          <nav className="hidden gap-1 sm:flex">
            {NAV.map((n) => (
              <Link key={n.href} href={n.href} className={btn.ghost}>
                {n.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-3">
          {email && <span className="hidden text-sm text-slate-500 md:inline">{email}</span>}
          <form action={signOut}>
            <button className={btn.ghost} type="submit">
              Sign out
            </button>
          </form>
        </div>
      </div>
      <nav className="flex gap-1 border-t border-slate-100 px-2 py-1 sm:hidden">
        {NAV.map((n) => (
          <Link key={n.href} href={n.href} className={btn.ghost}>
            {n.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
