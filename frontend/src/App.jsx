import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { NotificationProvider } from './context/NotificationContext';
import ProtectedRoute from './routes/ProtectedRoute';
import PermissionRoute from './routes/PermissionRoute';
import MainLayout from './layouts/MainLayout';
import Login from './pages/Login/Login';
import OlvideContrasena from './pages/RecuperarContrasena/OlvideContrasena';
import RestablecerContrasena from './pages/RecuperarContrasena/RestablecerContrasena';
import Dashboard from './pages/Dashboard/Dashboard';
import PacientesList from './pages/Pacientes/PacientesList';
import PacienteForm from './pages/Pacientes/PacienteForm';
import PacienteDetail from './pages/Pacientes/PacienteDetail';
import Calendario from './pages/Calendario/Calendario';
import Recetario from './pages/Recetario/Recetario';
import InventarioList from './pages/Inventario/InventarioList';
import AdministracionUsuarios from './pages/Administracion/AdministracionUsuarios';
import Configuracion from './pages/Configuracion/Configuracion';

function App() {
  return (
    <BrowserRouter>
      <NotificationProvider>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/login" element={<Login />} />
            {/* SCRUM-231: rutas públicas de recuperación (sin sesión). */}
            <Route path="/olvide-contrasena" element={<OlvideContrasena />} />
            <Route path="/restablecer-contrasena" element={<RestablecerContrasena />} />

            <Route element={<ProtectedRoute />}>
              <Route element={<MainLayout />}>
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/pacientes" element={<PacientesList />} />
                <Route path="/pacientes/nuevo" element={<PacienteForm />} />
                <Route path="/pacientes/:id" element={<PacienteDetail />} />
                <Route path="/pacientes/:id/editar" element={<PacienteForm />} />
                <Route path="/calendario" element={<Calendario />} />
                <Route path="/inventario" element={<InventarioList />} />
                {/* SCRUM-237: configuración de la propia cuenta (cualquier rol). */}
                <Route path="/configuracion" element={<Configuracion />} />

                <Route element={<PermissionRoute allow={(u) => u?.rol !== 'Asistente'} />}>
                  <Route path="/recetario" element={<Recetario />} />
                </Route>

                <Route element={<PermissionRoute allow={(u) => Boolean(u?.esAdmin)} />}>
                  <Route path="/administracion" element={<AdministracionUsuarios />} />
                </Route>
              </Route>
            </Route>

            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </AuthProvider>
      </NotificationProvider>
    </BrowserRouter>
  );
}

export default App;
