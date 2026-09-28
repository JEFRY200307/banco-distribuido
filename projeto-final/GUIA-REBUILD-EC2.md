# Cambiar el repo en los EC2 y reconstruir el backend

Los backends se construyeron con un `git clone` del repositorio de otro dueño (`PauloRPinedo/banco-distribuido`, según `GUIA-DESPLIEGUE.md`). Tu fork es `JEFRY200307/banco-distribuido`. Un `git pull` en la instancia, sin cambiar el remote, sigue trayendo el repo viejo. Los endpoints nuevos, entre ellos `POST /auth/recuperar`, no aparecen hasta que la imagen Docker se arma con tu `main`.

La Lambda no se reconstruye para esto: solo reenvía la ruta al nodo. Vercel toma el frontend cuando ese `main` está en GitHub. Postgres no se toca: los datos siguen en su contenedor.

Hazlo en `backend-a` y, igual, en `backend-b`. No lo hagas en las instancias `postgres-*`.

## 1. Sube el código antes de entrar al EC2

El `git pull` de la instancia solo ve lo que ya está en GitHub. Si los cambios siguen solo en tu máquina, primero súbelos a `main` de `JEFRY200307/banco-distribuido`.

## 2. Entra al backend y mira qué contenedor hay

EC2 → instancia `backend-a` → **Connect** → **EC2 Instance Connect**.

```bash
docker ps --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}'
git remote -v
```

Anota el nombre del contenedor (`backend-a` u otro). El remote viejo apunta al otro dueño.

## 3. Copia las variables antes de borrar el contenedor

Sin esto se pierde `SECRET_KEY`, la IP privada de Postgres y la contraseña.

```bash
docker inspect NOMBRE --format '{{range .Config.Env}}{{println .}}{{end}}'
```

Guarda esa lista. Vas a repetir `NODO_ID`, `PUERTO`, `PGHOST`, `PGPORT`, `PGDATABASE`, `PGUSER`, `PGPASSWORD` y `SECRET_KEY`. `SECRET_KEY` tiene que seguir siendo la misma en los dos backends. `PGHOST` es la IP privada del Postgres de ese nodo, no la pública.

## 4. Apunta el clone a tu fork y trae main

Si el clone está en el home:

```bash
cd ~/banco-distribuido
git remote set-url origin https://github.com/JEFRY200307/banco-distribuido.git
git remote -v
git fetch origin
git checkout main
git pull origin main
```

`git remote -v` tiene que mostrar `JEFRY200307/banco-distribuido`. Si `git pull` pide usuario, el repo es privado: usa un token de GitHub como contraseña, no la clave de la cuenta.

## 4.1. Número de cuenta en las dos bases

Hazlo antes de reemplazar el contenedor del backend, y en los dos Postgres. Desde la instancia del backend (ya con el `git pull`), contra el `PGHOST` de ese nodo:

```bash
docker run --rm -i postgres:16-alpine \
  psql "postgresql://banco:LA_PASSWORD@PGHOST:5432/banco" \
  < ~/banco-distribuido/projeto-final/db/migracion-numero-cuenta.sql
```

La consulta del final tiene que listar cada cuenta con `agencia` 0001 y un `numero_cuenta` como `61760246-8`. Repite el comando en el otro backend, con el `PGHOST` de su Postgres. No borres el contenedor de Postgres.

## 5. Reconstruye solo la imagen del backend

```bash
cd ~/banco-distribuido/projeto-final/backend
docker build -t backend .
docker rm -f NOMBRE
docker run -d --name NOMBRE -p 8001:8001 \
  --restart unless-stopped \
  -e NODO_ID=A -e ROL=primario -e PUERTO=8001 \
  -e URL_PROPIA=http://IP_PRIVADA_DE_ESTE_BACKEND:8001 \
  -e PARES=http://IP_PRIVADA_DEL_OTRO_BACKEND:8001 \
  -e PGHOST=IP_PRIVADA_DE_POSTGRES_A -e PGPORT=5432 \
  -e PGDATABASE=banco -e PGUSER=banco -e PGPASSWORD='LA_QUE_COPIASTE' \
  -e SECRET_KEY='LA_QUE_COPIASTE' \
  backend
```

`PARES` y `URL_PROPIA` son las IP privadas de los **backends**, puerto `8001`, no las de Postgres. Con un solo par, el modo es arrendamiento: si uno se apaga, el otro sigue escribiendo. No agregues un tercer nodo que no existe: el modo pasaría a mayoría y el que quede vivo no podría confirmar solo.

En `backend-b` cambia `NODO_ID=B`, `ROL=replica`, `URL_PROPIA` a la IP de B, `PARES` a la IP de A, el nombre del contenedor y el `PGHOST` de `postgres-b`. No borres el contenedor de Postgres.

Conviene reconstruir también la imagen de la Lambda (`GUIA-DESPLIEGUE.md`, paso 4.2) desde `JEFRY200307/banco-distribuido`. Así, si dos nodos se anuncian primario, se queda con el `epoch` más alto. Si la imagen vieja sigue, igual salta al primero que diga `primario`.

## 6. Comprueba antes de irte

```bash
curl -sS http://127.0.0.1:8001/interno/estado
```

Tiene que devolver el JSON del nodo. Desde tu casa, la IP pública en el puerto 8001 tiene que responder lo mismo.

Repite los pasos 2 a 6 en `backend-b`. Después sigue `GUIA-PRUEBA-SERVIDORES.md`.
