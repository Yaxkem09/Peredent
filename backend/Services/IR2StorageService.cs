namespace Peredent.Api.Services;

public interface IR2StorageService
{
    // Retorna el mismo objectKey recibido si la subida fue exitosa; lanza
    // excepción (AmazonS3Exception u otra del SDK) si falla.
    Task<string> SubirArchivoAsync(Stream contenido, string objectKey, string contentType);

    Task<string> GenerarUrlFirmadaAsync(string objectKey, TimeSpan duracion);

    Task EliminarArchivoAsync(string objectKey);
}
