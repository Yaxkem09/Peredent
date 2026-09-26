Aquí va la guía de contribución explicando cómo colaborar, estándares de código, proceso de pull requests y convenciones de commits.

## Esquema de base de datos: scripts SQL + EF Migrations

El esquema combina dos mecanismos:

- **Scripts SQL por sprint** en `backend/src/db/` (`ScriptDBCreacion.sql`, `PeredentScript_Sprint2.sql` ... ). Crearon la mayoría de tablas (Paciente, Citas, Recetario, etc.) y se ejecutan a mano.
- **EF Core Migrations** en `backend/Migrations/`, desde `AddPanoramicas`. La migración `SincronizarSnapshotConScriptsSprint2a4` está vacía a propósito: solo pone el snapshot al día con lo que crearon los scripts.

Antes de crear una migración nueva, verificar que el snapshot esté sincronizado con el modelo (desde `backend/`):

```bash
dotnet ef migrations has-pending-model-changes
```

Debe responder *"No changes have been made to the model since the last migration"*. Si reporta cambios que tú no hiciste (tablas o columnas creadas por un script), no generes la migración encima: sincroniza primero el snapshot con una migración vacía, igual que `SincronizarSnapshotConScriptsSprint2a4`. Después de crear la migración, revisa que solo contenga tus cambios y regenera el script idempotente para la base de producción (ver cabecera de `PeredentScript_Sprint5.sql`).
