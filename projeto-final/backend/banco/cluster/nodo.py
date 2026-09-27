"""Nodo del clúster: propone escrituras, late y, si hace falta, asume.

`PARES` es la lista de URLs de los otros backends (no de sus Postgres),
separadas por coma. Sin esa variable el nodo trabaja solo: confirma en
su base y no hay relevo.

Con un par (dos nodos en total) usa arrendamiento. Con dos pares o más,
mayoría. El hilo de fondo llama a `Protocolo.revisar` cada `LATIDO_S`.
"""

import logging
import os
import threading
import time

import httpx

from banco.cluster.almacen import AlmacenPostgres
from banco.cluster.aplicar import aplicar_entrada
from banco.cluster.protocolo import LATIDO_S, Protocolo

logger = logging.getLogger("banco.cluster")

_TIMEOUT = httpx.Timeout(0.4)


class NoSoyPrimario(Exception):

    def __init__(self, lider: str | None):
        self.lider = lider
        super().__init__("no_soy_primario")


def _leer_pares() -> list[str]:
    bruto = os.environ.get("PARES", "").strip()
    if not bruto:
        return []
    return [parte.strip().rstrip("/") for parte in bruto.split(",") if parte.strip()]


def _rol_inicial(identificador: str) -> str:
    rol = os.environ.get("ROL", "").strip().lower()
    if rol == "primario":
        return "primario"
    if rol == "replica":
        return "replica"
    return "primario" if identificador == "A" else "replica"


class Nodo:

    def __init__(self, identificador: str, pares: list[str] | None = None,
                 almacen=None, aplicador=None, transporte=None, arrancar: bool | None = None):
        self.id = identificador
        self._pares = _leer_pares() if pares is None else [p.rstrip("/") for p in pares]
        self._almacen = almacen
        self._aplicador = aplicador or aplicar_entrada
        self._transporte = transporte or _http
        self._protocolo = Protocolo(
            identificador, len(self._pares), rol=_rol_inicial(identificador),
            visto=time.monotonic())
        self._lock = threading.Lock()
        self._escritura = threading.Lock()
        self._frenar = threading.Event()
        self._listo = threading.Event()
        self._hilo: threading.Thread | None = None
        self._firma: tuple | None = None
        self.url_propia = os.environ.get("URL_PROPIA", "").strip().rstrip("/") or None
        if arrancar is None:
            arrancar = bool(self._pares)
        if arrancar:
            self._hilo = threading.Thread(target=self._ciclo, name=f"cluster-{self.id}", daemon=True)
            self._hilo.start()
        else:
            self._listo.set()

    def es_primario(self) -> bool:
        with self._lock:
            return self._protocolo.es_primario()

    def estado(self) -> dict:
        with self._lock:
            protocolo = self._protocolo
            return {
                "nodo": protocolo.id,
                "rol": "primario" if protocolo.es_primario() else "replica",
                "epoch": protocolo.epoch,
                "indice": protocolo.indice,
                "lider": protocolo.lider_url,
                "en_solitario": protocolo.en_solitario,
                "mayoria": protocolo.mayoria(),
                "nodos": protocolo.total,
                "modo": "arrendamiento" if protocolo.usa_arrendamiento() else "mayoria",
            }

    def proponer(self, op_id: str, tipo: str, cuerpo: dict) -> bool:
        """Guarda la entrada aquí y en los pares. False: no hubo confirmación."""
        self._listo.wait(2)
        with self._escritura:
            almacen = self._store()
            with self._lock:
                self._protocolo.revisar(time.monotonic())
                if not self._protocolo.es_primario():
                    raise NoSoyPrimario(self._protocolo.lider_url)
                if almacen.tiene(op_id):
                    return True
                entrada = self._entrada(op_id, tipo, cuerpo)
                solo = self._protocolo.en_solitario or self._protocolo.total <= 1
            acks, ceder = (0, False) if solo else self._difundir(entrada)
            if ceder:
                self._traer_log()
                with self._lock:
                    if almacen.tiene(op_id):
                        return True
                    if not self._protocolo.es_primario():
                        raise NoSoyPrimario(self._protocolo.lider_url)
                    entrada = self._entrada(op_id, tipo, cuerpo)
                acks, ceder = self._difundir(entrada)
                if ceder and not self.es_primario():
                    raise NoSoyPrimario(self.estado().get("lider"))
            with self._lock:
                if not self._protocolo.puede_confirmar(acks):
                    return False
                rol = "primario"
            almacen.confirmar(entrada, rol, self._aplicador)
            with self._lock:
                self._protocolo.confirmar_indice(entrada["indice"], entrada["epoch"])
                self._recordar()
            return True

    def recibir_replicacion(self, entrada: dict) -> dict:
        with self._lock:
            if int(entrada["epoch"]) < self._protocolo.epoch:
                return self._respuesta(False)
            if int(entrada["epoch"]) > self._protocolo.epoch:
                self._protocolo.recibir_latido(
                    {"id": entrada.get("id_lider", "?"), "epoch": entrada["epoch"],
                     "rol": "primario", "url": entrada.get("url_lider")},
                    time.monotonic())
            if self._store().tiene(entrada["op_id"]):
                self._protocolo.confirmar_indice(int(entrada["indice"]), int(entrada["epoch"]))
                return self._respuesta(True)
            if int(entrada["indice"]) != self._protocolo.indice + 1:
                return self._respuesta(False, atras=True)
            rol = "replica"
        try:
            self._store().confirmar(entrada, rol, self._aplicador)
        except Exception:
            logger.warning("no se pudo aplicar la entrada %s", entrada.get("op_id"), exc_info=True)
            return self._respuesta(False, atras=True)
        with self._lock:
            self._protocolo.confirmar_indice(int(entrada["indice"]), int(entrada["epoch"]))
            self._protocolo.anotar_contacto(time.monotonic(), int(entrada["indice"]))
            self._recordar()
            return self._respuesta(True)

    def recibir_latido(self, anuncio: dict) -> dict:
        with self._lock:
            self._protocolo.recibir_latido(anuncio, time.monotonic())
            self._recordar()
            return self.estado_sin_lock()

    def recibir_voto(self, pedido: dict) -> dict:
        with self._lock:
            concedido, motivo = self._protocolo.conceder_voto(
                pedido, self._protocolo.indice, self._protocolo.epoch_log, time.monotonic())
            self._recordar()
            return {"concedido": concedido, "motivo": motivo, "epoch": self._protocolo.epoch}

    def entradas_desde(self, indice: int) -> list[dict]:
        return self._store().entradas_desde(indice)

    def estado_sin_lock(self) -> dict:
        protocolo = self._protocolo
        return {
            "nodo": protocolo.id,
            "rol": "primario" if protocolo.es_primario() else "replica",
            "epoch": protocolo.epoch,
            "indice": protocolo.indice,
            "lider": protocolo.lider_url,
            "en_solitario": protocolo.en_solitario,
            "mayoria": protocolo.mayoria(),
            "nodos": protocolo.total,
            "modo": "arrendamiento" if protocolo.usa_arrendamiento() else "mayoria",
        }

    def base_disponible(self) -> bool:
        try:
            self._store().ultimo_indice()
            return True
        except Exception:
            return False

    def detener(self) -> None:
        self._frenar.set()
        if self._hilo is not None:
            self._hilo.join(timeout=2)

    def _entrada(self, op_id: str, tipo: str, cuerpo: dict) -> dict:
        return {
            "indice": self._protocolo.indice + 1,
            "epoch": self._protocolo.epoch,
            "op_id": op_id,
            "tipo": tipo,
            "cuerpo": cuerpo,
            "id_lider": self.id,
            "url_lider": self.url_propia,
        }

    def _respuesta(self, ok: bool, atras: bool = False) -> dict:
        cuerpo = self.estado_sin_lock()
        cuerpo["ok"] = ok
        cuerpo["atras"] = atras
        return cuerpo

    def _store(self):
        if self._almacen is None:
            self._almacen = AlmacenPostgres()
        return self._almacen

    def _recordar(self) -> None:
        protocolo = self._protocolo
        firma = (protocolo.epoch, protocolo.rol, protocolo.indice)
        if firma == self._firma:
            return
        self._firma = firma
        self._store().guardar_meta(protocolo.epoch, protocolo.rol, protocolo.indice)

    def _difundir(self, entrada: dict) -> tuple[int, bool]:
        acks = 0
        ceder = False
        for url in self._pares:
            datos = self._post(url, "/interno/replicar", entrada)
            if datos is None:
                continue
            if int(datos.get("epoch", 0)) > int(entrada["epoch"]):
                ceder = True
                with self._lock:
                    self._protocolo.recibir_latido(
                        {"id": datos.get("nodo", "?"), "epoch": datos["epoch"],
                         "rol": datos.get("rol", "primario"), "url": url},
                        time.monotonic())
                continue
            if datos.get("ok"):
                acks += 1
                with self._lock:
                    self._protocolo.anotar_contacto(time.monotonic(), datos.get("indice"))
            elif int(datos.get("indice", 0)) > int(entrada["indice"]):
                ceder = True
        return acks, ceder

    def _ciclo(self) -> None:
        try:
            self._recuperar()
            self._sondear()
        finally:
            self._listo.set()
        while not self._frenar.is_set():
            ahora = time.monotonic()
            if not self.base_disponible():
                # Sin Postgres este nodo no puede confirmar ni asumir: si lo
                # hiciera, el otro dejaría de escribir y aquí no quedaría nada.
                with self._lock:
                    self._protocolo.rol = "replica"
                    self._protocolo.en_solitario = False
                    self._protocolo.visto = ahora
                self._frenar.wait(LATIDO_S)
                continue
            with self._lock:
                self._protocolo.revisar(ahora)
                rol = self._protocolo.rol
                self._recordar()
            if rol == "primario":
                self._latir()
            elif rol == "candidato":
                self._votar()
            else:
                self._traer_log()
            self._frenar.wait(LATIDO_S)

    def _recuperar(self) -> None:
        guardado = self._store().cargar()
        if not guardado:
            return
        with self._lock:
            self._protocolo.epoch = guardado["epoch"]
            self._protocolo.rol = guardado["rol"]
            self._protocolo.indice = max(self._protocolo.indice, guardado["indice"])
            self._protocolo.indice = max(self._protocolo.indice, self._store().ultimo_indice())
            self._firma = (self._protocolo.epoch, self._protocolo.rol, self._protocolo.indice)

    def _sondear(self) -> None:
        ahora = time.monotonic()
        alguno = False
        for url in self._pares:
            datos = self._get(url, "/interno/estado")
            if not datos:
                continue
            alguno = True
            with self._lock:
                self._protocolo.recibir_latido(_anuncio(datos, url), ahora)
        with self._lock:
            if alguno:
                return
            if self._protocolo.es_primario() and self._protocolo.usa_arrendamiento():
                self._protocolo.visto = ahora
                self._protocolo.en_solitario = True
            elif not self._protocolo.es_primario():
                self._protocolo.visto = ahora - self._protocolo.espera_promocion()

    def _latir(self) -> None:
        with self._lock:
            anuncio = _anuncio(self.estado_sin_lock(), self.url_propia)
            visto_antes = self._protocolo.visto
        respuestas = 0
        indice_par = None
        for url in self._pares:
            datos = self._post(url, "/interno/latido", anuncio)
            if not datos:
                continue
            respuestas += 1
            indice_par = datos.get("indice")
            with self._lock:
                self._protocolo.recibir_latido(_anuncio(datos, url), time.monotonic())
        with self._lock:
            if not self._protocolo.es_primario():
                return
            suficientes = respuestas >= 1 if self._protocolo.usa_arrendamiento() else (
                1 + respuestas >= self._protocolo.mayoria())
            if suficientes:
                self._protocolo.anotar_contacto(time.monotonic(), indice_par)
            else:
                self._protocolo.visto = visto_antes

    def _votar(self) -> None:
        with self._lock:
            if self._protocolo.rol != "candidato":
                return
            pedido = self._protocolo.pedido_voto()
        votos = 1
        for url in self._pares:
            datos = self._post(url, "/interno/votar", pedido)
            if datos and datos.get("concedido"):
                votos += 1
            elif datos and int(datos.get("epoch", 0)) > pedido["epoch"]:
                with self._lock:
                    self._protocolo.recibir_latido(
                        {"id": "?", "epoch": datos["epoch"], "rol": "primario", "url": url},
                        time.monotonic())
                return
        with self._lock:
            self._protocolo.asumir(votos, time.monotonic())
            self._recordar()

    def _traer_log(self) -> None:
        with self._lock:
            lider = self._protocolo.lider_url
            indice = self._protocolo.indice
            if self._protocolo.es_primario() or not lider:
                return
        datos = self._get(lider, "/interno/log", params={"desde": indice})
        if not datos:
            return
        for entrada in datos.get("entradas", []):
            self.recibir_replicacion(entrada)

    def _post(self, url: str, ruta: str, cuerpo: dict) -> dict | None:
        try:
            return self._transporte("POST", f"{url}{ruta}", cuerpo)
        except Exception:
            logger.debug("sin respuesta de %s%s", url, ruta, exc_info=True)
            return None

    def _get(self, url: str, ruta: str, params: dict | None = None) -> dict | None:
        try:
            return self._transporte("GET", f"{url}{ruta}", None, params)
        except Exception:
            logger.debug("sin respuesta de %s%s", url, ruta, exc_info=True)
            return None


def _anuncio(datos: dict, url: str | None) -> dict:
    return {
        "id": datos.get("nodo") or datos.get("id"),
        "epoch": datos.get("epoch", 1),
        "rol": datos.get("rol"),
        "indice": datos.get("indice", 0),
        "url": url,
    }


def _http(metodo: str, url: str, cuerpo: dict | None, params: dict | None = None) -> dict:
    if metodo == "GET":
        respuesta = httpx.get(url, params=params, timeout=_TIMEOUT)
    else:
        respuesta = httpx.post(url, json=cuerpo, timeout=_TIMEOUT)
    respuesta.raise_for_status()
    return respuesta.json()
