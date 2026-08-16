"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

export type NavLink = { href: string; label: string };

export function Topbar({ links, userLabel }: { links: NavLink[]; userLabel: string }) {
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="sticky top-0 z-40 flex h-15 items-center gap-4 border-b border-border bg-surface px-6">
      <Link href="/" className="mr-4 flex items-center gap-2">
        <Image src="/ivay-icon.png" alt="" width={30} height={26} priority />
        <span className="text-lg font-extrabold tracking-tight text-text">ivay</span>
      </Link>
      <nav className="flex gap-1">
        {links.map((l) => {
          const active = pathname === l.href || pathname.startsWith(l.href + "/");
          return (
            <Link
              key={l.href}
              href={l.href}
              className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                active ? "border border-border-hi bg-card text-text" : "text-text-dim hover:bg-card hover:text-text"
              }`}
            >
              {l.label}
            </Link>
          );
        })}
      </nav>
      <div className="ml-auto flex items-center gap-3">
        <span className="text-xs text-text-faint">{userLabel}</span>
        <button
          onClick={logout}
          className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-text-dim transition hover:border-danger/40 hover:text-danger"
        >
          Sign Out
        </button>
      </div>
    </div>
  );
}
