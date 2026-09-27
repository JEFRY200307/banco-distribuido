"""Rol del nodo mientras no existe la elección."""

import os
import unittest

from banco.cluster.nodo import Nodo


class TestRolUnico(unittest.TestCase):

    def setUp(self):
        self._rol = os.environ.pop("ROL", None)

    def tearDown(self):
        if self._rol is None:
            os.environ.pop("ROL", None)
        else:
            os.environ["ROL"] = self._rol

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


if __name__ == "__main__":
    unittest.main()
