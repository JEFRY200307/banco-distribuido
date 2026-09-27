"""Rol inicial y propuesta de una entrada, sin Postgres."""

import os
import unittest

from banco.cluster.almacen import AlmacenMemoria
from banco.cluster.nodo import NoSoyPrimario, Nodo


class TestRolUnico(unittest.TestCase):

    def setUp(self):
        self._rol = os.environ.pop("ROL", None)
        self._pares = os.environ.pop("PARES", None)

    def tearDown(self):
        if self._rol is None:
            os.environ.pop("ROL", None)
        else:
            os.environ["ROL"] = self._rol
        if self._pares is None:
            os.environ.pop("PARES", None)
        else:
            os.environ["PARES"] = self._pares

    def test_sin_variable_solo_a_es_primario(self):
        self.assertTrue(Nodo("A").es_primario())
        self.assertFalse(Nodo("B").es_primario())
        self.assertEqual(Nodo("B").estado()["rol"], "replica")

    def test_rol_explicito_pisa_el_id(self):
        os.environ["ROL"] = "replica"
        self.assertFalse(Nodo("A").es_primario())
        os.environ["ROL"] = "primario"
        self.assertTrue(Nodo("B").es_primario())
        self.assertEqual(Nodo("B").estado()["rol"], "primario")


class TestProponer(unittest.TestCase):

    def _nodo(self, identificador, transporte, pares):
        aplicadas = []

        def aplicador(_conexion, entrada):
            aplicadas.append(entrada["op_id"])

        nodo = Nodo(identificador, pares=pares, almacen=AlmacenMemoria(),
                    aplicador=aplicador, transporte=transporte, arrancar=False)
        return nodo, aplicadas

    def test_el_ack_del_par_aplica_una_sola_vez(self):
        def transporte(metodo, url, cuerpo, params=None):
            return {"ok": True, "epoch": 1, "indice": 1, "rol": "replica", "nodo": "B"}

        nodo, aplicadas = self._nodo("A", transporte, ["http://b:8001"])
        self.assertTrue(nodo.proponer("op-1", "DEPOSITO", {"saldo_centavos": 10}))
        self.assertTrue(nodo.proponer("op-1", "DEPOSITO", {"saldo_centavos": 10}))
        self.assertEqual(aplicadas, ["op-1"])
        self.assertEqual(nodo.estado()["indice"], 1)
        self.assertEqual(nodo.estado()["modo"], "arrendamiento")

    def test_sin_ack_no_aplica(self):
        def transporte(metodo, url, cuerpo, params=None):
            raise RuntimeError("caido")

        nodo, aplicadas = self._nodo("A", transporte, ["http://b:8001"])
        self.assertFalse(nodo.proponer("op-2", "DEPOSITO", {}))
        self.assertEqual(aplicadas, [])

    def test_en_solitario_no_espera_al_par(self):
        def transporte(metodo, url, cuerpo, params=None):
            raise AssertionError("no debía llamar al par")

        nodo, aplicadas = self._nodo("A", transporte, ["http://b:8001"])
        nodo._protocolo.en_solitario = True
        self.assertTrue(nodo.proponer("op-3", "DEPOSITO", {"saldo_centavos": 5}))
        self.assertEqual(aplicadas, ["op-3"])

    def test_la_replica_rechaza_la_propuesta(self):
        nodo, _ = self._nodo("B", lambda *args, **kwargs: {}, ["http://a:8001"])
        with self.assertRaises(NoSoyPrimario):
            nodo.proponer("op-4", "DEPOSITO", {})

    def test_tres_nodos_piden_mayoria(self):
        def transporte(metodo, url, cuerpo, params=None):
            if "://c:" in url:
                raise RuntimeError("caido")
            return {"ok": True, "epoch": 1, "indice": 1, "rol": "replica", "nodo": "B"}

        nodo, aplicadas = self._nodo("A", transporte, ["http://b:8001", "http://c:8001"])
        self.assertEqual(nodo.estado()["modo"], "mayoria")
        self.assertTrue(nodo.proponer("op-5", "DEPOSITO", {}))
        self.assertEqual(aplicadas, ["op-5"])


if __name__ == "__main__":
    unittest.main()
