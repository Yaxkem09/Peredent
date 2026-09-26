import { useCallback, useEffect, useRef, useState } from 'react';
import {
  HORA_FIN,
  HORA_INICIO,
  INCREMENTO_MINUTOS,
  PX_POR_MINUTO,
  esCitaReprogramable,
  hayTraslape,
  horaAMinutos,
  minutosAHora,
} from './agenda.utils';

// Cuánto hay que mover el puntero para que cuente como arrastre y no como
// click: sin esto, cualquier temblor al hacer click abriría un "arrastre" y
// nunca se abriría el modal de detalle de la cita.
const UMBRAL_ARRASTRE_PX = 4;
const LIMITE_INICIO = HORA_INICIO * 60;
const LIMITE_FIN = HORA_FIN * 60;

const MOTIVO_TRASLAPE = 'Ese horario se cruza con otra cita.';
const MOTIVO_FECHA = 'No se puede mover la cita a ese día.';

const redondear = (minutos) => Math.round(minutos / INCREMENTO_MINUTOS) * INCREMENTO_MINUTOS;
const acotar = (valor, min, max) => Math.min(Math.max(valor, min), max);

// Arrastre de citas en la grilla de horas (vistas día y semana), en bloques de
// 15 min y siempre dentro de 7:00-19:00. Tres modos:
//   'mover'  -> desplaza la cita completa (misma duración); en la vista semana
//               también puede cambiar de día si se pasa `fechaEnPunto`.
//   'arriba' -> mueve solo la hora de inicio (borde superior).
//   'abajo'  -> mueve solo la hora de fin (borde inferior).
// Mientras se arrastra, `vistaPrevia` trae el nuevo horario para pintarlo en
// vivo; al soltar se llama a `onSoltar` con el cambio, o a `onRechazado` si
// el nuevo horario se traslapa con otra cita (la cita vuelve a su lugar).
export const useArrastreCita = ({ citas, fechaEnPunto, esFechaPermitida, onSoltar, onRechazado }) => {
  const [vistaPrevia, setVistaPrevia] = useState(null);

  // Refs para leer siempre lo último dentro de los listeners de window: el
  // refresco de citas cada 5s cambia `citas` a mitad de un arrastre.
  const citasRef = useRef(citas);
  citasRef.current = citas;
  const opcionesRef = useRef({ fechaEnPunto, esFechaPermitida, onSoltar, onRechazado });
  opcionesRef.current = { fechaEnPunto, esFechaPermitida, onSoltar, onRechazado };

  const limpiarRef = useRef(null);
  const acabaDeArrastrarRef = useRef(false);

  useEffect(() => () => limpiarRef.current?.(), []);

  const iniciarArrastre = useCallback((evento, cita, modo) => {
    if (evento.button !== 0 || !esCitaReprogramable(cita)) return;
    // Los bordes están dentro del bloque: sin esto, el bloque también
    // arrancaría un arrastre de tipo 'mover'.
    evento.stopPropagation();
    // Evita que el navegador empiece a seleccionar texto al arrastrar.
    evento.preventDefault();

    const inicioOriginal = horaAMinutos(cita.hora);
    const finOriginal = inicioOriginal + cita.duracionMinutos;
    const origenX = evento.clientX;
    const origenY = evento.clientY;
    let actual = null;

    const calcular = (e) => {
      const deltaMinutos = (e.clientY - origenY) / PX_POR_MINUTO;
      let inicio = inicioOriginal;
      let fin = finOriginal;
      let fecha = cita.fecha;

      if (modo === 'mover') {
        inicio = acotar(redondear(inicioOriginal + deltaMinutos), LIMITE_INICIO, LIMITE_FIN - cita.duracionMinutos);
        fin = inicio + cita.duracionMinutos;
        fecha = opcionesRef.current.fechaEnPunto?.(e.clientX) ?? cita.fecha;
      } else if (modo === 'arriba') {
        inicio = acotar(redondear(inicioOriginal + deltaMinutos), LIMITE_INICIO, finOriginal - INCREMENTO_MINUTOS);
      } else {
        fin = acotar(redondear(finOriginal + deltaMinutos), inicioOriginal + INCREMENTO_MINUTOS, LIMITE_FIN);
      }

      const { esFechaPermitida: fechaPermitida } = opcionesRef.current;
      let motivo = null;
      if (fecha !== cita.fecha && fechaPermitida && !fechaPermitida(fecha)) motivo = MOTIVO_FECHA;
      else if (hayTraslape(citasRef.current, { idCita: cita.idCita, fecha, inicio, fin })) motivo = MOTIVO_TRASLAPE;

      return { idCita: cita.idCita, modo, fecha, inicio, fin, motivo };
    };

    const alMover = (e) => {
      if (!actual && Math.abs(e.clientX - origenX) < UMBRAL_ARRASTRE_PX && Math.abs(e.clientY - origenY) < UMBRAL_ARRASTRE_PX) {
        return;
      }
      if (!actual) document.body.classList.add(modo === 'mover' ? 'arrastrando-cita' : 'redimensionando-cita');
      actual = calcular(e);
      setVistaPrevia(actual);
    };

    const alSoltar = () => {
      limpiar();
      if (!actual) return;

      // El click que el navegador dispara justo después del pointerup no debe
      // abrir el modal de detalle: el usuario estaba arrastrando.
      acabaDeArrastrarRef.current = true;
      setTimeout(() => {
        acabaDeArrastrarRef.current = false;
      }, 0);

      setVistaPrevia(null);
      const { fecha, inicio, fin, motivo } = actual;
      if (fecha === cita.fecha && inicio === inicioOriginal && fin === finOriginal) return;

      if (motivo) {
        opcionesRef.current.onRechazado?.(motivo);
        return;
      }
      opcionesRef.current.onSoltar(cita, { fecha, hora: minutosAHora(inicio), duracionMinutos: fin - inicio });
    };

    const alCancelar = () => {
      limpiar();
      setVistaPrevia(null);
    };

    const alTeclear = (e) => {
      if (e.key === 'Escape') alCancelar();
    };

    function limpiar() {
      window.removeEventListener('pointermove', alMover);
      window.removeEventListener('pointerup', alSoltar);
      window.removeEventListener('pointercancel', alCancelar);
      window.removeEventListener('keydown', alTeclear);
      document.body.classList.remove('arrastrando-cita', 'redimensionando-cita');
      limpiarRef.current = null;
    }

    limpiarRef.current?.();
    limpiarRef.current = limpiar;
    window.addEventListener('pointermove', alMover);
    window.addEventListener('pointerup', alSoltar);
    window.addEventListener('pointercancel', alCancelar);
    window.addEventListener('keydown', alTeclear);
  }, []);

  const debeIgnorarClick = useCallback(() => acabaDeArrastrarRef.current, []);

  return { vistaPrevia, iniciarArrastre, debeIgnorarClick };
};

// Devuelve las citas con la que se está arrastrando ya en su nuevo horario
// (y, en la vista semana, en su nuevo día), para que las vistas la pinten
// igual que cualquier otra. `original` conserva la cita tal como vino del
// backend: es la que se usa al abrir el detalle o arrancar otro arrastre.
export const aplicarVistaPrevia = (citas, vistaPrevia) =>
  citas.map((cita) => {
    if (!vistaPrevia || cita.idCita !== vistaPrevia.idCita) return { ...cita, original: cita };
    return {
      ...cita,
      fecha: vistaPrevia.fecha,
      hora: minutosAHora(vistaPrevia.inicio),
      duracionMinutos: vistaPrevia.fin - vistaPrevia.inicio,
      original: cita,
      enArrastre: true,
      motivoInvalido: vistaPrevia.motivo,
    };
  });
