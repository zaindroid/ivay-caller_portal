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
    <div className="sticky top-0 z-40 border-b border-border bg-surface/90 backdrop-blur-sm">
      <div className="flex h-16 items-center gap-6 px-6">
        <Link href="/" className="flex items-center gap-2.5">
          <Image src="/ivay-icon.png" alt="" width={28} height={24} priority />
          <span className="flex items-baseline gap-1.5">
            <span className="text-lg font-bold tracking-tight text-text">ivay</span>
            <span className="hidden text-[0.7rem] font-medium tracking-wide text-text-faint sm:inline">Caller Portal</span>
          </span>
        </Link>
        <nav className="flex h-full items-stretch gap-1">
          {links.map((l) => {
            const active = pathname === l.href || pathname.startsWith(l.href + "/");
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`relative flex items-center px-3 text-sm font-medium transition-colors ${
                  active ? "text-text" : "text-text-dim hover:text-text"
                }`}
              >
                {l.label}
                {active && <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-primary" />}
              </Link>
            );
          })}
        </nav>
        <div className="ml-auto flex items-center gap-3">
          <span className="hidden text-xs text-text-faint sm:inline">{userLabel}</span>
          <button
            onClick={logout}
            className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-text-dim transition-colors hover:border-danger/40 hover:text-danger"
          >
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );
}
