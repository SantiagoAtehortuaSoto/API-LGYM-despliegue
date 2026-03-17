# SQL seeds for LGYM

These scripts are intended to run **after** table creation (`npm run db:sync`).

Order:

1. `10-seed-estados.sql`
2. `11-seed-privilegios.sql`
3. `12-seed-permisos.sql`
4. `13-seed-roles.sql`
5. `14-seed-detallesrol-admin.sql`
6. `99-fix-sequences.sql`

PowerShell example:

```powershell
$db = "LGYM"
$user = "postgres"
$container = "lgym-db"

Get-Content scripts/sql/10-seed-estados.sql -Raw | docker exec -i $container psql -U $user -d $db
Get-Content scripts/sql/11-seed-privilegios.sql -Raw | docker exec -i $container psql -U $user -d $db
Get-Content scripts/sql/12-seed-permisos.sql -Raw | docker exec -i $container psql -U $user -d $db
Get-Content scripts/sql/13-seed-roles.sql -Raw | docker exec -i $container psql -U $user -d $db
Get-Content scripts/sql/14-seed-detallesrol-admin.sql -Raw | docker exec -i $container psql -U $user -d $db
Get-Content scripts/sql/99-fix-sequences.sql -Raw | docker exec -i $container psql -U $user -d $db
```
