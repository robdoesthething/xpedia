import Navbar from '@/components/Navbar';
import DashboardTabs from '@/components/DashboardTabs';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <DashboardTabs />
      <main className="mx-auto max-w-5xl px-6 py-8">{children}</main>
    </div>
  );
}
