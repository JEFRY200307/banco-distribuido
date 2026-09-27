"""El balanceador propio — ver
docs/entregables/03-arquitectura/diagrama-de-componentes.md, sección
"Por qué el balanceador es un componente propio".

No es un balanceador de carga clásico (round-robin): solo hay un primario.
Lecturas y escrituras van a ese nodo, el de `epoch` más alto si dos se
anuncian a la vez. La réplica puede ir un latido por detrás, así que un
GET no se manda ahí.

Sin estado durable: si este proceso se reinicia, vuelve a preguntar. Por
eso correr dos copias no necesita ningún protocolo de consenso.
"""

import logging

import httpx

logger = logging.getLogger("balanceador")


class Enrutador:

    def __init__(self, nodos: list[dict], url_base_fn, timeout_s: float = 2.0):
        self._nodos = nodos
        self._url_base = url_base_fn
        self._timeout_s = timeout_s
        self._primario_cacheado: str | None = None

    def _candidatos(self) -> list[str]:
        """El primario cacheado primero (si hay), luego el resto — así la
        mayoría de los pedidos no necesitan más que una llamada."""
        urls = [self._url_base(nodo) for nodo in self._nodos]
        if self._primario_cacheado and self._primario_cacheado in urls:
            urls.remove(self._primario_cacheado)
            urls.insert(0, self._primario_cacheado)
        return urls

    def cualquier_nodo_vivo(self) -> str:
        """Primer nodo que responda. No lo usa `reenviar`: sin réplica de
        datos, leer ahí pierde cuentas que solo están en el primario."""
        for url in self._candidatos():
            try:
                r = httpx.get(f"{url}/interno/estado", timeout=self._timeout_s)
                if r.status_code == 200:
                    return url
            except httpx.HTTPError:
                continue
        raise RuntimeError("sin_nodos_disponibles")

    def encontrar_primario(self) -> str:
        mejor_url = None
        mejor_epoch = -1
        for url in self._candidatos():
            try:
                r = httpx.get(f"{url}/interno/estado", timeout=self._timeout_s)
            except httpx.HTTPError:
                continue
            if r.status_code != 200:
                continue
            cuerpo = r.json()
            if cuerpo.get("rol") != "primario":
                continue
            epoch = int(cuerpo.get("epoch") or 0)
            if mejor_url is None or epoch > mejor_epoch:
                mejor_epoch = epoch
                mejor_url = url
        if mejor_url is None:
            raise RuntimeError("sin_primario_disponible")
        self._primario_cacheado = mejor_url
        return mejor_url

    def reenviar(self, metodo: str, ruta: str, es_escritura: bool, **kwargs) -> httpx.Response:
        """Reenvía una petición. Si el nodo que creíamos primario rechaza con
        409 (`nao_sou_primario`), sigue `primario_provavel` y reintenta una
        vez — igual que ya hace el cliente en CU-04, flujo 3a."""
        url = self.encontrar_primario()
        respuesta = httpx.request(metodo, f"{url}{ruta}", timeout=self._timeout_s, **kwargs)

        if es_escritura and respuesta.status_code == 409:
            cuerpo = _cuerpo(respuesta)
            probable = cuerpo.get("primario_provavel")
            if probable:
                logger.info("siguiendo primario_provavel=%s tras 409", probable)
                self._primario_cacheado = probable
                respuesta = httpx.request(metodo, f"{probable}{ruta}",
                                           timeout=self._timeout_s, **kwargs)
        return respuesta


def _cuerpo(respuesta: httpx.Response) -> dict:
    cuerpo = respuesta.json()
    detalle = cuerpo.get("detail")
    if isinstance(detalle, dict):
        return detalle
    return cuerpo
