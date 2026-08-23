import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { pacientesService } from '../../services/pacientes.service';
import { formatDate } from '../../utils/formatters';
import { Alert, EmptyState, Loader } from '../../components/common';
import { ROUTES } from '../../routes/routes';
import '../../styles/page-header.css';
import './Pacientes.css';

const inicialesDe = (nombres, apellidos) =>
  `${(nombres || '').charAt(0)}${(apellidos || '').charAt(0)}`.toUpperCase() || '—';

  const PacientesList = () => {
  const [pacientes, setPacientes] = useState([]);
  const [termino, setTermino] = useState('');
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

useEffect(() => {
  let activo = true;
  setCargando(true);
  setError(null);

  const timer = setTimeout(() => {
    const promesa = termino.trim()
      ? pacientesService.search(termino.trim())
      : pacientesService.getAll();

    promesa
      .then((data) => { if (activo) setPacientes(data); })
      .catch(() => { if (activo) setError('No se pudo cargar la lista de pacientes.'); })
      .finally(() => { if (activo) setCargando(false); });
  }, 400);

  return () => {
    activo = false;
    clearTimeout(timer);
  };
}, [termino]);