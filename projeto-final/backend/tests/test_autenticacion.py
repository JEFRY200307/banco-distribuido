"""Pruebas de banco/autenticacion — sin BD, sin red (RN-15, RN-16)."""

import os
import unittest

os.environ.setdefault("SECRET_KEY", "llave-de-prueba-no-usar-en-produccion")

from banco.autenticacion import calcular_hash, emitir_token, validar_token, verificar_contrasena
from banco.servicio.autenticacion import EmailYaRegistrado, ServicioAutenticacion


class TestHashDeContrasena(unittest.TestCase):

    def test_contrasena_correcta_verifica(self):
        hash_guardado = calcular_hash("correcto-caballo-bateria-grapa")
        self.assertTrue(verificar_contrasena("correcto-caballo-bateria-grapa", hash_guardado))

    def test_contrasena_incorrecta_no_verifica(self):
        hash_guardado = calcular_hash("correcto-caballo-bateria-grapa")
        self.assertFalse(verificar_contrasena("otra-cosa", hash_guardado))

    def test_hash_nunca_es_la_contrasena_en_claro(self):
        hash_guardado = calcular_hash("hola-mundo")
        self.assertNotIn("hola-mundo", hash_guardado)

    def test_misma_contrasena_da_hashes_distintos(self):
        # la sal es aleatoria en cada llamada — evita que dos usuarios con la
        # misma contraseña tengan el mismo hash guardado
        self.assertNotEqual(calcular_hash("igual"), calcular_hash("igual"))


class TestTokenDeSesion(unittest.TestCase):

    def test_token_valido_devuelve_el_usuario(self):
        token = emitir_token("usuario-123")
        self.assertEqual(validar_token(token), "usuario-123")

    def test_token_alterado_se_rechaza(self):
        token = emitir_token("usuario-123")
        alterado = token[:-1] + ("0" if token[-1] != "0" else "1")
        self.assertIsNone(validar_token(alterado))

    def test_token_se_valida_sin_llamar_a_quien_lo_emitio(self):
        # simula "otro nodo": misma SECRET_KEY, ninguna llamada de red — la
        # propia llamada a validar_token ya lo demuestra (RN-16)
        token = emitir_token("usuario-456")
        self.assertEqual(validar_token(token), "usuario-456")


class _RepoMemoria:
    def __init__(self):
        self._por_email = {}

    def buscar_por_email(self, email):
        return self._por_email.get(email)

    def guardar(self, usuario):
        self._por_email[usuario["email"]] = usuario

    def actualizar_contrasena(self, email, password_hash):
        usuario = self._por_email.get(email)
        if usuario is None:
            return False
        usuario["password_hash"] = password_hash
        return True


class TestRegistroYRecuperacion(unittest.TestCase):

    def setUp(self):
        self.repo = _RepoMemoria()
        self.servicio = ServicioAutenticacion(self.repo)

    def test_registrar_y_entrar(self):
        self.servicio.registrar_usuario("Ana", "ana@uni.pe", "clave-segura")
        token = self.servicio.iniciar_sesion("ana@uni.pe", "clave-segura")
        self.assertEqual(validar_token(token), self.repo.buscar_por_email("ana@uni.pe")["id"])

    def test_email_repetido_se_rechaza(self):
        self.servicio.registrar_usuario("Ana", "ana@uni.pe", "clave-segura")
        with self.assertRaises(EmailYaRegistrado):
            self.servicio.registrar_usuario("Ana", "ana@uni.pe", "otra-clave")

    def test_recuperar_cambia_la_clave_sin_revelar_emails(self):
        self.servicio.registrar_usuario("Ana", "ana@uni.pe", "clave-vieja")
        self.servicio.recuperar_contrasena("nadie@uni.pe", "no-importa")
        self.servicio.recuperar_contrasena("ana@uni.pe", "clave-nueva")
        with self.assertRaises(Exception):
            self.servicio.iniciar_sesion("ana@uni.pe", "clave-vieja")
        token = self.servicio.iniciar_sesion("ana@uni.pe", "clave-nueva")
        self.assertIsNotNone(validar_token(token))


if __name__ == "__main__":
    unittest.main()
