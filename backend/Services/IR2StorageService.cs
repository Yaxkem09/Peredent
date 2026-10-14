namespace Peredent.Api.Services;

public interface IR2StorageService
{
    // Retorna el mismo objectKey recibido si la subida fue exitosa; lanza
    // excepción (AmazonS3Exception u otra del SDK) si falla.
    Task<string> SubirArchivoAsync(Stream contenido, string objectKey, string contentType);

    // Con nombreDescarga, la URL fuerza la descarga del archivo con ese nombre
    // (Content-Disposition: attachment) en lugar de abrirlo en el navegador.
    Task<string> GenerarUrlFirmadaAsync(string objectKey, TimeSpan duracion, string? nombreDescarga = null);

    // Contenido completo del objeto (para servirlo a través del backend, p. ej.
    // la vista previa de un .docx, sin depender de CORS en el bucket).
    Task<byte[]> DescargarArchivoAsync(string objectKey);

    Task EliminarArchivoAsync(string objectKey);
}
