"""Rol, arrendamiento de 2 nodos y mayoría de 3, sin red ni Postgres."""

import unittest

from banco.cluster.protocolo import Protocolo


def _par(identificador, rol, visto=0.0):
    return Protocolo(identificador, numero_pares=1, rol=rol, visto=visto)


class TestDosNodos(unittest.TestCase):

    def test_con_los_dos_vivos_hace_falta_el_ack(self):
        primario = _par("A", "primario")
        self.assertTrue(primario.puede_confirmar(1))
        self.assertFalse(primario.puede_confirmar(0))

    def test_si_el_primario_calla_la_replica_asume_antes(self):
        primario = _par("A", "primario")
        replica = _par("B", "replica")
        replica.recibir_latido({"id": "A", "epoch": 1, "rol": "primario", "url": "http://a"}, 0)

        self.assertEqual(primario.revisar(0.5), "cedio")
        self.assertFalse(primario.es_primario())
        self.assertIsNone(replica.revisar(0.5))
        self.assertEqual(replica.revisar(1.0), "promovido")
        self.assertTrue(replica.es_primario())
        self.assertEqual(replica.epoch, 2)
        self.assertTrue(replica.en_solitario)
        self.assertTrue(replica.puede_confirmar(0))

    def test_el_que_cedio_oye_el_epoch_nuevo_y_no_vuelve_a_asumir(self):
        primario = _par("A", "primario")
        primario.revisar(0.5)
        primario.recibir_latido(
            {"id": "B", "epoch": 2, "rol": "primario", "url": "http://b"}, 1.1)
        self.assertIsNone(primario.revisar(1.6))
        self.assertFalse(primario.es_primario())
        self.assertEqual(primario.epoch, 2)
        self.assertEqual(primario.lider_url, "http://b")

    def test_si_la_replica_no_vuelve_el_primario_sigue_solo(self):
        primario = _par("A", "primario")
        self.assertEqual(primario.revisar(0.5), "cedio")
        self.assertEqual(primario.revisar(1.5), "promovido")
        self.assertTrue(primario.en_solitario)
        self.assertIsNone(primario.revisar(5))
        self.assertTrue(primario.es_primario())
        self.assertTrue(primario.puede_confirmar(0))

    def test_a_igual_epoch_el_id_mayor_se_queda(self):
        nodo_a = _par("A", "primario")
        nodo_a.epoch = 2
        nodo_a.recibir_latido({"id": "B", "epoch": 2, "rol": "primario", "url": "http://b"}, 3)
        self.assertFalse(nodo_a.es_primario())
        self.assertEqual(nodo_a.lider_url, "http://b")


class TestTresNodos(unittest.TestCase):

    def test_la_mayoria_es_dos_y_un_ack_alcanza(self):
        primario = Protocolo("A", numero_pares=2, rol="primario", visto=0)
        self.assertEqual(primario.mayoria(), 2)
        self.assertFalse(primario.usa_arrendamiento())
        self.assertTrue(primario.puede_confirmar(1))
        self.assertFalse(primario.puede_confirmar(0))

    def test_sin_latido_cede_y_el_de_menor_espera_pide_votos(self):
        primario = Protocolo("A", numero_pares=2, rol="primario", visto=0)
        self.assertEqual(primario.revisar(0.5), "cedio")
        candidato = Protocolo("B", numero_pares=2, rol="replica", visto=0)
        otro = Protocolo("C", numero_pares=2, rol="replica", visto=0)
        self.assertEqual(candidato.revisar(1.0), "candidatura")
        self.assertIsNone(otro.revisar(1.0))
        self.assertEqual(otro.revisar(1.2), "candidatura")

    def test_dos_votos_lo_hacen_primario_y_el_log_atrasado_no_vota(self):
        candidato = Protocolo("B", numero_pares=2, rol="replica", visto=0)
        votante = Protocolo("C", numero_pares=2, rol="replica", visto=0)
        candidato.revisar(1.0)
        pedido = candidato.pedido_voto()
        concedido, motivo = votante.conceder_voto(pedido, ultimo_indice=0, ultimo_epoch=0, ahora=1)
        self.assertTrue(concedido, motivo)
        self.assertTrue(candidato.asumir(2, 1.1))
        self.assertTrue(candidato.es_primario())
        self.assertFalse(candidato.puede_confirmar(0))

        atrasado = Protocolo("D", numero_pares=2, rol="candidato", epoch=3, visto=0)
        atrasado.indice = 0
        atrasado.epoch_log = 0
        votante.indice = 5
        votante.epoch_log = 2
        ok, porque = votante.conceder_voto(atrasado.pedido_voto(), 5, 2, 2)
        self.assertFalse(ok)
        self.assertEqual(porque, "log_atrasado")


class TestUnNodo(unittest.TestCase):

    def test_confirma_solo_y_no_cambia_de_rol(self):
        nodo = Protocolo("A", numero_pares=0, rol="primario", visto=0)
        self.assertTrue(nodo.puede_confirmar(0))
        self.assertIsNone(nodo.revisar(10))
        self.assertTrue(nodo.es_primario())


if __name__ == "__main__":
    unittest.main()
