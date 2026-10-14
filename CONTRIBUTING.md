Aquí va la guía de contribución explicando cómo colaborar, estándares de código, proceso de pull requests y convenciones de commits.

## Documentación de features

- [Recordatorios de citas por WhatsApp](docs/recordatorios-whatsapp.md): funcionamiento, configuración, pruebas y pasos para producción.
- [Configuración de Cloudflare R2](docs/cloudflare-r2.md)

## Esquema de base de datos: scripts SQL + EF Migrations

El esquema combina dos mecanismos:

- **Scripts SQL por sprint** en `backend/src/db/` (`ScriptDBCreacion.sql`, `PeredentScript_Sprint2.sql` ... ). Crearon la mayoría de tablas (Paciente, Citas, Recetario, etc.) y se ejecutan a mano.
- **EF Core Migrations** en `backend/Migrations/`, desde `AddPanoramicas`. Las migraciones `SincronizarSnapshotConScriptsSprint2a4` y `SincronizarSnapshotConScriptsSprint4a5` están vacías a propósito: solo ponen el snapshot al día con lo que crearon los scripts.

> **Codificación al ejecutar scripts SQL:** los scripts están en UTF-8. Ejecútalos con **SSMS** o con **`sqlcmd -f 65001`**. Sin `-f 65001`, `sqlcmd` los lee con la codificación de Windows y los textos con acentos o eñes se guardan mal (por ejemplo, "Extracción" queda como "ExtracciÃ³n"). Eso no es solo visual: el código que busca esos textos por nombre deja de encontrarlos.

Antes de crear una migración nueva, verificar que el snapshot esté sincronizado con el modelo (desde `backend/`):

```bash
dotnet ef migrations has-pending-model-changes
```

Debe responder *"No changes have been made to the model since the last migration"*. Si reporta cambios que tú no hiciste (tablas o columnas creadas por un script), no generes la migración encima: sincroniza primero el snapshot con una migración vacía, igual que `SincronizarSnapshotConScriptsSprint2a4`. Después de crear la migración, revisa que solo contenga tus cambios y regenera el script idempotente para la base de producción (ver cabecera de `PeredentScript_Sprint5_RecordatoriosWhatsApp.sql`).
