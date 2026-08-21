import { NavLink } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
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
    icon: (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
        <path d="M7.5 3.5h9a1 1 0 0 1 1 1V19a2 2 0 0 1-2 2h-7a2 2 0 0 1-2-2V4.5a1 1 0 0 1 1-1Z" />
        <path d="M9.5 8h5M9.5 11.5h5M9.5 15h3" />
      </svg>
    ),
  },
];

const Sidebar = ({ open, onNavigate }) => {
  const { user, logout } = useAuth();
  const iniciales = user?.usuario ? user.usuario.slice(0, 2).toUpperCase() : '--';

  return (
    <aside className={`sidebar${open ? ' sidebar-open' : ''}`}>
      <div className="brand">
        <div className="brand-mark">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 3c-2.5 0-5 1.2-5 4.2 0 2.6.7 5 1.3 7.3.4 1.6.7 3 1.6 4.4.3.5 1 .5 1.3 0 .6-1 .6-2.5.8-3.7.1-.7.5-1.2 1-1.2s.9.5 1 1.2c.2 1.2.2 2.7.8 3.7.3.5 1 .5 1.3 0 .9-1.4 1.2-2.8 1.6-4.4.6-2.3 1.3-4.7 1.3-7.3C19 4.2 16.5 3 14 3"
            />
          </svg>
        </div>
        <div>
          <div className="brand-name">Peredent</div>
          <div className="brand-sub">Odontología General · Ortodoncia · Cirugía Maxilofacial</div>
        </div>
      </div>

      <nav>
        {NAV_ITEMS.map((item) => (
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
            <div className="user-chip-role">Personal clínico</div>
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
