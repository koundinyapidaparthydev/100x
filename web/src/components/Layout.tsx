import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import Footer from './Footer';

export default function Layout() {
  const location = useLocation();
  const isTaskDetail = location.pathname.includes('/boards/task');

  // Task detail page suppresses global nav per guidelines
  if (isTaskDetail) {
    return <Outlet />;
  }

  return (
    <div className="flex min-h-screen bg-background text-on-background mesh-background selection:bg-tertiary/30 selection:text-tertiary">
      <Sidebar />
      <div className="flex-1 flex flex-col md:ml-[280px] min-w-0 relative">
        <Topbar />
        <main className="flex-1 overflow-x-hidden pb-[80px]">
          <Outlet />
        </main>
        <Footer />
      </div>
    </div>
  );
}
