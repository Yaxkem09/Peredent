import { useCallback, useEffect, useImperativeHandle, useState } from 'react';
import { useBlocker } from 'react-router-dom';

// Aviso de cambios sin guardar de una pestaña del expediente (SCRUM-283). Lo
// usan "Plan de tratamiento" y "Endodoncia y restauración".
//
// Cubre las tres formas de salir con cambios pendientes:
//  - Cambiar de pestaña: PacienteDetail llama a ref.intentarCambiarTab(destino)
//    en vez de cambiar directo (SCRUM-284).
//  - Salir a otra pantalla (menú lateral, "Volver a pacientes", atrás del
//    navegador) con useBlocker. Solo bloquea si cambia la ruta y nunca el paso
//    al login, para no trabar el cierre de sesión por inactividad.
//  - Cerrar o recargar la pestaña del navegador con beforeunload (SCRUM-286).
//
// guardar: async () => boolean (true si se guardó). "Guardar y salir" solo
// avanza si devuelve true; si falla, el aviso queda abierto y la pestaña muestra
// su propio error.
export const useAvisoCambiosSinGuardar = ({ ref, hayCambios, guardar, onCambiarTab }) => {
  const [tabPendiente, setTabPendiente] = useState(null);
  const [guardandoAviso, setGuardandoAviso] = useState(false);

  useImperativeHandle(
    ref,
    () => ({
      intentarCambiarTab: (destino) => {
        if (hayCambios) {
          setTabPendiente(destino);
        } else {
          onCambiarTab?.(destino);
        }
      },
    }),
    [hayCambios, onCambiarTab],
  );

  const debeBloquear = useCallback(
    ({ currentLocation, nextLocation }) =>
      hayCambios &&
      currentLocation.pathname !== nextLocation.pathname &&
      nextLocation.pathname !== '/login',
    [hayCambios],
  );
  const blocker = useBlocker(debeBloquear);
  const salidaBloqueada = blocker.state === 'blocked';

  // El listener de beforeunload solo existe mientras haya cambios sin guardar.
  useEffect(() => {
    if (!hayCambios) return undefined;

    const onBeforeUnload = (e) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [hayCambios]);

  const guardarYSalir = async () => {
    setGuardandoAviso(true);
    try {
      const exito = await guardar();
      if (!exito) return;
      if (salidaBloqueada) {
        blocker.proceed();
      } else if (tabPendiente) {
        onCambiarTab?.(tabPendiente);
      }
      setTabPendiente(null);
    } finally {
      setGuardandoAviso(false);
    }
  };

  // "Cancelar": se queda en la pestaña sin perder lo escrito.
  const cancelar = () => {
    setTabPendiente(null);
    if (salidaBloqueada) blocker.reset();
  };

  return {
    open: Boolean(tabPendiente) || salidaBloqueada,
    guardando: guardandoAviso,
    onGuardarYSalir: guardarYSalir,
    onCancelar: cancelar,
  };
};
