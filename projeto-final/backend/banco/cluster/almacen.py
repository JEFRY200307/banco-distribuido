"""Log y rol de este nodo, en su propio Postgres.

La entrada y el efecto en las cuentas se confirman en la misma transacción:
o quedan los dos, o no queda ninguno.
"""

import logging

from psycopg2.extras import Json

from banco.repositorio.conexion import obtener_conexion

logger = logging.getLogger("banco.cluster")

_SCHEMA = """
CREATE TABLE IF NOT EXISTS log_replicacion (
    indice  BIGINT PRIMARY KEY,
    epoch   BIGINT NOT NULL,
    op_id   VARCHAR(64) NOT NULL UNIQUE,
    tipo    VARCHAR(40) NOT NULL,
    cuerpo  JSONB NOT NULL
);
CREATE TABLE IF NOT EXISTS nodo_estado (
    clave  VARCHAR(40) PRIMARY KEY,
    valor  VARCHAR(120) NOT NULL
);
"""


class AlmacenPostgres:

    def __init__(self):
        self._listo = False

    def _conectar(self):
        conexion = obtener_conexion()
        if not self._listo:
            with conexion.cursor() as cur:
                cur.execute(_SCHEMA)
            conexion.commit()
            self._listo = True
        return conexion

    def tiene(self, op_id: str) -> bool:
        conexion = self._conectar()
        try:
            with conexion.cursor() as cur:
                cur.execute("SELECT 1 FROM log_replicacion WHERE op_id = %s", (op_id,))
                return cur.fetchone() is not None
        finally:
            conexion.close()

    def ultimo_indice(self) -> int:
        conexion = self._conectar()
        try:
            with conexion.cursor() as cur:
                cur.execute("SELECT COALESCE(MAX(indice), 0) AS n FROM log_replicacion")
                return int(cur.fetchone()["n"])
        finally:
            conexion.close()

    def entradas_desde(self, indice: int) -> list[dict]:
        conexion = self._conectar()
        try:
            with conexion.cursor() as cur:
                cur.execute(
                    """
                    SELECT indice, epoch, op_id, tipo, cuerpo
                    FROM log_replicacion
                    WHERE indice > %s
                    ORDER BY indice
                    """,
                    (indice,),
                )
                return [dict(fila) for fila in cur.fetchall()]
        finally:
            conexion.close()

    def confirmar(self, entrada: dict, rol: str, aplicador) -> None:
        conexion = self._conectar()
        try:
            aplicador(conexion, entrada)
            with conexion.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO log_replicacion (indice, epoch, op_id, tipo, cuerpo)
                    VALUES (%(indice)s, %(epoch)s, %(op_id)s, %(tipo)s, %(cuerpo)s)
                    ON CONFLICT (op_id) DO NOTHING
                    """,
                    {**entrada, "cuerpo": Json(entrada["cuerpo"])},
                )
                _guardar(cur, entrada["epoch"], rol, entrada["indice"])
            conexion.commit()
        except Exception:
            conexion.rollback()
            raise
        finally:
            conexion.close()

    def cargar(self) -> dict | None:
        try:
            conexion = self._conectar()
        except Exception:
            logger.warning("sin postgres al cargar el rol", exc_info=True)
            return None
        try:
            with conexion.cursor() as cur:
                cur.execute("SELECT clave, valor FROM nodo_estado")
                filas = {fila["clave"]: fila["valor"] for fila in cur.fetchall()}
            if "epoch" not in filas:
                return None
            return {
                "epoch": int(filas["epoch"]),
                "rol": filas.get("rol", "replica"),
                "indice": int(filas.get("indice", "0")),
            }
        finally:
            conexion.close()

    def guardar_meta(self, epoch: int, rol: str, indice: int) -> None:
        try:
            conexion = self._conectar()
        except Exception:
            logger.warning("sin postgres al guardar el rol", exc_info=True)
            return
        try:
            with conexion.cursor() as cur:
                _guardar(cur, epoch, rol, indice)
            conexion.commit()
        except Exception:
            conexion.rollback()
            logger.warning("no se pudo guardar el rol", exc_info=True)
        finally:
            conexion.close()


class AlmacenMemoria:
    """Para pruebas: el mismo contrato, sin Postgres."""

    def __init__(self):
        self.entradas: list[dict] = []
        self.meta: dict | None = None

    def tiene(self, op_id: str) -> bool:
        return any(entrada["op_id"] == op_id for entrada in self.entradas)

    def ultimo_indice(self) -> int:
        return self.entradas[-1]["indice"] if self.entradas else 0

    def entradas_desde(self, indice: int) -> list[dict]:
        return [entrada for entrada in self.entradas if entrada["indice"] > indice]

    def confirmar(self, entrada: dict, rol: str, aplicador) -> None:
        aplicador(None, entrada)
        self.entradas.append(dict(entrada))
        self.meta = {"epoch": entrada["epoch"], "rol": rol, "indice": entrada["indice"]}

    def cargar(self) -> dict | None:
        if self.meta is None:
            return None
        return dict(self.meta)

    def guardar_meta(self, epoch: int, rol: str, indice: int) -> None:
        self.meta = {"epoch": epoch, "rol": rol, "indice": indice}


def _guardar(cur, epoch: int, rol: str, indice: int) -> None:
    for clave, valor in (("epoch", epoch), ("rol", rol), ("indice", indice)):
        cur.execute(
            """
            INSERT INTO nodo_estado (clave, valor) VALUES (%s, %s)
            ON CONFLICT (clave) DO UPDATE SET valor = EXCLUDED.valor
            """,
            (clave, str(valor)),
        )
