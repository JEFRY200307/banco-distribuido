"""Rol, epoch y cuándo una escritura está confirmada.

Un solo código para cualquier tamaño. Con 1 nodo no hay a quién copiar.
Con 2, el arrendamiento: el primario suelta el mando si el otro no contesta,
y la réplica espera un poco más antes de asumirlo, así no escriben los dos
a la vez. Con 3 o más, la mayoría es ``nodos // 2 + 1``: un nodo caído no
impide confirmar ni elegir.

Los tiempos no van dentro de cada depósito. Corren en el latido.
"""

ARRENDAMIENTO_S = 0.5
PROMOCION_S = 1.0
LATIDO_S = 0.2


class Protocolo:

    def __init__(self, identificador: str, numero_pares: int, rol: str = "replica",
                 epoch: int = 1, visto: float | None = None,
                 arrendamiento_s: float = ARRENDAMIENTO_S,
                 promocion_s: float = PROMOCION_S):
        self.id = identificador
        self.numero_pares = numero_pares
        self.total = 1 + numero_pares
        self.rol = rol
        self.epoch = epoch
        self.indice = 0
        self.epoch_log = 0
        self.visto = 0.0 if visto is None else visto
        self.en_solitario = False
        self.lider_url: str | None = None
        self.voto_en: str | None = None
        self.arrendamiento_s = arrendamiento_s
        self.promocion_s = promocion_s
        self._candidatura_abierta = False

    def mayoria(self) -> int:
        return self.total // 2 + 1

    def es_primario(self) -> bool:
        return self.rol == "primario"

    def usa_arrendamiento(self) -> bool:
        """Con 2 nodos el silencio del par alcanza para seguir escribiendo.
        Con 3 o más hace falta la mayoría, y un silencio no promueve a nadie."""
        return self.total <= 2

    def puede_confirmar(self, acks: int) -> bool:
        if not self.es_primario():
            return False
        if self.total <= 1:
            return True
        if self.usa_arrendamiento():
            if acks >= 1:
                return True
            return self.en_solitario
        return 1 + acks >= self.mayoria()

    def anotar_contacto(self, ahora: float, indice_par: int | None = None) -> None:
        self.visto = ahora
        if indice_par is not None and indice_par >= self.indice:
            self.en_solitario = False

    def recibir_latido(self, anuncio: dict, ahora: float) -> None:
        epoch = int(anuncio["epoch"])
        if epoch < self.epoch:
            return
        if epoch > self.epoch:
            self._bajar(epoch, anuncio.get("url"), ahora)
            return
        if anuncio.get("rol") != "primario":
            return
        otro = anuncio.get("id")
        if self.es_primario() and otro and otro != self.id and otro > self.id:
            self._bajar(epoch, anuncio.get("url"), ahora)
            return
        if not self.es_primario():
            if anuncio.get("url"):
                self.lider_url = anuncio["url"]
            self.visto = ahora
            self.en_solitario = False
            self._candidatura_abierta = False
            self.voto_en = None

    def _bajar(self, epoch: int, url: str | None, ahora: float) -> None:
        self.epoch = epoch
        self.rol = "replica"
        self.en_solitario = False
        self.visto = ahora
        self._candidatura_abierta = False
        self.voto_en = None
        if url:
            self.lider_url = url

    def espera_promocion(self) -> float:
        if self.usa_arrendamiento():
            return self.promocion_s
        # Con 3 o más, un desfase fijo por id evita que todos se postulen
        # en el mismo instante y se partan los votos.
        return self.promocion_s + (sum(ord(c) for c in self.id) % 3) * 0.2

    def revisar(self, ahora: float) -> str | None:
        if self.total <= 1:
            return None
        if self.rol == "primario":
            # En solitario el par ya se dio por caído: soltar el mando aquí
            # haría oscilar el rol mientras el otro sigue apagado.
            if self.en_solitario and self.usa_arrendamiento():
                return None
            if ahora - self.visto >= self.arrendamiento_s:
                self.rol = "replica"
                self.en_solitario = False
                self.visto = ahora
                self._candidatura_abierta = False
                return "cedio"
            return None
        if self.rol != "replica":
            return None
        if ahora - self.visto < self.espera_promocion():
            return None
        if self.usa_arrendamiento():
            self.epoch += 1
            self.rol = "primario"
            self.en_solitario = True
            self.visto = ahora
            self.lider_url = None
            return "promovido"
        self.epoch += 1
        self.rol = "candidato"
        self.voto_en = self.id
        self.visto = ahora
        self._candidatura_abierta = True
        return "candidatura"

    def pedido_voto(self) -> dict:
        return {
            "epoch": self.epoch,
            "id_candidato": self.id,
            "ultimo_indice": self.indice,
            "ultimo_epoch": self.epoch_log,
        }

    def conceder_voto(self, pedido: dict, ultimo_indice: int, ultimo_epoch: int,
                      ahora: float) -> tuple[bool, str]:
        if pedido["epoch"] < self.epoch:
            return False, "epoch_menor"
        if pedido["epoch"] > self.epoch:
            self.epoch = pedido["epoch"]
            self.voto_en = None
            self.rol = "replica"
            self.en_solitario = False
            self._candidatura_abierta = False
        if self.voto_en not in (None, pedido["id_candidato"]):
            return False, "ya_vote"
        if (pedido["ultimo_epoch"], pedido["ultimo_indice"]) < (ultimo_epoch, ultimo_indice):
            return False, "log_atrasado"
        self.voto_en = pedido["id_candidato"]
        self.visto = ahora
        return True, "concedido"

    def asumir(self, votos: int, ahora: float) -> bool:
        if self.rol != "candidato" or votos < self.mayoria():
            self.rol = "replica"
            self._candidatura_abierta = False
            self.visto = ahora
            return False
        self.rol = "primario"
        self.en_solitario = False
        self.visto = ahora
        self._candidatura_abierta = False
        self.lider_url = None
        return True

    def confirmar_indice(self, indice: int, epoch: int) -> None:
        if indice >= self.indice:
            self.indice = indice
            self.epoch_log = epoch
