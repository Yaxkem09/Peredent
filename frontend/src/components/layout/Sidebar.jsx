import { NavLink } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import logo from '../../assets/logo.png';
import './Sidebar.css';

const NAV_ITEMS = [
  {
    to: '/dashboard',
    label: 'Dashboard',
    icon: (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
        <rect x="3.5" y="3.5" width="7.5" height="7.5" rx="1.5" />
        <rect x="13" y="3.5" width="7.5" height="7.5" rx="1.5" />
        <rect x="3.5" y="13" width="7.5" height="7.5" rx="1.5" />
        <rect x="13" y="13" width="7.5" height="7.5" rx="1.5" />
      </svg>
    ),
  },
  {
    to: '/pacientes',
    label: 'Pacientes',
    icon: (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
        <circle cx="9" cy="8" r="3.2" />
        <path d="M3.5 20c0-3.3 2.5-5.5 5.5-5.5s5.5 2.2 5.5 5.5" />
        <circle cx="17" cy="7" r="2.4" />
        <path d="M15 20c0-2.6 1.7-4.5 4-4.9" />
      </svg>
    ),
  },
  {
    to: '/calendario',
    label: 'Agenda',
    icon: (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
        <rect x="3.5" y="5" width="17" height="15" rx="2" />
        <path d="M3.5 9.5h17" />
        <path d="M8 3v4M16 3v4" />
      </svg>
    ),
  },
  {
    to: '/recetario',
    label: 'Recetario',
    hideFor: ['Asistente'],
    icon: (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
        <path d="M7.5 3.5h9a1 1 0 0 1 1 1V19a2 2 0 0 1-2 2h-7a2 2 0 0 1-2-2V4.5a1 1 0 0 1 1-1Z" />
        <path d="M9.5 8h5M9.5 11.5h5M9.5 15h3" />
      </svg>
    ),
  },
];

const ADMIN_ITEM = {
  to: '/administracion',
  label: 'Administración',
  icon: (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <circle cx="12" cy="8" r="3.2" />
      <path d="M5 20c0-3.9 3.1-6.5 7-6.5s7 2.6 7 6.5" />
    </svg>
  ),
};

const Sidebar = ({ open, onNavigate }) => {
  const { user, logout } = useAuth();
  const iniciales = user?.usuario ? user.usuario.slice(0, 2).toUpperCase() : '--';

  const items = NAV_ITEMS.filter((item) => !item.hideFor?.includes(user?.rol));
  const visibleItems = user?.esAdmin ? [...items, ADMIN_ITEM] : items;

  return (
    <aside className={`sidebar${open ? ' sidebar-open' : ''}`}>
      <div className="brand">
        <div className="brand-mark">
          <img src={logo} alt="Peredent - Odontología General · Ortodoncia · Cirugía Maxilofacial" />
        </div>
      </div>

      <nav>
        {visibleItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            onClick={onNavigate}
            className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
          >
            {item.icon}
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-foot">
        <div className="user-chip">
          <div className="avatar">{iniciales}</div>
          <div>
            <div className="user-chip-name">{user?.usuario || 'Invitado'}</div>
            <div className="user-chip-role">{user?.rol || 'Personal clínico'}</div>
          </div>
        </div>
        <button type="button" className="logout-btn" onClick={logout}>
          Cerrar sesión
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
