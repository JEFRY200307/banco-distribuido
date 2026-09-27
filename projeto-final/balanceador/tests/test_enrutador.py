"""Pruebas del enrutador — sin nodos reales, con httpx.MockTransport."""

import unittest

import httpx

from balanceador.enrutador import Enrutador

NODOS = [
    {"id": "A", "endereco": "nodo-a", "porta": 8001},
    {"id": "B", "endereco": "nodo-b", "porta": 8001},
    {"id": "C", "endereco": "nodo-c", "porta": 8001},
]


def _url_base(nodo):
    return f"http://{nodo['endereco']}:{nodo['porta']}"


class TestEncontrarPrimario(unittest.TestCase):

    def test_encuentra_al_primero_que_dice_ser_primario(self):
        def manejador(request: httpx.Request) -> httpx.Response:
            if "nodo-b" in str(request.url):
                return httpx.Response(200, json={"rol": "primario"})
            return httpx.Response(200, json={"rol": "replica"})

        cliente = httpx.Client(transport=httpx.MockTransport(manejador))
        original = httpx.get
        httpx.get = lambda url, timeout: cliente.get(url)
        try:
            enrutador = Enrutador(NODOS, _url_base)
            self.assertEqual(enrutador.encontrar_primario(), "http://nodo-b:8001")
        finally:
            httpx.get = original

    def test_cachea_el_primario_para_no_preguntar_de_nuevo(self):
        llamadas = []

        def manejador(request: httpx.Request) -> httpx.Response:
            llamadas.append(str(request.url))
            return httpx.Response(200, json={"rol": "primario"})

        cliente = httpx.Client(transport=httpx.MockTransport(manejador))
        original = httpx.get
        httpx.get = lambda url, timeout: cliente.get(url)
        try:
            enrutador = Enrutador(NODOS, _url_base)
            primera = enrutador.encontrar_primario()
            segunda = enrutador.encontrar_primario()
            self.assertEqual(primera, segunda)
            self.assertTrue(any(url.startswith(primera) for url in llamadas))
        finally:
            httpx.get = original


class TestEpoch(unittest.TestCase):

    def test_si_dos_dicen_primario_gana_el_epoch_mayor(self):
        def manejador(request: httpx.Request) -> httpx.Response:
            if "nodo-a" in str(request.url):
                return httpx.Response(200, json={"rol": "primario", "epoch": 1})
            if "nodo-b" in str(request.url):
                return httpx.Response(200, json={"rol": "primario", "epoch": 4})
            return httpx.Response(200, json={"rol": "replica", "epoch": 4})

        cliente = httpx.Client(transport=httpx.MockTransport(manejador))
        original = httpx.get
        httpx.get = lambda url, timeout: cliente.get(url)
        try:
            enrutador = Enrutador(NODOS, _url_base)
            self.assertEqual(enrutador.encontrar_primario(), "http://nodo-b:8001")
        finally:
            httpx.get = original


class TestReenviar(unittest.TestCase):

    def test_lectura_va_al_primario_y_no_a_la_replica(self):
        vistos = []

        def manejador(request: httpx.Request) -> httpx.Response:
            vistos.append(str(request.url))
            if request.url.path == "/interno/estado":
                rol = "primario" if "nodo-b" in str(request.url) else "replica"
                return httpx.Response(200, json={"rol": rol})
            return httpx.Response(200, json={"ok": True})

        cliente = httpx.Client(transport=httpx.MockTransport(manejador))
        original_get, original_request = httpx.get, httpx.request
        httpx.get = lambda url, timeout: cliente.get(url)
        httpx.request = lambda metodo, url, timeout, **kwargs: cliente.request(metodo, url)
        try:
            enrutador = Enrutador(NODOS, _url_base)
            respuesta = enrutador.reenviar("GET", "/cuentas/1", False)
            self.assertEqual(respuesta.status_code, 200)
            self.assertTrue(any(url.startswith("http://nodo-b:8001/cuentas/1") for url in vistos))
            self.assertFalse(any(url.startswith("http://nodo-a:8001/cuentas/1") for url in vistos))
        finally:
            httpx.get, httpx.request = original_get, original_request

    def test_el_409_puede_venir_dentro_de_detail(self):
        def manejador(request: httpx.Request) -> httpx.Response:
            if request.url.path == "/interno/estado":
                rol = "primario" if "nodo-a" in str(request.url) else "replica"
                return httpx.Response(200, json={"rol": rol, "epoch": 1})
            if "nodo-a" in str(request.url):
                return httpx.Response(409, json={"detail": {"primario_provavel": "http://nodo-b:8001"}})
            return httpx.Response(200, json={"ok": True})

        cliente = httpx.Client(transport=httpx.MockTransport(manejador))
        original_get, original_request = httpx.get, httpx.request
        httpx.get = lambda url, timeout: cliente.get(url)
        httpx.request = lambda metodo, url, timeout, **kwargs: cliente.request(metodo, url)
        try:
            enrutador = Enrutador(NODOS, _url_base)
            respuesta = enrutador.reenviar("POST", "/cuentas/1/deposito", True)
            self.assertEqual(respuesta.status_code, 200)
            self.assertEqual(enrutador._primario_cacheado, "http://nodo-b:8001")
        finally:
            httpx.get, httpx.request = original_get, original_request


if __name__ == "__main__":
    unittest.main()
