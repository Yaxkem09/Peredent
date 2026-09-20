import { useState, useEffect } from 'react';
import { recetarioService } from '../../services/recetario.service';
import { Alert, EmptyState, Loader } from '../../components/common';
import { formatDate, formatTime } from '../../utils/formatters';
import RecetaForm from '../Recetario/RecetaForm';
import RecetaDocumento from '../Recetario/RecetaDocumento';
import { IconPlus, IconChevronRight, IconFileText } from '../Recetario/RecetarioIcons';
import '../Recetario/Recetario.css';

// SCRUM-92: generación de recetas médicas digitales desde el expediente.
// SCRUM-101 menú "Recetario" · SCRUM-93 encabezado del odontólogo/clínica ·
// SCRUM-94 paciente autocompletado · SCRUM-102 fecha/hora automática ·
// SCRUM-103 medicamentos · SCRUM-104 otras indicaciones · SCRUM-105 firma y
// sello · SCRUM-95 exportar a PDF. El formulario de creación y el documento
// de la receta se comparten con el menú principal (pages/Recetario).
const RecetarioTab = ({ idPaciente, paciente }) => {
  const [vista, setVista] = useState('lista'); // 'lista' | 'nueva' | 'ver'
  const [recetas, setRecetas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [recetaSeleccionada, setRecetaSeleccionada] = useState(null);

  const nombrePaciente = paciente ? `${paciente.nombres} ${paciente.apellidos}` : '';

  useEffect(() => {
    let activo = true;
    setCargando(true);
    setError(null);

    recetarioService
      .getByPaciente(idPaciente)
      .then((data) => {
        if (activo) setRecetas(data);
      })
      .catch(() => {
        if (activo) setError('No se pudo cargar el recetario de este paciente.');
      })
      .finally(() => {
        if (activo) setCargando(false);
      });

    return () => {
      activo = false;
    };
  }, [idPaciente]);

  const verReceta = (receta) => {
    setRecetaSeleccionada(receta);
    setVista('ver');
  };

  const alCrear = (nueva) => {
    setRecetas((prev) => [nueva, ...prev]);
    setRecetaSeleccionada(nueva);
    setVista('ver');
  };

  const alEliminar = (idReceta) => {
    setRecetas((prev) => prev.filter((r) => r.idReceta !== idReceta));
    setVista('lista');
  };

  if (cargando) return <Loader />;
  if (error) return <Alert type="error">{error}</Alert>;

  if (vista === 'ver' && recetaSeleccionada) {
    return (
      <RecetaDocumento
        receta={recetaSeleccionada}
        onVolver={() => setVista('lista')}
        onEliminada={alEliminar}
      />
    );
  }

  if (vista === 'nueva') {
    return (
      <RecetaForm
        idPaciente={idPaciente}
        nombrePaciente={nombrePaciente}
        onCreada={alCrear}
        onCancelar={() => setVista('lista')}
      />
    );
  }

  return (
    <div className="recetario">
      <div className="recetario-acciones">
        {recetas.length > 0 && (
          <span className="recetario-contador">
            {recetas.length} receta{recetas.length === 1 ? '' : 's'} registrada{recetas.length === 1 ? '' : 's'}
          </span>
        )}
        <button type="button" className="btn btn-primary btn-md" onClick={() => setVista('nueva')}>
          <IconPlus /> Nueva receta
        </button>
      </div>

      {recetas.length === 0 ? (
        <EmptyState
          icon={<IconFileText />}
          title="Sin recetas registradas"
          description="Aún no se han generado recetas médicas para este paciente."
        />
      ) : (
        <div className="recetario-lista">
          {recetas.map((r) => (
            <button type="button" className="recetario-item" key={r.idReceta} onClick={() => verReceta(r)}>
              <span className="recetario-item-icono">
                <IconFileText />
              </span>
              <span className="recetario-item-cuerpo">
                <span className="recetario-item-fecha">
                  {formatDate(r.fechaEmision)} · {formatTime(r.fechaEmision)}
                </span>
                <span className="recetario-item-tags">
                  {r.medicamentos.map((m, i) => (
                    <span className="recetario-tag" key={i}>
                      {m.nombre}
                    </span>
                  ))}
                </span>
              </span>
              <span className="recetario-item-chevron">
                <IconChevronRight />
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default RecetarioTab;
