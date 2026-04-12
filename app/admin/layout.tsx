import AdminSidebar, { navItems } from "./components/AdminSidebar";
import DashboardHeader from "../components/layout/DashboardHeader";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen flex-col overflow-hidden bg-slate-50 dark:bg-[#09090b] md:flex-row">
      <AdminSidebar />
      <DashboardHeader navItems={navItems} title="Admin Console" />
      
      <main className="flex-1 overflow-y-auto w-full relative z-10 bg-white dark:bg-black p-4 md:p-8">
        <div className="max-w-7xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
