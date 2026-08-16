import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { Topbar } from "@/components/topbar";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user || user.role !== "CLIENT") redirect("/login");

  return (
    <div className="flex min-h-screen flex-col">
      <Topbar links={[{ href: "/portal", label: "Dashboard" }]} userLabel={user.email} />
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-8">{children}</main>
    </div>
  );
}
