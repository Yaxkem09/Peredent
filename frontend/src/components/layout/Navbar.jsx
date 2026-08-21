import { useLocation } from 'react-router-dom';
import './Navbar.css';

const TITULOS = {
  '/dashboard': 'Dashboard',
  '/pacientes': 'Pacientes',
  '/calendario': 'Agenda',
  '/recetario': 'Recetario',
};

const tituloDeRuta = (pathname) => {
  const match = Object.keys(TITULOS).find((path) => pathname.startsWith(path));
  return match ? TITULOS[match] : 'Peredent';
};

const Navbar = ({ onToggleSidebar }) => {
  const location = useLocation();

  return (
    <header className="navbar">
      <button
        type="button"
        className="navbar-toggle"
        onClick={onToggleSidebar}
        aria-label="Abrir menú"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path strokeLinecap="round" d="M3.5 6.5h17M3.5 12h17M3.5 17.5h17" />
        </svg>
      </button>
      <span className="navbar-title">{tituloDeRuta(location.pathname)}</span>
    </header>
  );
};

export default Navbar;
