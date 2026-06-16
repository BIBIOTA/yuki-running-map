import { AdminTopNav } from "@/features/admin-auth/AdminTopNav";

export default function AdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      <AdminTopNav />
      <main className="flex-1">{children}</main>
    </div>
  );
}
