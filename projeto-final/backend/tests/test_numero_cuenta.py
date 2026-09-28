import unittest

from banco.servicio.numero_cuenta import digito, normalizar_numero, numero_desde_id


class TestNumeroCuenta(unittest.TestCase):
    def test_el_mismo_id_da_el_mismo_numero(self):
        self.assertEqual(numero_desde_id("a1b2c3d4e5f6"), numero_desde_id("a1b2c3d4e5f6"))

    def test_formato(self):
        numero = numero_desde_id("a1b2c3d4e5f6")
        cuerpo, control = numero.split("-")
        self.assertEqual(len(cuerpo), 8)
        self.assertEqual(control, digito(cuerpo))

    def test_normaliza_agencia_y_guion(self):
        numero = numero_desde_id("a1b2c3d4e5f6")
        cuerpo, control = numero.split("-")
        self.assertEqual(normalizar_numero(f"0001 {cuerpo}{control}"), numero)
        self.assertEqual(normalizar_numero(numero), numero)


if __name__ == "__main__":
    unittest.main()
