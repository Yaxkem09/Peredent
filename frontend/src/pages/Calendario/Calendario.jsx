import { EmptyState } from '../../components/common';
import '../../styles/page-header.css';

const Calendario = () => {
  return (
    <div className="page-block">
      <div className="page-head">
        <div>
          <div className="eyebrow">Agenda</div>
          <h2>Calendario de citas</h2>
          <p>Vista mensual de citas confirmadas y pendientes.</p>
        </div>
      </div>

      <EmptyState
        title="Calendario en construcción"
        description="La vista de agenda con citas por día, semana y mes se implementa en una próxima iteración."
      />
    </div>
  );
};

export default Calendario;
