import { EmptyState } from '../../components/common';
import '../../styles/page-header.css';

const InventarioList = () => {
  return (
    <div className="page-block">
      <div className="page-head">
        <div>
          <div className="eyebrow">Insumos</div>
          <h2>Inventario</h2>
          <p>Control de existencias, stock bajo y vencimientos.</p>
        </div>
      </div>

      <EmptyState
        title="Inventario en construcción"
        description="El listado de inventario con alertas de stock bajo y vencidos se implementa en una próxima iteración."
      />
    </div>
  );
};

export default InventarioList;
