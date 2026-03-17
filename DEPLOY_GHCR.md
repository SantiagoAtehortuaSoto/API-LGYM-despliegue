# Deploy API LGYM con GHCR

## Recomendacion de estructura

No lo montes en otra rama del repo del front.

La estructura mas limpia es:

- Repo 1: `LGYM-front-despliegue`
- Repo 2: `LGYM-api` o `API-LGYM`

Cada repo publica su propia imagen:

- Front: `ghcr.io/TU-USUARIO/LGYM-front-despliegue`
- API: `ghcr.io/TU-USUARIO/LGYM-api`

## Lo que ya queda listo en este repo

- `Dockerfile` para correr la API en Node 20
- `.dockerignore` para builds mas livianos
- Workflow de GitHub Actions en `.github/workflows/publish-ghcr.yml`

## Como subirlo a un repo separado

1. Crea un repo nuevo en GitHub para la API.
2. Desde esta carpeta, apunta el remoto a ese repo:

```powershell
git remote add origin https://github.com/TU-USUARIO/LGYM-api.git
git branch -M main
git add .
git commit -m "chore: prepare API for Docker and GHCR"
git push -u origin main
```

Si ya existe un remoto distinto, usa:

```powershell
git remote remove origin
git remote add origin https://github.com/TU-USUARIO/LGYM-api.git
git branch -M main
git push -u origin main
```

## Publicacion en GHCR

Al hacer push a `main` o `master`, GitHub Actions publicara la imagen en:

```text
ghcr.io/TU-USUARIO/TU-REPO
```

Tambien puedes lanzarlo manualmente desde `Actions > Publish GHCR`.

## Variables que necesita la API

Como minimo:

- `PORT`
- `DATABASE_URL` o `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASS`, `DB_NAME`
- `DB_SSL`
- `DB_SSL_REJECT_UNAUTHORIZED`
- `SECRET_KEY`
- `EMAIL_USER`
- `EMAIL_PASS`
- `BUSINESS_EMAIL`
- `USER_PENDING_STATE_ID`
- `USER_ACTIVE_STATE_ID`
- `DEFAULT_ROLE_ID`
- `ADMIN_ROLE_ID`
- `ADMIN_ROLE_NAME`

## Probar la imagen en local

```powershell
docker build -t lgym-api:local .
docker run --rm -p 3000:3000 --env-file .env lgym-api:local
```

## Ejecutar desde GHCR

```powershell
docker run --rm -p 3000:3000 --env-file .env ghcr.io/TU-USUARIO/LGYM-api:latest
```

## Healthcheck

La imagen usa:

```text
GET /ping
```

Ten presente que ese endpoint consulta base de datos, asi que si la DB falla el contenedor aparecera como no saludable.
