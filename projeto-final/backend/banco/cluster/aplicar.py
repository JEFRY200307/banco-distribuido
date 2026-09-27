"""Aplica en el Postgres local una entrada que ya fue aceptada en el log.

El primario validó la operación antes de proponerla. Aquí se escribe el
efecto (el saldo que quedó, no un delta) para que una réplica atrasada,
al reaplicar, termine con las mismas cifras.
"""

from datetime import datetime

from banco.repositorio.cuentas import RepositorioCuentas
from banco.repositorio.operaciones import RepositorioOperaciones
from banco.repositorio.usuarios import RepositorioUsuarios

_FECHAS = ("fecha_creacion", "fecha_hora", "fecha_ultimo_interes", "fecha_vencimiento")


def _fechas(fila: dict) -> dict:
    salida = dict(fila)
    for clave in _FECHAS:
        valor = salida.get(clave)
        if isinstance(valor, str):
            salida[clave] = datetime.fromisoformat(valor)
    return salida


def aplicar_entrada(conexion, entrada: dict) -> None:
    tipo = entrada["tipo"]
    cuerpo = entrada["cuerpo"]
    if tipo == "CREACION":
        RepositorioCuentas(conexion).guardar(_fechas(cuerpo["cuenta"]))
        RepositorioOperaciones(conexion).guardar(_fechas(cuerpo["operacion"]))
        return
    if tipo in ("DEPOSITO", "RETIRO"):
        with conexion.cursor() as cur:
            cur.execute(
                "UPDATE cuenta SET saldo_centavos = %s WHERE id = %s",
                (cuerpo["saldo_centavos"], cuerpo["cuenta_id"]),
            )
            if cur.rowcount != 1:
                raise ValueError(f"la cuenta {cuerpo['cuenta_id']!r} no está en este nodo")
        RepositorioOperaciones(conexion).guardar(_fechas(cuerpo["operacion"]))
        return
    if tipo == "TRANSFERENCIA":
        with conexion.cursor() as cur:
            for cuenta_id, saldo in cuerpo["saldos_centavos"].items():
                cur.execute(
                    "UPDATE cuenta SET saldo_centavos = %s WHERE id = %s",
                    (saldo, cuenta_id),
                )
                if cur.rowcount != 1:
                    raise ValueError(f"la cuenta {cuenta_id!r} no está en este nodo")
        RepositorioOperaciones(conexion).guardar(_fechas(cuerpo["operacion"]))
        return
    if tipo == "REGISTRO":
        RepositorioUsuarios(conexion).guardar(_fechas(cuerpo["usuario"]))
        return
    if tipo == "CLAVE":
        RepositorioUsuarios(conexion).actualizar_contrasena(
            cuerpo["email"], cuerpo["password_hash"])
        return
    raise ValueError(f"tipo de log desconocido: {tipo}")
