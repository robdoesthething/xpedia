import Navbar from '@/components/Navbar';
import DashboardTabs from '@/components/DashboardTabs';
import SearchBar from '@/components/SearchBar';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-stone-50">
      <Navbar />
      <div className="flex items-center justify-between border-b border-stone-200 bg-white px-6">
        <DashboardTabs />
        <SearchBar />
      </div>
      <main className="mx-auto max-w-5xl px-6 py-8">{children}</main>
    </div>
  );
}
