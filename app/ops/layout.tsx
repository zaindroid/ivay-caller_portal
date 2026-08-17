import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { Topbar } from "@/components/topbar";

const LINKS = [
  { href: "/ops", label: "Dashboard" },
  { href: "/ops/accounts", label: "Accounts" },
  { href: "/ops/numbers", label: "Numbers" },
  { href: "/ops/bot-configs", label: "Voice Agents" },
  { href: "/ops/agents", label: "Agents" },
  { href: "/ops/logs", label: "Logs" },
];

export default async function OpsLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user || user.role !== "OPS") redirect("/login");

  return (
    <div className="flex min-h-screen flex-col">
      <Topbar links={LINKS} userLabel={user.email} />
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-8">{children}</main>
    </div>
  );
}
