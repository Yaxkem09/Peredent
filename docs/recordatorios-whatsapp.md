# Recordatorios de citas por WhatsApp — Peredent

Un día antes de cada cita, el sistema envía al paciente un mensaje de WhatsApp
con la plantilla aprobada `recordatorio_cita` de la WhatsApp Cloud API de Meta.

## Cómo funciona

```
GitHub Actions (cron)            Backend (Somee)                         Meta
9:07 a. m. y 5:07 p. m.  ──►  POST /api/recordatorios/enviar  ──►  WhatsApp Cloud API
hora de Guatemala              header X-Api-Key                    plantilla recordatorio_cita
                               citas de mañana sin recordatorio
```

1. **Cron.** El workflow `.github/workflows/recordatorios-whatsapp.yml` corre
   todos los días a las **9:07 a. m.** y a las **5:07 p. m.** de Guatemala
   (`7 15 * * *` y `7 23 * * *` en UTC; Guatemala es UTC-6 todo el año). La
   corrida de la tarde cubre las citas de mañana agendadas después de la de la
   mañana y reintenta las que fallaron. No se usa un BackgroundService dentro de
   la app porque Somee (hosting compartido) puede dormir o reciclar el proceso.
2. **Endpoint.** `POST /api/recordatorios/enviar?dryRun=false`
   (`RecordatoriosController`). No usa JWT porque lo llama un proceso, no un
   usuario: lo protege el header `X-Api-Key`, comparado en tiempo constante con
   `REMINDERS_API_KEY` (filtro `[RequiereApiKeyRecordatorios]`).
   - `200`: resumen (`RecordatorioResumenDto`). Los fallos de envío individuales
     van en `fallidas`, no como error HTTP.
   - `401` sin cuerpo: falta la key, es incorrecta o el servidor no tiene una configurada.
   - `409`: ya había una ejecución en curso (candado en memoria; la app corre en una sola instancia).
3. **Citas de mañana.** `RecordatorioService` calcula "mañana" con la hora de
   Guatemala (`FechaHoraGuatemala.Ahora()`). `Citas.Fecha_Inicio` se guarda en
   hora local de Guatemala, así que filtra el rango `[mañana 00:00, pasado mañana 00:00)`.
4. **WhatsApp.** `WhatsAppService` envía la plantilla con 3 variables en el cuerpo:

   | Variable | Contenido | Ejemplo |
   |---|---|---|
   | `{{1}}` | Primer nombre + primer apellido | `María González` |
   | `{{2}}` | Fecha (`dddd d 'de' MMMM`, es-GT, minúsculas) | `lunes 28 de septiembre` |
   | `{{3}}` | Hora (`h:mm tt`, InvariantCulture) | `9:00 AM` |

5. **Registro en la cita.** Por cada envío se guarda (después de cada cita):
   - Éxito: `RecordatorioEnviadoEn` (hora de Guatemala) y `RecordatorioMessageId` (el `wamid` de Meta).
   - Fallo: `RecordatorioError` (truncado a 500 caracteres); `RecordatorioEnviadoEn` queda en NULL
     y la cita se reintenta en la siguiente ejecución.

El proceso es **idempotente**: una cita con `RecordatorioEnviadoEn` nunca se
vuelve a enviar, así que ejecutar el workflow varias veces el mismo día es seguro.

## Qué citas reciben recordatorio

Se toman las citas de **mañana** que:

- están en estado **Pendiente** o **Confirmada** (buscados por nombre en el catálogo `EstadoCita`), y
- todavía no tienen `RecordatorioEnviadoEn`.

De esas, se **omiten** (aparecen en el resumen con su motivo, sin enviar nada):

| Motivo | Cuándo |
|---|---|
| `sin consentimiento` | El paciente tiene `AceptaRecordatoriosWhatsApp = 0` (se marca en el formulario del paciente). |
| `teléfono inválido` | `Paciente.Telefono` no se puede normalizar: debe tener 8 dígitos de Guatemala, o 502 + 8 dígitos (se ignoran `+`, espacios y guiones). |

Las citas Atendidas, Canceladas o No Asistió nunca se toman. El teléfono del
encargado (menores de edad) no se usa por ahora. En el Calendario, el modal de
la cita muestra el estado del recordatorio (enviado, error, pendiente o no aplica).

## Configuración

### Variables de entorno del backend

En local van en `backend/.env` (ignorado por git, ver `.env.example`); en
Somee, como variables de entorno del servidor de hosting. **Nunca** se
guardan valores reales en el repositorio.

| Variable | Obligatoria | Descripción |
|---|---|---|
| `WHATSAPP_ENABLED` | No (default `false`) | `true` para enviar de verdad. Con `false` la app arranca sin las demás y los envíos se registran como fallidos ("deshabilitado"). |
| `WHATSAPP_PHONE_NUMBER_ID` | Si `WHATSAPP_ENABLED=true` | Phone Number ID del número remitente (Meta for Developers → WhatsApp → API Setup). No es el número de teléfono. |
| `WHATSAPP_TOKEN` | Si `WHATSAPP_ENABLED=true` | Token de acceso de la Cloud API. En producción, token permanente de un System User. |
| `WHATSAPP_API_VERSION` | No (default `v25.0`) | Versión de la Graph API. |
| `WHATSAPP_TEMPLATE_NAME` | No (default `recordatorio_cita`) | Nombre de la plantilla aprobada. |
| `WHATSAPP_TEMPLATE_LANGUAGE` | No (default `es`) | Código de idioma de la plantilla. |
| `REMINDERS_API_KEY` | Sí, para usar el endpoint | Key que debe enviar el cron en `X-Api-Key`. Si está vacía, el endpoint rechaza todo. Cadena aleatoria larga (p. ej. 64 caracteres hex). |

Si `WHATSAPP_ENABLED=true` y falta `WHATSAPP_PHONE_NUMBER_ID` o
`WHATSAPP_TOKEN`, la app **no arranca** (lanza `InvalidOperationException` con
el nombre de la variable que falta).

Para generar una key nueva sin mostrarla en pantalla (PowerShell, la copia al portapapeles):

```powershell
$b = New-Object byte[] 32; [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b); -join ($b | % { $_.ToString('x2') }) | Set-Clipboard
```

### Secrets de GitHub

En **Settings → Secrets and variables → Actions**:

| Secret | Valor |
|---|---|
| `PEREDENT_API_URL` | URL base de la API en Somee, sin `/api` (p. ej. `https://<sitio>.somee.com`). |
| `RECORDATORIOS_API_KEY` | El mismo valor que `REMINDERS_API_KEY` del servidor de producción. |

Usar una key distinta en local y en producción.

## Probar en local

Requisitos: la base local con las migraciones aplicadas (`dotnet ef database update`
desde `backend/`, o `backend/src/db/PeredentScript_Sprint5.sql`) y la app corriendo:

```bash
cd backend
dotnet run --urls http://localhost:5199
```

### Simulación (dryRun)

`dryRun=true` devuelve lo que se enviaría sin llamar a WhatsApp ni tocar la
base. Los comandos leen la key de `backend/.env` sin mostrarla. **No usar
`curl -v`**: imprime los headers, incluida la key.

```bash
# Git Bash, desde backend/
KEY=$(grep '^REMINDERS_API_KEY=' .env | cut -d= -f2- | tr -d '\r')
curl -s -X POST -H "X-Api-Key: $KEY" "http://localhost:5199/api/recordatorios/enviar?dryRun=true"; echo
unset KEY
```

```powershell
# PowerShell, desde backend\
$key = ((Get-Content .env | Where-Object { $_ -match '^REMINDERS_API_KEY=' }) -split '=', 2)[1].Trim()
Invoke-RestMethod -Method Post -Uri "http://localhost:5199/api/recordatorios/enviar?dryRun=true" -Headers @{ 'X-Api-Key' = $key } | ConvertTo-Json -Depth 5
Remove-Variable key
```

Para que aparezca algo, hace falta una cita de mañana (hora de Guatemala) en
estado Pendiente o Confirmada, de un paciente con `AceptaRecordatoriosWhatsApp = 1`.

> En Development, si el endpoint devuelve 500, la página de error repite los
> headers de la petición (incluida la key). No pegues ese cuerpo en ningún lado.

### Envío real con el número de prueba de Meta

1. En Meta for Developers → la app → **WhatsApp → API Setup**: usa el número de
   prueba (o el de la clínica) y copia su **Phone Number ID**. Genera un token
   (el temporal dura 24 h).
2. En **To**, agrega y verifica el número del teléfono que recibirá la prueba
   (el número de prueba solo envía a destinatarios registrados, máximo 5).
3. Verifica que la plantilla `recordatorio_cita` esté **aprobada** en la cuenta
   de WhatsApp Business, idioma `es`, con las 3 variables en el cuerpo.
4. En `backend/.env`: `WHATSAPP_ENABLED=true`, `WHATSAPP_PHONE_NUMBER_ID` y `WHATSAPP_TOKEN`.
5. En la base local, deja **solo** pacientes de prueba con consentimiento y crea
   una cita de mañana para uno cuyo teléfono sea el registrado en el paso 2.
6. Ejecuta primero `dryRun=true` y confirma que solo aparece esa cita como
   "Por enviar". Luego `dryRun=false`: la cita debe quedar con
   `RecordatorioEnviadoEn` y `RecordatorioMessageId` (`wamid....`). Una
   segunda llamada debe devolver `totalEncontradas: 0`.
7. Confirma la llegada en el teléfono: un `wamid` significa que Meta aceptó el
   mensaje, no que se entregó.

Para repetir la prueba, vuelve a poner en NULL `RecordatorioEnviadoEn`,
`RecordatorioMessageId` y `RecordatorioError` de la cita.

## Cambiar de plantilla

Si la nueva plantilla conserva **las mismas 3 variables en el cuerpo y en el
mismo orden** (nombre, fecha, hora), basta con cambiar `WHATSAPP_TEMPLATE_NAME`
(y `WHATSAPP_TEMPLATE_LANGUAGE` si cambia el idioma) y reiniciar la app; no hay
que tocar código. La plantilla debe estar aprobada en Meta antes del cambio.

Si cambian las variables (cantidad, orden, header con imagen, botones), hay que
ajustar el cuerpo que arma `WhatsAppService` y los formatos de `PlantillaRecordatorio`.

## Si el workflow falla

GitHub avisa por correo si está activado en **Settings → Notifications →
System → Actions** ("Only notify for failed workflows"). Para las ejecuciones
programadas, avisa a quien modificó por última vez la línea `cron` del workflow.

1. Abre **Actions → Recordatorios WhatsApp** → la ejecución fallida y revisa el log:

   | Mensaje | Qué revisar |
   |---|---|
   | `Falta el secret ...` | Crear el secret indicado. |
   | `respondió 401` | `RECORDATORIOS_API_KEY` no coincide con `REMINDERS_API_KEY` del servidor. |
   | `No se pudo conectar ... tras 3 intentos` / `HTTP 5xx` | Que el sitio en Somee esté en línea, `PEREDENT_API_URL` y los logs del servidor (p. ej. migración no aplicada). |
   | `200 pero sin el resumen esperado` | `PEREDENT_API_URL` apunta a algo que no es la API. |
   | `N recordatorio(s) fallaron` | El log lista id de cita y error de Meta (p. ej. código 190 = token vencido, 132001 = plantilla inexistente). Corregir la causa. |

2. **Reejecuta manualmente ese mismo día** (Run workflow, sin marcar dry_run):
   solo se reintentan las citas que fallaron; las ya enviadas no se reenvían. La
   corrida de las 5:07 p. m. también las reintenta. Después de la medianoche de
   Guatemala "mañana" cambia y esas citas ya no se toman.
3. Un `409` solo es un aviso (había otra ejecución en curso) y termina en verde.

El workflow no imprime nombres ni teléfonos de pacientes (solo id de cita y error):
si el repositorio es público, sus logs también lo son.

## Pendientes para producción

- [ ] Aplicar `backend/src/db/PeredentScript_Sprint5.sql` en la base de Somee
      **antes** de desplegar el backend (sin las columnas nuevas, todo endpoint
      que lea Paciente o Citas falla con "Invalid column name").
- [ ] Generar un **token permanente de System User** en Meta Business (el temporal dura 24 h).
- [ ] Registrar el **número de WhatsApp de la clínica** en la cuenta de WhatsApp
      Business y usar su Phone Number ID (el número de prueba solo envía a destinatarios registrados).
- [ ] Configurar en Somee `ASPNETCORE_ENVIRONMENT=Production` (en Development
      los errores 500 devuelven los headers de la petición) y las variables
      `WHATSAPP_*` y `REMINDERS_API_KEY`.
- [ ] Crear los secrets `PEREDENT_API_URL` y `RECORDATORIOS_API_KEY` en GitHub.
- [ ] Hacer merge a `main`: el `schedule` y el botón **Run workflow** solo existen
      con el workflow en la rama por defecto. Primera ejecución manual con `dry_run` marcado.
