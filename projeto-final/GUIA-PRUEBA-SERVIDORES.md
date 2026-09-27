# Prueba de los servidores

Orden para comprobar que Vercel, la Lambda y los dos backends se hablan. Hazlo después de reconstruir las imágenes de los EC2 si el código del backend cambió (`GUIA-REBUILD-EC2.md`). Si no reconstruyes, el registro y el login viejos siguen; `POST /auth/recuperar` todavía no existe en el nodo y responde 404.

Sustituye las IP por las públicas actuales de `backend-a` y `backend-b`. El puerto es `8001`. Desde tu casa ese puerto responde solo si tu IP está en el grupo `banco-backend`. La Lambda entra por el grupo `banco-lambda`.

## 1. Cada nodo está vivo

En el navegador, o con curl:

```text
http://IP_BACKEND_A:8001/interno/estado
http://IP_BACKEND_B:8001/interno/estado
```

Cada uno debe devolver JSON con `nodo`, `rol` y `epoch`. Hoy los dos pueden decir `primario`: la réplica entre nodos todavía no reparte los datos. Un alta hecha en A no aparece en B.

## 2. La Lambda llega a un nodo

```text
https://usrzoacnuosa6bhetxt5qa4mwe0ldjrk.lambda-url.us-east-2.on.aws/salud
```

Respuesta: `{"balanceador":"activo"}`.

Luego:

```text
https://banco-distribuido-one.vercel.app/api/salud
```

La misma respuesta. Si aquí hay 502 y el paso 1 funciona, la Lambda no alcanza la IP privada del backend (VPC, grupo de seguridad o `CLUSTER_CONFIG_JSON` desactualizado).

## 3. Registro, sesión y recuperación

En el sitio, **Crear usuario**. Marca los términos (si no, el botón no entra) y regístrate.

El alta la escribe un solo nodo. Si después el login dice que el email o la contraseña no sirven, el balanceador mandó el login al otro nodo. Prueba el login directo contra cada IP:

```text
POST http://IP_BACKEND_A:8001/auth/login
Content-Type: application/json

{"email":"tu-email","contrasena":"tu-clave"}
```

El nodo que tiene al usuario responde 200 y un `token`. El otro responde 401. No es un fallo de Vercel.

**Recuperar contraseña** pide email y clave nueva. No llega un correo. La respuesta siempre dice que, si el email existe, la clave quedó actualizada. Entra con la clave nueva por el mismo nodo que guardó el cambio.

Un email repetido en el registro responde 409.

## 4. Operaciones, en este orden

Entra en el sitio. Cada fila del inicio descarga solo esa pantalla.

1. **Crear cuenta.** Moneda y saldo inicial. Anota el id que muestra. Queda guardado para las pantallas siguientes.
2. **Consultar saldo.** El mismo id. Debe pedir sesión: sin token el nodo responde 401. Si la cuenta es de otro usuario, 403.
3. **Depositar** un monto con hasta dos decimales. El saldo sube.
4. **Extracto.** Aparece la creación y el depósito.
5. **Retirar** un monto menor al saldo. El saldo baja. Retirar de más debe fallar con el mensaje del nodo.
6. Crea una segunda cuenta en la **misma moneda**. **Transferir** de la primera a la segunda. Los dos saldos cambian.
7. **Conversión** y **Autotransferencia** deben mostrar el mensaje de que no está implementado (501). No es un corte de red.
8. **Auditoría.** Muestra la suma de saldos, la suma del log y si cuadran, del nodo que atendió.
9. **Estado del nodo.** Muestra el nodo que eligió el balanceador, no los dos a la vez.

## 5. La página al recargar

Abre `/login`, `/registro` o `/inicio` y recarga. Tiene que seguir la pantalla, no el 404 de Vercel.

En el teléfono, el sitio ocupa la pantalla entera. Desde el menú del navegador se puede instalar (PWA). Instalar no hace que el banco funcione sin red: `/api` no se cachea.
