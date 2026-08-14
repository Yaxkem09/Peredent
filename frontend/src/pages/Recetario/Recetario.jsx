import { EmptyState } from '../../components/common';
import '../../styles/page-header.css';

const Recetario = () => {
  return (
    <div className="page-block">
      <div className="page-head">
        <div>
          <div className="eyebrow">Recetario</div>
          <h2>Recetario</h2>
          <p>Historial de recetas emitidas a los pacientes.</p>
        </div>
      </div>

      <EmptyState
        title="Recetario en construcción"
        description="El registro y consulta de recetas por paciente se implementa en una próxima iteración."
      />
    </div>
  );
};

export default Recetario;
