# ScanAccess

Control de acceso móvil para iPhone: Code 39/Code 128/EAN, registro manual de invitados, correcciones de asistencia y sincronización con Google Sheets. Aplicación Next.js para Vercel con PostgreSQL (Supabase) y una cuenta de servicio de Google.

## Desplegar en Vercel

1. Conectar este repositorio y seleccionar `main`.
2. Root Directory: raíz del repositorio (`./`). Framework: **Next.js**. Node.js: **22.x**.
3. La configuración versionada usa `npm ci`, `npm run build` y `.next`. No usar `dist` ni los antiguos comandos de Cloudflare/Vinext.
4. Crear un proyecto Supabase y ejecutar `db/postgres/001_initial.sql` en SQL Editor. Alternativamente ejecutar `npm run db:migrate` con `DATABASE_URL` configurada en `.env.local`.
5. Añadir las variables de `.env.example` a Vercel > Project > Settings > Environment Variables (Production; también Preview si se va a usar con datos separados). No subir secretos a GitHub.
6. Hacer Redeploy después de guardar las variables. Abrir `/login`, entrar como administrador y activar la sincronización.

El código se puede compilar sin credenciales. Hasta configurar los servicios, la pantalla de acceso mostrará lo que falta y no permitirá consultar asistentes.

## Variables

| Nombre | Valor |
| --- | --- |
| `DATABASE_URL` | Cadena PostgreSQL de Supabase > Connect > Transaction pooler. Sustituir y codificar correctamente la contraseña. |
| `DATABASE_CA_CERT` | Certificado CA PEM del proveedor si la cadena TLS requiere una CA específica. No se desactiva la validación TLS. |
| `SESSION_SECRET` | Secreto aleatorio de al menos 32 caracteres; por ejemplo generado con `openssl rand -hex 32`. |
| `OPERATOR_PASSWORD` | Contraseña de al menos 12 caracteres para el equipo de acceso. |
| `ADMIN_PASSWORD` | Otra contraseña de al menos 12 caracteres para gestión y correcciones. |
| `GOOGLE_CLIENT_EMAIL` | Email de la cuenta de servicio de Google Cloud. |
| `GOOGLE_PRIVATE_KEY` | Campo `private_key` de la clave JSON de esa cuenta. Acepta saltos de línea reales o `\n`. |
| `GOOGLE_SPREADSHEET_ID` | `1DV4dBOpA3dProCWhvjq_JbqRonr0_Nc_zkDoBLkHyeE` |
| `GOOGLE_SHEET_NAME` | `Worksheet` |
| `GOOGLE_SHEET_ID` | `1799967749` (ID numérico de la pestaña, no del documento). |

Solo para una base de pruebas local sin TLS se admite `DATABASE_SSL=disable`. No configurarlo en Vercel.

## Google Sheets

En Google Cloud, habilitar **Google Sheets API**, crear una cuenta de servicio y su clave JSON. Compartir únicamente el documento del evento con `GOOGLE_CLIENT_EMAIL` como **Editor**. No se necesita delegación de todo el dominio. Guardar la clave solo como variable del servidor.

Conservar las columnas de la pestaña:

| A | B | C | D | E | F |
| --- | --- | --- | --- | --- | --- |
| nombre | cod | Asistencia | Hora de entrada (UTC) | Puesto | ID invitado |

`cod` puede estar vacío para invitados. La app asigna un ID estable en F durante la sincronización; conservarlo al ordenar o renombrar invitados. Se leen como máximo 10.000 filas. `S35060E` en una acreditación Code 39 se relaciona con el código `35060`.

La asistencia se confirma cuando se guarda en PostgreSQL. Mientras una sesión mantiene la sincronización activada, la app envía los cambios a Sheets cada 15 segundos. Las correcciones también se envían. Si Google falla, el registro sigue guardado y se muestra el error; reactivar la sincronización revisa el estado de la hoja antes de reintentar. Antes de cerrar el último móvil, pulsar Actualizar y comprobar que no quedan cambios pendientes. No hay un proceso de sincronización autónomo cuando todos los móviles están cerrados.

Los nombres y códigos se editan en Sheets; la asistencia se gestiona en la app. Una corrección realizada en la app tiene prioridad sobre un valor antiguo de la hoja. Evitar reordenar filas mientras se está enviando un lote de cambios.

## Acceso y permisos

- **Operador:** consultar el evento, escanear, registrar manualmente y sincronizar Sheets.
- **Administrador:** lo anterior más importar eventos y anular asistencias.
- Sesiones de 12 horas en cookies HttpOnly/Secure/SameSite. Cambiar contraseñas o SESSION_SECRET invalida sesiones existentes.
- Las rutas API validan sesión y origen. PostgreSQL tiene RLS activado; las credenciales de base de datos nunca se entregan al navegador.
- Cada móvil puede poner su nombre de puesto, por ejemplo «Entrada 1».

## Datos de la versión anterior

La versión Sites publicada conserva su base de datos. Cambiar el alojamiento no mueve automáticamente esa base a Supabase. La nueva app reconstruye el evento principal a partir de la hoja y conserva las asistencias ya sincronizadas.

Antes de pasar todos los móviles a Vercel, finalizar la sincronización en la versión anterior. No usar ambos sistemas para registrar el mismo evento simultáneamente. Los eventos importados por Excel que solo existan en la base anterior necesitan una transferencia aparte; no se eliminan de Sites.

## Desarrollo y pruebas

```sh
npm ci
cp .env.example .env.local
# Completar las variables en el archivo local, que está ignorado por Git.
npm run db:migrate
npm run dev
```

```sh
npm test
npm run typecheck
npm run build
```

`npm test` usa PostgreSQL embebido (PGlite) sin tocar Google Sheets ni datos de producción. Comprueba concurrencia, anulaciones, IDs de invitados, bloqueo de sincronización, RLS y firma de sesiones. Las pruebas HTTP `tests/integration.mjs` y `tests/corrections.mjs` requieren un servidor local, una base de pruebas y `TEST_ADMIN_PASSWORD`; no aceptan una URL de producción.

## Verificación antes del evento

Probar en dos iPhone: entrada por cámara, mismo código simultáneo, invitado sin código, anulación por administrador, reentrada y confirmación de cada cambio en Google Sheets. Probar también la pérdida de conexión. Las compilaciones y pruebas de base de datos no sustituyen la prueba de cámara real.
