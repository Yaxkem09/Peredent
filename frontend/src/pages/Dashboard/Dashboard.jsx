import { useEffect, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { pacientesService } from '../../services/pacientes.service';
import { citasService } from '../../services/citas.service';
import { inventarioService } from '../../services/inventario.service';
import { formatDate, formatTime } from '../../utils/formatters';
import { Loader, EmptyState } from '../../components/common';
import '../../styles/page-header.css';
import './Dashboard.css';

const saludo = () => {
  const hora = new Date().getHours();
  if (hora < 12) return 'Buenos días';
  if (hora < 19) return 'Buenas tardes';
  return 'Buenas noches';
};

const hoyISO = () => new Date().toISOString().slice(0, 10);

const Dashboard = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [pacientes, setPacientes] = useState([]);
  const [citas, setCitas] = useState([]);
  const [stockBajo, setStockBajo] = useState([]);
  const [errores, setErrores] = useState({ pacientes: false, citas: false, inventario: false });

  useEffect(() => {
    let activo = true;

    const cargar = async () => {
      const [rPacientes, rCitas, rInventario] = await Promise.allSettled([
        pacientesService.getAll(),
        citasService.getProximas(),
        inventarioService.getStockBajo(),
      ]);

      if (!activo) return;

      setPacientes(rPacientes.status === 'fulfilled' ? rPacientes.value : []);
      setCitas(rCitas.status === 'fulfilled' ? rCitas.value : []);
      setStockBajo(rInventario.status === 'fulfilled' ? rInventario.value : []);
      setErrores({
        pacientes: rPacientes.status === 'rejected',
        citas: rCitas.status === 'rejected',
        inventario: rInventario.status === 'rejected',
      });
      setLoading(false);
    };

    cargar();
    return () => {
      activo = false;
    };
  }, []);

  if (loading) {
    return <Loader fullscreen label="Cargando panel..." />;
  }

  const citasHoy = citas.filter((cita) => cita.fecha === hoyISO());
  const proximasCitas = [...citas].sort((a, b) => (a.fecha + (a.hora || '')) > (b.fecha + (b.hora || '')) ? 1 : -1).slice(0, 5);

  const stats = [
    { label: 'Pacientes totales', value: errores.pacientes ? '—' : pacientes.length },
    { label: 'Citas de hoy', value: errores.citas ? '—' : citasHoy.length },
    { label: 'Próximas citas', value: errores.citas ? '—' : citas.length },
    { label: 'Stock bajo', value: errores.inventario ? '—' : stockBajo.length, warn: !errores.inventario && stockBajo.length > 0 },
  ];

  return (
    <div className="dashboard page-block">
      <div className="page-head">
        <div>
          <div className="eyebrow">Panel</div>
          <h2>{saludo()}{user?.usuario ? `, ${user.usuario}` : ''}</h2>
          <p>Resumen de la actividad clínica de hoy.</p>
        </div>
      </div>

      <div className="stat-grid">
        {stats.map((stat) => (
          <div key={stat.label} className={`stat-card${stat.warn ? ' warn' : ''}`}>
            <div className="label">{stat.label}</div>
            <div className="value">{stat.value}</div>
          </div>
        ))}
      </div>

      <div className="dashboard-columns">
        <section className="dashboard-panel">
          <h3>Próximas citas</h3>
          {errores.citas ? (
            <EmptyState
              title="Agenda no disponible"
              description="Aún no se pueden cargar las citas desde el servidor."
            />
          ) : proximasCitas.length === 0 ? (
            <EmptyState title="Sin citas próximas" description="No hay citas registradas por ahora." />
          ) : (
            <div className="mini-list">
              {proximasCitas.map((cita) => (
                <div className="mini-row" key={cita.id || `${cita.fecha}-${cita.hora}`}>
                  <div>
                    <div className="mini-row-title">{cita.paciente || cita.pacienteNombre || 'Paciente'}</div>
                    <div className="mini-row-meta">{cita.tratamiento || cita.motivo || 'Consulta'}</div>
                  </div>
                  <div className="mini-row-time">
                    {formatDate(cita.fecha)} · {cita.hora ? cita.hora : formatTime(cita.fecha)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="dashboard-panel">
          <h3>Alertas de inventario</h3>
          {errores.inventario ? (
            <EmptyState
              title="Inventario no disponible"
              description="Aún no se puede cargar el inventario desde el servidor."
            />
          ) : stockBajo.length === 0 ? (
            <EmptyState title="Sin alertas" description="Todos los insumos tienen stock suficiente." />
          ) : (
            <div className="mini-list">
              {stockBajo.map((item) => (
                <div className="mini-row" key={item.id || item.nombre}>
                  <div>
                    <div className="mini-row-title">{item.nombre}</div>
                    <div className="mini-row-meta">Cantidad disponible: {item.cantidad}</div>
                  </div>
                  <span className="tag pending">Stock bajo</span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default Dashboard;
