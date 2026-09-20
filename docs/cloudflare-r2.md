# Configuración de Cloudflare R2 — Peredent

## Bucket

- **Nombre:** `peredent-panoramicas`
- **Región:** Automática (Eastern North America)
- **Clase de almacenamiento:** Standard

## Política de acceso

- El bucket es **privado**: no tiene acceso público habilitado.
- El único punto de acceso autorizado es el **backend** (ASP.NET Core),
  mediante un Account API Token de Cloudflare con permisos
  `Object Read & Write`, restringido únicamente al bucket
  `peredent-panoramicas`.
- El **frontend nunca se conecta directamente a R2**. Toda subida, lectura
  y eliminación de archivos pasa por la API del backend.
- Para que el frontend visualice las imágenes, el backend genera **URLs
  prefirmadas (presigned URLs)** de corta duración (15–30 minutos). El
  bucket no se expone públicamente en ningún momento.

## Credenciales

- Las credenciales (`Access Key ID`, `Secret Access Key`, `Endpoint`) se
  almacenan como variables de entorno / User Secrets.
- **Nunca** se guardan en el código fuente ni se suben al repositorio.
- En desarrollo local se usa `dotnet user-secrets`.
- En producción (Somee) se configuran como variables de entorno del
  servidor de hosting.

## Alcance del token

| Campo | Valor |
|---|---|
| Tipo de token | Account API Token |
| Permisos | Object Read & Write |
| Buckets | Solo `peredent-panoramicas` (no aplica a toda la cuenta) |
| TTL | Forever |
| Restricción de IP | No configurada (pendiente de evaluar para producción) |

## Formatos de archivo permitidos

- Imágenes: `JPG`, `PNG`
- Tamaño máximo por archivo: a definir en el backend (recomendado 10–15 MB)

## Nota técnica: compatibilidad AWS SDK con R2

Al usar AWSSDK.S3 contra Cloudflare R2, es necesario configurar el
AmazonS3Config con estas propiedades, o la subida de archivos falla
con errores de tipo "STREAMING-AWS4-HMAC-SHA256-PAYLOAD not implemented":

    RequestChecksumCalculation = Amazon.Runtime.RequestChecksumCalculation.WHEN_REQUIRED,
    ResponseChecksumValidation = Amazon.Runtime.ResponseChecksumValidation.WHEN_REQUIRED

Adicionalmente, `UseChunkEncoding = false` debe configurarse en cada
`PutObjectRequest` (no en `AmazonS3Config`), ya que en la versión actual
del SDK (4.0.103.3) esa propiedad vive a nivel de request, no de config.

Esto se debe a que R2 no soporta el modo de checksums/chunked encoding
que las versiones recientes del SDK de AWS activan por defecto.

## Responsable

- Configuración inicial realizada por: _(completar con tu nombre)_
- Fecha: _(completar)_
