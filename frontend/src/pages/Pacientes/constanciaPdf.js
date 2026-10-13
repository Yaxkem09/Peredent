import { constanciasService } from '../../services/constancias.service';

// Abre el PDF en otra pestaña para verlo o imprimirlo. La pestaña se abre
// antes de la llamada para que el navegador no la bloquee como ventana
// emergente; si aun así se bloquea, se descarga el archivo.
export const abrirPdfConstancia = async (idPaciente, idConstancia, ventanaPrevia) => {
  const ventana = ventanaPrevia ?? window.open('', '_blank');
  if (ventana) {
    ventana.document.title = 'Generando constancia…';
    ventana.document.body.innerText = 'Generando la constancia, espera un momento…';
  }

  try {
    const respuesta = await constanciasService.descargarPdf(idPaciente, idConstancia);
    const url = URL.createObjectURL(new Blob([respuesta.data], { type: 'application/pdf' }));
    if (ventana) {
      ventana.location.href = url;
    } else {
      const enlace = document.createElement('a');
      enlace.href = url;
      enlace.download = 'constancia.pdf';
      document.body.appendChild(enlace);
      enlace.click();
      enlace.remove();
    }
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  } catch (err) {
    ventana?.close();
    throw err;
  }
};
