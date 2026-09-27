"""Nodo del clúster — la elección real sigue en ROADMAP.md, subfase 2.x.

Hasta que exista el voto, el rol no puede quedar en "todos son primario":
el balanceador mandaría cada petición a un nodo distinto y los datos no
están copiados. Sin variable `ROL`, solo el nodo A es primario. `ROL=primario`
o `ROL=replica` lo pisa (para promover a B si A cae, a mano).

La replicación sigue en stub: `replicar_y_esperar_mayoria` confirma en este
nodo solo. Por eso las lecturas también tienen que ir al primario.
"""

import os


class Nodo:

    def __init__(self, identificador: str):
        self.id = identificador
        self._epoch = 1

    def es_primario(self) -> bool:
        rol = os.environ.get("ROL")
        if rol:
            return rol.strip().lower() == "primario"
        return self.id == "A"

    def estado(self) -> dict:
        return {
            "nodo": self.id,
            "rol": "primario" if self.es_primario() else "replica",
            "epoch": self._epoch,
        }

    def replicar_y_esperar_mayoria(self, entrada: dict) -> bool:
        # TODO(prototipo-2): POST /interno/replicar a los pares y contar
        # confirmaciones (RF-10). Hoy no hay pares — una entrada durable en
        # este único nodo ya se da por confirmada, igual que
        # prototipo-1/banco/cluster/no.py en su etapa 1.
        return True
