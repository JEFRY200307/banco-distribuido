# Tolerancia a fallas y concurrencia

Los backends se copian los datos entre sí. Los Postgres no se replican con una función de AWS ni entre ellos: cada backend escribe en el suyo el mismo log, en el mismo orden. El balanceador no participa en esa copia. Solo pregunta quién es el primario y le manda al cliente.

El tamaño del clúster sale de la variable `PARES` (las URLs de los otros backends, sin contarse a sí mismo).

| `PARES` | Nodos | `modo` en `/interno/estado` | Qué aguanta |
|---|---|---|---|
| vacío | 1 | `arrendamiento` | Ese nodo escribe solo. No hay relevo |
| una URL | 2 | `arrendamiento` | Se apaga uno y el otro sigue, después de un segundo |
| dos o más URLs | 3 o más | `mayoria` | Se apaga una minoría. Hace falta `nodos // 2 + 1` para confirmar y para elegir |

En AWS, con A y B, `PARES` lleva solo la IP privada del otro backend. Si se anota un tercer nodo que no existe, el modo pasa a mayoría y el que quede vivo no puede confirmar solo.

Los tiempos viven en `banco/cluster/protocolo.py`: latido cada `0,2 s` (`LATIDO_S`), el primario suelta el mando a los `0,5 s` sin respuesta (`ARRENDAMIENTO_S`), la réplica asume al `1,0 s` (`PROMOCION_S`). No se suman a cada depósito. Un depósito, con el par vivo, espera una ida y vuelta dentro de la VPC.

---

## Qué código corre en una escritura

Ejemplo: depósito. Crear cuenta, retiro, transferencia, registro y cambio de clave siguen el mismo camino con otro `tipo`.

1. El navegador llama a `POST /api/cuentas/{id}/deposito` con `X-Op-Id`. Vercel reenvía a la Lambda. `Enrutador.encontrar_primario` (`balanceador/balanceador/enrutador.py`) pide `GET /interno/estado` a cada nodo y elige el `primario` de mayor `epoch`.
2. `ServicioCuentas.depositar` (`banco/servicio/cuentas.py`) busca el `op_id`. Si ya está en `operacion`, devuelve ese resultado y no mueve el saldo. Si no, carga la cuenta, corre el dominio (`Deposito.aplicar`) y arma el cuerpo con el saldo que quedó.
3. `Nodo.proponer` (`banco/cluster/nodo.py`) toma `_escritura`, así una sola operación avanza el log a la vez en este proceso. `Protocolo.revisar` confirma que sigue siendo primario. Si no, lanza `NoSoyPrimario`: la API responde `409` y `Enrutador.reenviar` sigue `primario_provavel` una vez.
4. Arma la entrada (`indice`, `epoch`, `op_id`, `tipo`, `cuerpo`) y, si no está `en_solitario`, `Nodo._difundir` hace `POST /interno/replicar` a cada par.
5. El par entra por `rutas_internas.replicar` y `Nodo.recibir_replicacion`. Si el `epoch` es viejo, rechaza. Si el `indice` no es el siguiente, responde `atras` para que el primario no confirme todavía. Si encaja, `AlmacenPostgres.confirmar` (`banco/cluster/almacen.py`) aplica el efecto y inserta la fila del log en la misma transacción.
6. `aplicar_entrada` (`banco/cluster/aplicar.py`) escribe el saldo absoluto y la fila de `operacion`. En un registro escribe `usuario`. En un cambio de clave, el hash.
7. `Protocolo.puede_confirmar` mira los acks. Con 2 nodos hace falta el del par, salvo que este nodo esté `en_solitario`. Con 3 o más hace falta la mayoría, contándose a sí mismo. Si no llega, `proponer` devuelve false y el cliente recibe `503` `sin_quorum`. El saldo local no cambió.
8. Si llega, el primario confirma en su Postgres con la misma `confirmar` y sube `indice`. Recién ahí el servicio responde `200`.

La lectura (`consultar_saldo`, extracto, auditoría, login) no entra al log. `Enrutador.reenviar` la manda al primario. La réplica puede ir un latido atrás, así que un GET no se sirve desde ahí.

El hilo `Nodo._ciclo` corre aparte de las peticiones. Cada `LATIDO_S` mira si la base responde (`base_disponible`). Si el Postgres de este proceso está caído, se queda en réplica y no asume. Si está bien, `Protocolo.revisar` decide ceder, asumir o pedir votos, y según el rol llama a `_latir`, `_votar` o `_traer_log`.

---

## Dos nodos

A arranca `primario` (`ROL` o, si no hay variable, el id `A`). B arranca `replica`. Los dos en `epoch` 1. `Nodo._sondear`, al arrancar el hilo, pregunta el estado del otro. Si nadie contesta y este nodo es el primario, queda `en_solitario` y escribe igual. Si es la réplica y nadie contesta, el reloj ya viene vencido y asume en el siguiente `revisar`.

Con los dos vivos, A renueva `visto` en cada latido que B contesta (`Nodo._latir` → `Protocolo.anotar_contacto`). Cada depósito espera el ack de B. Las dos bases quedan iguales antes del `200`.

Si A se apaga, B deja de oír latidos. Al segundo, `Protocolo.revisar` devuelve `promovido`: `epoch` + 1, `primario`, `en_solitario`. El depósito responde `200` y queda en el Postgres de B. A está muerto y no compite.

Si B se apaga, A no renueva el latido. A los `0,5 s` `revisar` devuelve `cedio` y A deja de confirmar: un depósito en ese hueco responde `503`. B no puede asumir. Un segundo después de haber cedido, A vuelve a `promovido` y `en_solitario`, y el depósito responde `200`. Mientras sigue solo, `revisar` no lo hace soltar el mando otra vez: si lo soltara, el rol oscilaría con el par apagado.

Al volver el que faltaba, el latido trae el `epoch`. `Protocolo.recibir_latido` baja al que tiene el número menor. `Nodo._traer_log` pide `GET /interno/log?desde=` su índice y aplica cada entrada con `recibir_replicacion`. Cuando su índice alcanza al del primario, el siguiente latido apaga `en_solitario` y las escrituras nuevas vuelven a exigir el ack de los dos.

Si los dos se creen primario con el mismo `epoch` (se vieron después de un corte), se queda el id mayor (`"B"` gana a `"A"`). El otro baja a réplica.

### Ventajas

- Con los dos EC2 que hay hoy, apagar uno no detiene el banco. El relevo cabe en menos de 2 s.
- El cliente no recibe `200` hasta que el otro nodo guardó la operación, mientras los dos están vivos. Un depósito confirmado sobrevive a la caída del primario.
- Al volver, el atrasado copia el tramo que le falta, incluido lo que el sobreviviente confirmó en solitario. También si lo que cayó fue su Postgres: sin base no late (`rutas_internas.latido` responde `503`) y, al volver la base, pide el log.
- El mismo código sirve para un nodo solo (`PARES` vacío): confirma en local y `revisar` no cambia el rol.

### Desventajas

- Un corte de red entre A y B, con los dos procesos vivos y los dos alcanzables por la Lambda, no se distingue de una caída. Cada uno deja de oír al otro y puede asumir. Durante ese corte los dos aceptan depósitos distintos. Al reconectar manda un solo `epoch`, pero las filas que solo escribió el perdedor no se deshacen solas.
- Hay un hueco, de una fracción de segundo a un segundo, en el que nadie confirma. Esas llamadas salen `503`. Hay que reintentar con el mismo `X-Op-Id`.
- El navegador crea un `X-Op-Id` nuevo en cada clic. Un doble clic son dos depósitos. La deduplicación solo protege si se repite el mismo identificador.
- En solitario la copia es de uno. Si ese nodo se apaga antes de que el otro vuelva y copie, lo confirmado en ese tramo está solo en su disco.

---

## Tres nodos o más

`Protocolo.usa_arrendamiento` es falso. `mayoria` es `total // 2 + 1`. Con 3 nodos son 2: el primario y un par. Con 5 son 3.

Una escritura llama igual a `Nodo.proponer` y `Nodo._difundir`. `puede_confirmar` exige ese número de copias, contando la local. Un nodo caído no impide el `200` si los demás completan la mayoría. No existe `en_solitario`: nadie confirma por su cuenta.

El latido renueva el reloj solo si las respuestas, más el propio nodo, llegan a la mayoría (`Nodo._latir`). Si el primario pierde la mayoría durante `0,5 s`, `revisar` lo baja a réplica.

La réplica que lleva más tiempo sin latido se postula. La espera no es igual para todos: `espera_promocion` suma `0`, `0,2` o `0,4 s` según el id, para que no arranquen la ronda juntos. `revisar` devuelve `candidatura`, sube el `epoch` y `Nodo._votar` manda `POST /interno/votar`.

`Protocolo.conceder_voto` mira tres cosas, y `Nodo.recibir_voto` las responde:

1. El `epoch` del candidato es el más alto que ese nodo ha visto. Uno menor se ignora.
2. Ese nodo no votó por otro en la misma ronda.
3. El log del candidato está al menos tan al día como el de quien vota (`log_atrasado` si no). Así no gana quien no tiene las operaciones ya confirmadas.

El candidato se cuenta a sí mismo. `Protocolo.asumir` lo hace primario solo si los votos llegan a la mayoría. Si no, vuelve a réplica y espera otra ronda. Con 3 nodos, muerto A, B y C se votan y uno asume. El `200` siguiente exige el ack del que quedó.

`docker compose` levanta A, B y C con `PARES` de dos URLs cada uno. Ese arranque local ya es mayoría. El de AWS, con una sola URL en `PARES`, es arrendamiento.

### Ventajas

- Un corte de red no deja dos primarios: el lado que no junta la mayoría no confirma y no gana la elección. El lado que sí la junta sube el `epoch`. Al volver el otro, `recibir_latido` lo baja y `_traer_log` lo pone al día. Lo confirmado está en la mayoría, así que no se pierde.
- Se puede apagar un nodo (con 3) o dos (con 5) y el banco sigue sin pasar por `en_solitario`.
- El voto rechaza a un candidato atrasado, así que el nuevo primario ya tiene el log que los clientes dieron por hecho.

### Desventajas

- Hacen falta nodos de más. Con los dos EC2 actuales este modo no da relevo: la mayoría de 2 son los 2, y apagar uno deja al otro sin quórum.
- Cada escritura espera a más de un par. Con la mayoría justa, un nodo lento alarga el `200`.
- Perder la mayoría detiene las escrituras (`503`) hasta que vuelva un nodo. No hay un modo solitario que las reanude.
- El desfase de la elección es fijo por id, no un sorteo. El de espera más corta suele ganar. Es predecible y, si ese nodo está justo en la parte mala de un corte, la ronda se repite un segundo después.

---

## Concurrencia

Dentro de un nodo, `_escritura` deja pasar una propuesta a la vez. Dos depósitos no avanzan el mismo `indice`. En el Postgres, `AlmacenPostgres.confirmar` mete el saldo y la fila del log en una transacción: o quedan los dos, o un fallo los revierte. Una transferencia actualiza las dos cuentas en esa misma transacción (`aplicar_entrada`, tipo `TRANSFERENCIA`).

Entre nodos no hay un bloqueo que cruce las dos bases. El orden lo pone el log: un solo primario, índices seguidos, el mismo `epoch`. La réplica aplica ese orden y no acepta un índice que se salte uno. El `op_id` único en `log_replicacion` hace que repetir la misma propuesta no vuelva a sumar el monto.

El `epoch` es el cerrojo del mando. Un primario viejo, al ver un número mayor, deja de confirmar antes de aplicar otra cosa (`recibir_latido` y el rechazo en `recibir_replicacion`). El balanceador, si la imagen es la nueva, descarta al de `epoch` menor aunque los dos digan `primario`.

El login no escribe el log. El token lo firma `SECRET_KEY`, la misma en todos los nodos, y cualquiera lo valida sin llamar al que lo emitió. El registro y el cambio de clave sí van al log (`REGISTRO`, `CLAVE` en `ServicioAutenticacion`), porque si no el primario nuevo no conocería al usuario.
