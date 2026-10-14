# Recordatorios de citas por WhatsApp — Peredent

Un día antes de cada cita, el sistema envía al paciente un mensaje de WhatsApp
con la plantilla aprobada `recordatorio_cita` de la WhatsApp Cloud API de Meta.
La plantilla tiene dos botones de respuesta rápida ("Sí asistiré" y "Modificar
mi cita"); la respuesta del paciente llega por un webhook, se registra en la
cita y se le contesta automáticamente (ver [Respuestas del paciente](#respuestas-del-paciente)).

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
la cita muestra el estado del recordatorio (enviado, error, pendiente o no aplica)
y, si el paciente respondió, su respuesta.

## Respuestas del paciente

### Botones de la plantilla

`recordatorio_cita` tiene dos botones de **respuesta rápida**:

| Botón | Qué significa | Se guarda en `Citas.RespuestaPaciente` |
|---|---|---|
| `Sí asistiré` | Confirma su asistencia | `Confirmo` |
| `Modificar mi cita` | Quiere cambiar la cita | `Modificar` |

Cuando el paciente toca un botón, Meta envía una notificación al webhook con un
mensaje de tipo `button`: `button.text`/`button.payload` traen el texto del botón
y `context.id` el `wamid` del recordatorio al que responde (que se guardó en
`Citas.RecordatorioMessageId` al enviarlo). Los textos de los botones, los
valores guardados y los mensajes de vuelta están en un solo lugar:
`backend/Helpers/RespuestaRecordatorioWhatsApp.cs`. **Si se cambia el texto de
un botón en Meta, hay que cambiarlo también ahí.**

### Webhook

`api/whatsapp/webhook` (`WhatsAppWebhookController`), sin JWT porque lo llaman
los servidores de Meta:

- **GET (verificación).** Al configurar el webhook en Meta, Meta llama con
  `hub.mode=subscribe`, `hub.verify_token` y `hub.challenge`. Si el token coincide
  con `WHATSAPP_WEBHOOK_VERIFY_TOKEN` (tiempo constante), responde el challenge en
  texto plano; si no, `403`.
- **POST (notificaciones).** Cada notificación trae el header
  `X-Hub-Signature-256: sha256=<HMAC-SHA256 del cuerpo crudo con el App Secret>`.
  El filtro `[ValidarFirmaWhatsApp]` lo valida **antes** de deserializar; si falta
  o no coincide con `WHATSAPP_APP_SECRET`, responde `401` sin cuerpo y no procesa
  nada. Con firma válida, `WhatsAppWebhookService` procesa el payload y el
  endpoint responde `200` aunque el procesamiento falle (se registra en el log),
  para que Meta no reintente la misma notificación durante horas.

Si falta `WHATSAPP_APP_SECRET` o `WHATSAPP_WEBHOOK_VERIFY_TOKEN`, la app arranca
igual, pero el webhook rechaza todo y lo registra como error en el log.

### Reglas de procesamiento

Por cada mensaje de tipo `button`:

1. Busca la cita cuyo `RecordatorioMessageId` es el `context.id`. Si no hay, se ignora (advertencia en el log).
2. Si `RespuestaMessageId` ya es el id de este mensaje, es un webhook duplicado y se ignora.
3. Si el botón no es ninguno de los dos, se ignora (advertencia en el log).
4. Aplica la regla y responde al paciente con texto libre:

| Situación | Estado de la cita | Se registra la respuesta | Mensaje al paciente |
|---|---|---|---|
| La cita ya empezó o pasó (o está Atendida / No Asistió) | Sin cambios | No | Cita pasada |
| "Sí asistiré" con la cita Pendiente | Pasa a **Confirmada** | Sí (`Confirmo`) | Confirmó |
| "Sí asistiré" con la cita Confirmada | Sin cambios | Sí (`Confirmo`) | Confirmó |
| "Sí asistiré" con la cita Cancelada | Sin cambios (no se reactiva) | No | Cita cancelada |
| "Modificar mi cita" | Sin cambios | Sí (`Modificar`) | Modificar (teléfono y horario) |

Mensajes (con `{telefono}` = `CLINICA_TELEFONO` y `{horario}` = `CLINICA_HORARIO`):

| Mensaje | Texto |
|---|---|
| Confirmó | ¡Gracias por confirmar! Le esperamos en su cita. |
| Modificar | Para modificar su cita, llámenos al {telefono}. *Horario de atención:* {horario} |
| Cita pasada | Esta cita ya pasó. Si necesita una nueva cita, llámenos al {telefono}. |
| Cita cancelada | Esta cita fue cancelada. Si desea reagendar, llámenos al {telefono}. |

- Cuando se registra, se guardan `RespuestaPaciente`, `RespuestaPacienteEn` (hora
  de Guatemala) y `RespuestaMessageId`. Si el paciente toca un botón y luego el
  otro, **la última respuesta válida reemplaza a la anterior** (confirmar después
  de "Modificar" pasa la cita a Confirmada; "Modificar" después de confirmar no
  cambia el estado).
- El cambio se guarda **antes** de responder: si el mensaje de vuelta falla, se
  registra en el log y la cita no se revierte.
- El mensaje de vuelta es texto libre, que Meta solo permite dentro de las 24 h
  siguientes al último mensaje del paciente (siempre se cumple al responder un botón).
- Los mensajes de otros tipos (texto escrito, imágenes, etc.) y los `statuses`
  (entregado, leído) se ignoran con un log Debug.
- En el modal de la cita del Calendario, "Confirmo" se muestra como una línea
  verde y "Modificar" como un aviso ámbar: **la secretaria debe dar seguimiento**
  si el paciente no llama.
- En las tarjetas de las citas del Calendario (vistas Día, Semana y Mes, y el
  panel lateral del Mes) aparece un **ícono ámbar de teléfono** junto al nombre
  del paciente mientras la respuesta sea "Modificar", la cita **no haya pasado**
  y **no esté Cancelada** (`IndicadorModificar.jsx`).

### Reprogramar una cita

Cuando una cita cambia de **fecha u hora de inicio** (desde el modal o
arrastrándola en el Calendario; ambos pasan por `CitaService.ActualizarAsync`),
se limpian `RecordatorioEnviadoEn`, `RecordatorioMessageId`, `RecordatorioError`,
`RespuestaPaciente`, `RespuestaPacienteEn` y `RespuestaMessageId`:

- La cita vuelve a recibir un recordatorio para su nueva fecha (si queda para
  mañana, entra en la siguiente corrida del workflow).
- La respuesta anterior se descarta, así que el aviso y el ícono de "Modificar"
  desaparecen: la reprogramación es justamente la atención que pedía el paciente.
- Si el paciente toca después un botón del recordatorio **viejo**, el webhook ya
  no encuentra la cita por ese `context.id` y lo ignora.

Si solo cambian otros datos (notas, odontólogo, estado o la duración, sin mover
la hora de inicio), no se limpia nada. Una reprogramación rechazada (por ejemplo,
por conflicto de horario) tampoco cambia nada.

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
| `WHATSAPP_APP_SECRET` | Sí, para el webhook | App Secret de la app de Meta (Meta for Developers → la app → App settings → Basic). Valida la firma `X-Hub-Signature-256`. Si falta, el webhook rechaza todo. |
| `WHATSAPP_WEBHOOK_VERIFY_TOKEN` | Sí, para el webhook | Texto secreto aleatorio que se escribe también en Meta al configurar el webhook. Solo se usa en la verificación (GET). Si falta, la verificación responde 403. |
| `CLINICA_TELEFONO` | No (default `7755-1080`) | Teléfono de la clínica en los mensajes de vuelta al paciente. |
| `CLINICA_HORARIO` | No (default: horario de lunes a sábado) | Horario de atención en el mensaje de "Modificar". Usar `\n` para los saltos de línea. |

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
desde `backend/`, o `backend/src/db/PeredentScript_Sprint5_RecordatoriosWhatsApp.sql`) y la app corriendo:

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

### Webhook con un payload firmado (curl)

Sin depender de Meta: se simula la notificación firmándola con el App Secret
del `.env`. Requisitos: `WHATSAPP_APP_SECRET` y `WHATSAPP_WEBHOOK_VERIFY_TOKEN`
en `backend/.env`, la app corriendo (`dotnet run --urls http://localhost:5199`)
y, para ver el efecto en una cita, una cita de mañana Pendiente cuyo
`RecordatorioMessageId` sea el `context.id` del payload (p. ej.
`UPDATE Citas SET RecordatorioMessageId = 'wamid.PRUEBA1' WHERE ID_Cita = <id>`).

```bash
# Git Bash, desde backend/
SECRET=$(grep '^WHATSAPP_APP_SECRET=' .env | cut -d= -f2- | tr -d '\r')
VTOKEN=$(grep '^WHATSAPP_WEBHOOK_VERIFY_TOKEN=' .env | cut -d= -f2- | tr -d '\r')
URL=http://localhost:5199/api/whatsapp/webhook

# Cuerpo en un archivo: la firma se calcula sobre esos bytes exactos.
cat > webhook-prueba.json <<'EOF'
{"object":"whatsapp_business_account","entry":[{"id":"1","changes":[{"field":"messages","value":{"messaging_product":"whatsapp","messages":[{"context":{"from":"15550000000","id":"wamid.PRUEBA1"},"from":"50251234567","id":"wamid.RESPUESTA1","timestamp":"1760290000","type":"button","button":{"payload":"Sí asistiré","text":"Sí asistiré"}}]}}]}]}
EOF
SIG=$(openssl dgst -sha256 -hmac "$SECRET" webhook-prueba.json | sed 's/^.*= //')

# Firmado: 200 y la cita pasa a Confirmada con RespuestaPaciente = 'Confirmo'
curl -s -o /dev/null -w '%{http_code}\n' -X POST -H 'Content-Type: application/json' \
  -H "X-Hub-Signature-256: sha256=$SIG" --data-binary @webhook-prueba.json "$URL"

# Repetirlo: 200, pero no se procesa de nuevo (webhook duplicado)
# Firma incorrecta: 401
curl -s -o /dev/null -w '%{http_code}\n' -X POST -H 'Content-Type: application/json' \
  -H 'X-Hub-Signature-256: sha256=0000' --data-binary @webhook-prueba.json "$URL"

# Verificación de Meta: imprime 1158201444; con otro token, 403
curl -s "$URL?hub.mode=subscribe&hub.verify_token=$VTOKEN&hub.challenge=1158201444"; echo

rm webhook-prueba.json; unset SECRET VTOKEN SIG
```

- Usar `--data-binary` (no `-d`, que altera los saltos de línea y rompe la firma).
- Para "Modificar", cambia el botón por `Modificar mi cita` y el `id` del mensaje
  (con el mismo `id` se trata como duplicado).
- Con `WHATSAPP_ENABLED=false` la cita se actualiza igual y el mensaje de vuelta
  se registra como no enviado ("deshabilitado"); con `true`, el texto se envía de
  verdad al número del campo `from`.
- En Development, la línea `Request starting GET ...?hub.verify_token=...` del
  log de ASP.NET Core muestra el verify token (en Production no, por el nivel de log).

## Cambiar de plantilla

Si la nueva plantilla conserva **las mismas 3 variables en el cuerpo y en el
mismo orden** (nombre, fecha, hora), basta con cambiar `WHATSAPP_TEMPLATE_NAME`
(y `WHATSAPP_TEMPLATE_LANGUAGE` si cambia el idioma) y reiniciar la app; no hay
que tocar código. La plantilla debe estar aprobada en Meta antes del cambio.

Si cambian las variables (cantidad, orden, header con imagen), hay que ajustar el
cuerpo que arma `WhatsAppService` y los formatos de `PlantillaRecordatorio`. Si
cambia el **texto de los botones**, hay que actualizar `BotonConfirmar` y
`BotonModificar` en `RespuestaRecordatorioWhatsApp`; si no, las respuestas se
ignoran como "botón no reconocido".

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

- [ ] Aplicar `backend/src/db/PeredentScript_Sprint5_RecordatoriosWhatsApp.sql` en la base de Somee
      **antes** de desplegar el backend (sin las columnas nuevas, todo endpoint
      que lea Paciente o Citas falla con "Invalid column name"), además de los
      scripts de develop que falten (`PeredentScript_Sprint4_AnulacionAbonos.sql`,
      `PeredentScript_Sprint4_Consentimientos.sql`, `PeredentScript_Sprint5.sql`).
- [ ] Ejecutar todos los scripts con **SSMS** o con **`sqlcmd -f 65001`**: sin eso,
      los textos con acentos se guardan mal (p. ej. "Extracción de terceras
      molares") y el código que los busca por nombre deja de encontrarlos.
- [ ] Generar un **token permanente de System User** en Meta Business (el temporal dura 24 h).
- [ ] Registrar el **número de WhatsApp de la clínica** en la cuenta de WhatsApp
      Business y usar su Phone Number ID (el número de prueba solo envía a destinatarios registrados).
- [ ] Configurar en Somee `ASPNETCORE_ENVIRONMENT=Production` (en Development
      los errores 500 devuelven los headers de la petición) y las variables
      `WHATSAPP_*` (incluidas `WHATSAPP_APP_SECRET` y `WHATSAPP_WEBHOOK_VERIFY_TOKEN`),
      `REMINDERS_API_KEY` y, si cambian los datos de la clínica, `CLINICA_TELEFONO`
      y `CLINICA_HORARIO`.
- [ ] En Meta for Developers → la app → **WhatsApp → Configuration → Webhook**:
      configurar la **Callback URL** `https://<sitio>.somee.com/api/whatsapp/webhook`
      (Meta exige HTTPS con certificado válido) y el **Verify token** (el mismo
      valor que `WHATSAPP_WEBHOOK_VERIFY_TOKEN`). Al guardar, Meta hace el GET de
      verificación: la app ya debe estar desplegada con esas variables.
- [ ] En **Webhook fields**, **suscribir el campo `messages`** (trae las respuestas
      de los botones y los estados de los mensajes).
- [ ] **Publicar la app en Meta** (modo *Live*): en modo desarrollo los webhooks
      solo llegan para los números de prueba registrados.
- [ ] Crear los secrets `PEREDENT_API_URL` y `RECORDATORIOS_API_KEY` en GitHub.
- [ ] Hacer merge a `main`: el `schedule` y el botón **Run workflow** solo existen
      con el workflow en la rama por defecto. Primera ejecución manual con `dry_run` marcado.
