using Amazon.Runtime;
using Amazon.S3;
using Amazon.S3.Model;
using Microsoft.Extensions.Options;
using Peredent.Api.Options;

namespace Peredent.Api.Services;

public class R2StorageService : IR2StorageService, IDisposable
{
    private readonly IAmazonS3 _s3Client;
    private readonly string _bucketName;
    private readonly Protocol _protocoloPresign;

    public R2StorageService(IOptions<R2Options> opciones)
    {
        var r2 = opciones.Value;
        _bucketName = r2.BucketName;

        // UseHttp NO controla el esquema del presigned URL en AWSSDK.S3
        // 4.0.103.3 (verificado manualmente): el builder de la URL firmada
        // siempre usa https salvo que se fije GetPreSignedUrlRequest.Protocol
        // explícitamente. Se deriva del endpoint configurado (http para MinIO
        // local, https para R2 real) y se aplica en GenerarUrlFirmadaAsync.
        _protocoloPresign = new Uri(r2.Endpoint).Scheme == Uri.UriSchemeHttp
            ? Protocol.HTTP
            : Protocol.HTTPS;

        var s3Config = new AmazonS3Config
        {
            ServiceURL = r2.Endpoint,
            ForcePathStyle = true,
            // R2 no soporta el streaming de checksums ni el chunked encoding que
            // AWSSDK.S3 activa por defecto desde 3.7.113/4.x (validado manualmente
            // con R2ConnectionTest, ver docs/cloudflare-r2.md).
            RequestChecksumCalculation = RequestChecksumCalculation.WHEN_REQUIRED,
            ResponseChecksumValidation = ResponseChecksumValidation.WHEN_REQUIRED,
        };

        _s3Client = new AmazonS3Client(r2.AccessKeyId, r2.SecretAccessKey, s3Config);
    }

    public async Task<string> SubirArchivoAsync(Stream contenido, string objectKey, string contentType)
    {
        await _s3Client.PutObjectAsync(new PutObjectRequest
        {
            BucketName = _bucketName,
            Key = objectKey,
            InputStream = contenido,
            ContentType = contentType,
            // Ver comentario en AmazonS3Config: R2 no soporta chunked encoding.
            UseChunkEncoding = false,
        });

        return objectKey;
    }

    public Task<string> GenerarUrlFirmadaAsync(string objectKey, TimeSpan duracion)
    {
        var request = new GetPreSignedUrlRequest
        {
            BucketName = _bucketName,
            Key = objectKey,
            Verb = HttpVerb.GET,
            Protocol = _protocoloPresign,
            Expires = DateTime.UtcNow.Add(duracion),
        };

        return _s3Client.GetPreSignedURLAsync(request);
    }

    public async Task EliminarArchivoAsync(string objectKey)
    {
        await _s3Client.DeleteObjectAsync(_bucketName, objectKey);
    }

    public void Dispose()
    {
        _s3Client.Dispose();
        GC.SuppressFinalize(this);
    }
}
