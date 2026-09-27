# Prueba por requisito (RF y RNF)

Cada caso dice el requisito, el endpoint, quién habla con quién y la respuesta esperada. El protocolo ya está en el código; cómo corre, archivo por archivo, está en [`TOLERANCIA-Y-CONCURRENCIA.md`](TOLERANCIA-Y-CONCURRENCIA.md). En las EC2 hace falta reconstruir la imagen y definir `PARES` y `URL_PROPIA` (`GUIA-REBUILD-EC2.md`). Sin `PARES` cada nodo escribe solo en su Postgres y no hay relevo.

Camino de toda llamada hecha desde el sitio:

1. El navegador llama a `https://banco-distribuido-one.vercel.app/api/...`.
2. Vercel reenvía a la Lambda (el balanceador). Quita el prefijo `/api`.
3. La Lambda lee `CLUSTER_CONFIG_JSON`, pregunta `GET /interno/estado` a cada nodo y se queda con el que responde `"rol":"primario"`.
4. Ese nodo valida, manda la entrada a su par (`POST /interno/replicar`) y responde cuando la copia quedó hecha. Los dos Postgres tienen la misma fila. Las lecturas van al primario.

Con los dos backends vivos, A arranca como `primario` y B como `replica`, los dos en `epoch` 1 y `modo` `arrendamiento`. Después de un relevo el `epoch` sube y el primario puede ser B.

En la terminal de cada backend, el estado local (no pasa por la Lambda):

```bash
curl -sS http://127.0.0.1:8001/interno/estado
```

A, recién levantado, devuelve `rol` `primario`, `epoch` 1, `modo` `arrendamiento`. B devuelve `rol` `replica`. Si uno ya asumió, el `epoch` es mayor y el `rol` puede estar al revés: manda el `epoch`, no el nombre.

Sustituye `TOKEN` por el texto que devuelve el login. Las escrituras llevan `X-Op-Id`: un identificador nuevo por operación, el mismo si estás reintentando la misma.

---

## 0. Dejar el banco listo para el resto

| Paso | Endpoint | Comunicación | Respuesta esperada |
|---|---|---|---|
| Alta | `POST /api/auth/registro` | Lambda → primario → su Postgres y el del par | `200` y `{"id","email"}`. El mismo usuario está en los dos Postgres |
| Email repetido | el mismo | igual | `409`, `email_ya_registrado` |
| Entrar | `POST /api/auth/login` | Lambda → A | `200` y `{"token"}`. Contraseña mala o email inexistente: `401`, el mismo mensaje en los dos casos |
| Clave nueva | `POST /api/auth/recuperar` | Lambda → A | `200` y el mensaje de que, si el email existe, la clave quedó actualizada. No llega correo |

Cuerpo del registro: `{"nombre","email","contrasena"}`. El de login y recuperar: `{"email","contrasena"}`.

Esto cubre **RF-26** (sesión). El token dura 8 horas. Lo firma A con `SECRET_KEY`. B puede validar la firma si tiene la misma llave, sin llamar a A y sin mirar la base. No hay rol de administrador.

---

## RF-01 — Crear cuenta

`POST /api/cuentas`  
Cabeceras: `Authorization: Bearer TOKEN`, `X-Op-Id: crear-1`, `Content-Type: application/json`  
Cuerpo: `{"usuario_id":"<id del token>","moneda":"PEN","saldo_inicial_centavos":10000}`

El `usuario_id` es el del token (la pantalla lo saca sola). La Lambda confirma que A es primario y le manda el POST. A inserta en su Postgres y responde `200`:

```json
{"id":"<12 caracteres>","saldo_centavos":10000}
```

Anota ese `id`: es `CUENTA_A`. Crea otra con `X-Op-Id: crear-2` y saldo `5000`: es `CUENTA_B`, misma moneda.

Falla: sin `X-Op-Id`, `422`. Monto que no sea entero de centavos, lo rechaza la pantalla antes de salir; si llega un número imposible al nodo, `400` `valor_invalido`.

## RF-02 — Consultar saldo

`GET /api/cuentas/CUENTA_A` con `Authorization: Bearer TOKEN`.

La Lambda no usa a B. Pregunta el rol y lee en A. Respuesta `200` con la fila: `saldo_centavos` 10000, `moneda` PEN, `estado` ACTIVA.

Sin token: `401`. Token de otro usuario sobre esta cuenta: `403` `prohibido`. Id que no existe: `404`.

## RF-03 — Depositar

`POST /api/cuentas/CUENTA_A/deposito`  
Cuerpo: `{"monto_centavos":2500}` y `X-Op-Id: dep-1`.

A suma en su Postgres. `200` y `saldo_centavos` 12500. Un GET del saldo (RF-02) muestra lo mismo. Esta ruta no exige token: el requisito de dueño, en el código, no está en el depósito.

## RF-06 — El saldo no baja de cero

`POST /api/cuentas/CUENTA_A/retiro`  
Cuerpo: `{"monto_centavos":99999999}` y `X-Op-Id: ret-malo`.

A valida antes de grabar. `422` `saldo_insuficiente`. El GET del saldo sigue en 12500. Nada se escribió en `operacion` para ese `op_id`.

Un retiro válido, `X-Op-Id: ret-1`, cuerpo `{"monto_centavos":500}`, responde `200` y el saldo queda en 12000. Esta ruta sí exige token y que la cuenta sea tuya (`401` / `403`).

## RF-04 y RF-05 — Transferir, y que sea una sola operación

`POST /api/transferencias`  
Cuerpo: `{"cuenta_origen_id":"CUENTA_A","cuenta_destino_id":"CUENTA_B","monto_centavos":2000}`  
`X-Op-Id: tr-1` y el token del dueño de A.

A mueve las dos cuentas en su Postgres y responde `200` con `saldos_centavos` de las dos. No hay un instante guardado en el que el dinero salió de A y no entró en B: o las dos filas cambian o, si el nodo cae a mitad de la transacción, Postgres revierte las dos.

Después: saldo de A = 10000, saldo de B = 7000. `GET /api/auditoria` (RF-14) no cambia el total: salió 2000 de una y entró 2000 en la otra.

Cuenta destino inexistente, u origen de otro usuario: no se mueve ninguna. Monedas distintas: el nodo rechaza y pide la conversión, que no está hecha.

## RF-14 — Auditoría

`GET /api/auditoria` (la Lambda lo manda al primario).

`200` con `total_centavos`, `total_esperado_centavos`, `divergencia_centavos` y `divergente`. Con las operaciones de arriba, `divergente` es `false` y los dos totales coinciden. El cálculo es solo el Postgres de A. El de B no entra.

## RF-07 y RF-08 — Reglas de dominio ya cubiertas por el nodo

El repositorio agrupa RF-01 a RF-08 en el dominio de un nodo (dinero entero, operación válida antes de grabar, cuentas que se tocan en orden). No hay un octavo endpoint distinto. Lo que se prueba aparte de los casos anteriores:

| Qué | Cómo | Respuesta |
|---|---|---|
| Extracto | `GET /api/cuentas/CUENTA_A/extracto` con token | `200` y la lista: creación, depósito, retiro, transferencia. Exige dueño |
| Misma escritura otra vez | Repetir el POST de depósito con el **mismo** `X-Op-Id: dep-1` | `200` y el resultado ya guardado. El saldo no sube de nuevo |
| Escritura nueva | El mismo depósito con `X-Op-Id: dep-2` | El saldo sí sube |

El navegador genera un `X-Op-Id` distinto en cada clic. Para ver la repetición segura hay que usar curl con el identificador fijo. Si el clic se repite desde la pantalla, son dos depósitos.

## RF-26 — Sesión en cada operación que exige dueño

Ya quedó en la sección 0. Además, con el token vencido o alterado, saldo, retiro, extracto y transferencia responden `401` `sesion_invalida`. Crear cuenta y depositar, en este código, no piden ese encabezado.

## RF-19 a RF-25 — Moneda, ahorro, plazo fijo, externo

No están implementados.

| Intento | Endpoint | Respuesta esperada hoy |
|---|---|---|
| Conversión | `POST /api/transferencias/conversion` con el mismo cuerpo que una transferencia, token y `X-Op-Id` | `501` `no_implementado` |
| Autotransferencia | `POST /api/transferencias/autotransferencia` | `501` `no_implementado` |
| Transferencia externa, ahorro, plazo fijo | No hay ruta | `404` del nodo |

Los saldos de RF-04 no deben cambiar después de un 501.

## RF-09 — Elección de un solo primario

Con los dos vivos, `curl` a `/interno/estado` en cada instancia: un solo `primario`. A late cada 200 ms (`Nodo._latir`).

Apaga el contenedor de A y espera hasta 1,5 s. B sube el `epoch` y pasa a `primario` con `en_solitario` true. Un depósito nuevo responde `200`. A, al volver, ve el `epoch` mayor, se queda en `replica` y no acepta escrituras (`409`).

Si se apaga B en vez de A: durante menos de 1,5 s un depósito puede responder `503` `sin_quorum`. Después A vuelve a `primario`, `en_solitario` true, y el depósito responde `200`.

## RF-10 — La copia queda hecha antes del 200

`POST /api/cuentas/CUENTA_A/deposito` con los dos vivos. El `200` llega después de que B guardó la entrada. En el Postgres de B la fila del depósito está, con el mismo saldo que en A.

Eso, con dos nodos, es el ack del par (`modo` `arrendamiento`). Con tres nodos (`PARES` con dos direcciones) `modo` es `mayoria`: basta el primario y un par; el tercero puede estar caído y el `200` igual sale.

## RF-11 — Seguir atendiendo si un servidor está caído

```bash
docker stop backend-b
```

Espera un par de segundos. Login, saldo y un depósito contra el sitio: `200`. A está solo.

```bash
docker start backend-b
```

B vuelve como `replica`. El depósito hecho mientras estaba parado aparece en su Postgres (lo pide con `GET /interno/log`).

Lo mismo al revés: `docker stop backend-a`. Tras el segundo de relevo, el sitio sigue y `/interno/estado` en B dice `primario`.

## RF-12 — El nodo que vuelve se pone al día

Después de `docker start` del que faltaba, su `indice` alcanza al del primario y `en_solitario` del primario pasa a false. Un depósito posterior necesita otra vez el ack de los dos: si consultas el saldo en el Postgres del que volvió, es el mismo.

Si lo que cayó fue solo el Postgres (el proceso del backend sigue), ese nodo deja de responder al latido. El otro asume o sigue solo. Cuando el Postgres vuelve, el nodo copia el log. No se borra lo que ya tenía confirmado.

## RF-13 — Reintento sin duplicar, y seguir al primario

Repetir el POST de depósito con el mismo `X-Op-Id` responde `200` y el saldo no sube otra vez. El `op_id` está en `log_replicacion` de los dos.

Si una escritura llega a una réplica, el nodo responde `409` con `primario_provavel`. El balanceador reintenta una vez en esa URL. El navegador genera un `X-Op-Id` distinto en cada clic: un doble clic son dos depósitos. Para ver la repetición segura hay que usar curl con el identificador fijo.

## RF-15 — Métricas

No hay `GET /admin/metricas`. No se puede pedir. La respuesta es `404`.

## RF-16 — Inyectar una falla

No hay comando de partición. La falla se hace parando el contenedor o la instancia, como en RF-11 y en la tabla de fallas de abajo.

## RF-17 — Cliente de línea de comando

No está en este repositorio. Las pruebas de esta guía son el sitio o `curl` a `/api`.

---

## RNF-01 — El dinero no se crea ni se destruye

Antes y después de la transferencia RF-05, `GET /api/auditoria` en el primario. `total_centavos` igual, `divergente` false.

Un retiro que no cabe (RF-06) tampoco mueve el total. Dos depósitos con el mismo `X-Op-Id` tampoco.

La misma auditoría, hecha sobre el Postgres de B después de que el log lo alcanzó, da el mismo total. Mientras B está atrasado, su total puede ir por detrás: todavía no aplicó las últimas entradas. No es dinero creado; es la cola del log.

## RNF-02 — Lo confirmado sobrevive si el primario se apaga

Haz un depósito y espera el `200`. Para el contenedor de A. Sin volver a levantarlo, entra al sitio: el saldo es el confirmado, servido por B. Está en el disco de Postgres de B, copiado antes del `200`, no en la memoria del proceso.

Al arrancar A de nuevo, el saldo sigue. A queda en réplica y completa lo que B confirmó mientras A estaba apagado.

## RNF-03 — Otro primario en menos de 2 segundos

Apaga `backend-a` y mide hasta que `curl` en B devuelva `rol` `primario` con un `epoch` mayor. El plazo del código es 1 s desde el último latido (`PROMOCION_S` en `protocolo.py`). Cabe en los 2 s. Anota ese tiempo.

## RNF-04 y RNF-05 — Cuántas operaciones por segundo, y el percentil 99

No hay medición en este despliegue. No inventes el número. El balanceador espera como máximo 2 s en cada nodo antes de pasar al siguiente, así que una Lambda fría más un A lento puede pasar de 2 s sin que eso sea el percentil del protocolo.

## RNF-06 — Sin el quórum de ese tamaño, no se escribe

Con dos nodos, justo después de apagar el par y antes de que el vivo quede `en_solitario`, un depósito responde `503` `sin_quorum`. El saldo no cambia. Un segundo después, el mismo depósito con el mismo `X-Op-Id` responde `200`.

Con tres nodos el `503` aparece cuando no quedan dos votos (se cayeron dos). Con uno solo caído, el `200` sigue.

## RNF-08 — Dinero en centavos enteros

Los cuerpos usan `monto_centavos` entero. La pantalla convierte `10.50` a `1050` y rechaza más de dos decimales antes de llamar. Un entero negativo o basura que llegue al dominio responde `400` `valor_invalido` y no toca el saldo.

## RNF-09 — Levantar el conjunto con un comando

En una máquina de desarrollo, dentro de `projeto-final`: `docker compose up --build`. No es el despliegue de AWS. Ahí A queda `ROL=primario` y B y C `ROL=replica`.

## RNF-10 — Modos de falla conocidos

| Situación | Qué responde el sistema | Requisito relacionado |
|---|---|---|
| B apagado, tras ~1,5 s | A queda `en_solitario` y sigue en `200`. Al volver, B copia el log | RF-11, RF-12 |
| A apagado, tras ~1 s | B pasa a `primario`, `epoch` + 1, y el sitio sigue | RF-09, RNF-02, RNF-03 |
| Justo al caer el par, antes del relevo | `503` `sin_quorum`. Reintentar con el mismo `X-Op-Id` | RNF-06, RF-13 |
| Postgres de un nodo apagado y su backend vivo | Ese nodo no late (`503` en `/interno/latido`). El otro sigue. Al volver la base, copia el log | RF-12 |
| Los dos backends apagados | La Lambda no tiene nodo. Error de la función | — |
| Red cortada entre A y B, los dos vivos | Cada uno puede asumir. Al reconectar, el `epoch` mayor (o, si empatan, el id mayor) se queda y el otro baja a réplica | desventaja de 2 nodos |
| Lambda reiniciada | Vuelve a preguntar `/interno/estado`. Los saldos no están en la Lambda | — |
| Vercel caído | No carga la página. `curl` a la URL de la Lambda sigue llegando al primario | — |
| Mismo `X-Op-Id` | Un solo movimiento | RF-13, RF-07 |
| `X-Op-Id` nuevo en cada clic de la pantalla | Un reintento desde la interfaz puede duplicar el depósito | RF-13 |
| Token ausente o malo en saldo, retiro, extracto o transferencia | `401` | RF-26 |
| Cuenta de otro | `403` | RF-26 |
| Saldo insuficiente | `422`, saldo igual | RF-06 |
| Conversión o autotransferencia | `501`, saldos iguales | RF-19 a RF-25 |

## RNF-11 — Atender con una instancia apagada

Es el caso de RF-11 con el EC2, no solo con el contenedor. **Stop** de la instancia `backend-b` (no Terminate). Tras el relevo el sitio sigue contra A. Start de la instancia: el contenedor con `--restart unless-stopped` vuelve, pide el log y el depósito hecho en el medio aparece en su Postgres.

Stop de `backend-a`: B asume y el sitio sigue. Start de A: A entra como réplica.

---

## Orden corto para ver que lo desplegado responde

1. Estado en A (`primario`, `modo` `arrendamiento`) y en B (`replica`). Si `modo` no está, la imagen vieja sigue en el contenedor.
2. Registro, login y dos cuentas. El usuario tiene que existir en los dos Postgres.
3. Depósito, saldo, retiro que no cabe, retiro que cabe, transferencia, auditoría.
4. `docker stop backend-b`, espera 2 s, otro depósito (`200`), `docker start backend-b`. Ese depósito está en el Postgres de B.
5. `docker stop backend-a`, espera 2 s. El saldo se lee igual. `/interno/estado` en B dice `primario` y un `epoch` mayor. `docker start backend-a`: A queda `replica` y el saldo coincide.

Con tres backends el `modo` es `mayoria`. Apagar uno no cambia el `epoch`: los otros dos siguen confirmando. Apagar dos deja el banco en `503` hasta que vuelva al menos uno.
