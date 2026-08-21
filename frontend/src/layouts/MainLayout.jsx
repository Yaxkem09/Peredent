import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar, Navbar, Footer } from '../components/layout';
import './MainLayout.css';

const MainLayout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="app-shell">
      <Sidebar open={sidebarOpen} onNavigate={() => setSidebarOpen(false)} />
      {sidebarOpen && (
        <button
          type="button"
          className="sidebar-backdrop"
          aria-label="Cerrar menú"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      <div className="app-content">
        <Navbar onToggleSidebar={() => setSidebarOpen((open) => !open)} />
        <main className="app-main">
          <Outlet />
        </main>
        <Footer />
      </div>
    </div>
  );
};

export default MainLayout;
