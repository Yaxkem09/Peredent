// Abre directamente el diálogo de impresión del navegador con un PDF (Blob)
// generado por el backend, sin descargarlo: lo carga en un iframe oculto y
// llama a print(). Si el navegador no permite imprimir desde el iframe, abre
// el PDF en otra pestaña para imprimirlo desde ahí.
export const imprimirPdf = (blob) => {
  const url = URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }));
  const iframe = document.createElement('iframe');

  // No se usa display:none: algunos navegadores no cargan/imprimen el PDF así.
  Object.assign(iframe.style, {
    position: 'fixed',
    right: '0',
    bottom: '0',
    width: '0',
    height: '0',
    border: '0',
    visibility: 'hidden',
  });

  iframe.onload = () => {
    try {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
    } catch {
      window.open(url, '_blank');
    }
  };

  iframe.src = url;
  document.body.appendChild(iframe);

  // El diálogo de impresión no avisa de forma confiable cuándo se cierra; se
  // limpia después de un rato, cuando ya se imprimió o se canceló.
  setTimeout(() => {
    iframe.remove();
    URL.revokeObjectURL(url);
  }, 120000);
};
