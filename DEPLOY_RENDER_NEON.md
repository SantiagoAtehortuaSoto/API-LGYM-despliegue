# Deploy API LGYM (Render + Neon)

## 1) Preparar repositorio
- Sube estos cambios a GitHub.
- Verifica que `.env` no se suba (ya esta ignorado).

## 2) Crear base de datos en Neon
- En Neon, crea un proyecto PostgreSQL.
- Copia la cadena de conexion (`DATABASE_URL`) con `sslmode=require`.

## 3) Desplegar API en Render
- En Render, crea un servicio `Web Service` desde tu repo.
- Puedes usar `render.yaml` (Blueprint) o configurar manualmente:
  - Build Command: `npm install`
  - Start Command: `npm start`
  - Health Check Path: `/ping`

## 4) Variables de entorno en Render
- Configura estas variables:
  - `DATABASE_URL` = cadena de Neon
  - `DB_SSL=true`
  - `DB_SSL_REJECT_UNAUTHORIZED=true`
  - `DB_SYNC_ALTER=false`
  - `AUTH_DEBUG=false` (cambialo temporalmente a `true` solo para diagnosticar login/token)
  - `SECRET_KEY`
  - `EMAIL_USER`
  - `EMAIL_PASS`
  - `BUSINESS_EMAIL`
  - `USER_PENDING_STATE_ID=2`
  - `USER_ACTIVE_STATE_ID=1`
  - `DEFAULT_ROLE_ID=33`
  - `ADMIN_ROLE_ID=32`
  - `ADMIN_ROLE_NAME=Administrador`
  - `ADMIN_USER_ID` (opcional)
  - `CORS_ORIGINS=https://TU-FRONT.onrender.com`
  - `CORS_ALLOW_CREDENTIALS=false` (si usas `localStorage` o header `Authorization`)
  - `CORS_ALLOW_CREDENTIALS=true` solo si realmente usas cookies cross-origin y `CORS_ORIGINS` NO es `*`

## 4.1) Diagnostico rapido de token en Render
- Si el login funciona pero las rutas autenticadas responden `No se proporciono un token`, activa temporalmente `AUTH_DEBUG=true`.
- Con eso, el backend registrara:
  - ruta y metodo solicitados
  - `origin`, `referer` y `host`
  - si llego `Authorization` u otros headers equivalentes
  - si llego un token por `query`, `body` o `cookie`
- Desactiva `AUTH_DEBUG` despues de revisar logs.

## 5) Probar API desplegada
- Health: `GET https://TU-API.onrender.com/ping`
- Agenda: `POST https://TU-API.onrender.com/agenda`
- Asistencia clientes: `GET https://TU-API.onrender.com/asistencia_clientes` (se llena al crear agenda)
- Asistencia empleado: `POST https://TU-API.onrender.com/asistencia_empleado`

## 6) Seguridad recomendada
- Rota las credenciales que tengas expuestas en `.env` local.
- Mantener `DB_SYNC_ALTER=false` en produccion.
