import { useNavigate, useParams } from 'react-router-dom';
import { EmptyState } from '../../components/common';
import '../../styles/page-header.css';

const PacienteDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  return (
    <div className="page-block">
      <div className="page-head">
        <div>
          <div className="eyebrow">Expediente completo</div>
          <h2>Paciente {id}</h2>
          <p>Ficha, historia médica, citas, tratamientos y saldo en una sola vista.</p>
        </div>
      </div>

      <EmptyState
        title="Expediente en construcción"
        description="La consulta del expediente completo (historia SCRUM-24) se implementa en la siguiente iteración."
        action={
          <button type="button" className="btn btn-secondary btn-md" onClick={() => navigate(-1)}>
            Volver
          </button>
        }
      />
    </div>
  );
};

export default PacienteDetail;
