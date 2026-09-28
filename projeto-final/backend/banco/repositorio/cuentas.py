"""RepositorioCuentas — ver docs/entregables/06-diseno-detallado/diagrama-de-clases-servicio.md.

Traduce filas de `cuenta` (docs/entregables/05-modelo-de-datos/modelo-fisico.md)
a diccionarios simples. No conoce reglas de negocio — eso vive en dominio/.
"""


class RepositorioCuentas:

    def __init__(self, conexion):
        self._conexion = conexion

    def buscar_por_id(self, cuenta_id: str) -> dict | None:
        with self._conexion.cursor() as cur:
            cur.execute("SELECT * FROM cuenta WHERE id = %s", (cuenta_id,))
            return cur.fetchone()

    def listar_por_usuario(self, usuario_id: str) -> list[dict]:
        with self._conexion.cursor() as cur:
            cur.execute(
                "SELECT * FROM cuenta WHERE usuario_id = %s ORDER BY fecha_creacion",
                (usuario_id,),
            )
            return cur.fetchall()

    def buscar_por_numero(self, numero_cuenta: str) -> dict | None:
        with self._conexion.cursor() as cur:
            cur.execute(
                "SELECT * FROM cuenta WHERE numero_cuenta = %s",
                (numero_cuenta,),
            )
            return cur.fetchone()

    def guardar(self, cuenta: dict) -> None:
        """Inserta o actualiza — usado tanto al crear como al debitar/acreditar."""
        fila = dict(cuenta)
        fila.setdefault("agencia", "0001")
        fila.setdefault("numero_cuenta", None)
        with self._conexion.cursor() as cur:
            cur.execute(
                """
                INSERT INTO cuenta (id, usuario_id, moneda, saldo_centavos,
                                     fecha_creacion, estado, tipo_producto,
                                     tasa_interes, fecha_ultimo_interes,
                                     fecha_vencimiento, agencia, numero_cuenta)
                VALUES (%(id)s, %(usuario_id)s, %(moneda)s, %(saldo_centavos)s,
                        %(fecha_creacion)s, %(estado)s, %(tipo_producto)s,
                        %(tasa_interes)s, %(fecha_ultimo_interes)s,
                        %(fecha_vencimiento)s, %(agencia)s, %(numero_cuenta)s)
                ON CONFLICT (id) DO UPDATE SET
                    saldo_centavos = EXCLUDED.saldo_centavos,
                    estado = EXCLUDED.estado,
                    fecha_ultimo_interes = EXCLUDED.fecha_ultimo_interes,
                    numero_cuenta = COALESCE(EXCLUDED.numero_cuenta, cuenta.numero_cuenta),
                    agencia = COALESCE(EXCLUDED.agencia, cuenta.agencia)
                """,
                fila,
            )
