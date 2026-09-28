import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/cliente.js";
import Aviso from "../componentes/Aviso.jsx";
import Boton from "../componentes/Boton.jsx";
import Campo from "../componentes/Campo.jsx";
import Pantalla from "../componentes/Pantalla.jsx";
import { useIdioma } from "../lib/idioma.jsx";

export default function Recuperar() {
  const [email, setEmail] = useState("");
  const [contrasena, setContrasena] = useState("");
  const [repetir, setRepetir] = useState("");
  const [error, setError] = useState(null);
  const [ocupado, setOcupado] = useState(false);
  const { t } = useIdioma();
  const navegar = useNavigate();

  async function enviar(evento) {
    evento.preventDefault();
    setError(null);
    if (contrasena.length < 8) {
      setError(t("registro.corta"));
      return;
    }
    if (contrasena !== repetir) {
      setError(t("recuperar.noCoincide"));
      return;
    }
    setOcupado(true);
    try {
      const respuesta = await api.recuperar(email, contrasena);
      navegar("/login", { state: { aviso: respuesta.mensaje } });
    } catch (err) {
      setError(err.message);
    } finally {
      setOcupado(false);
    }
  }

  return (
    <Pantalla titulo={t("recuperar.titulo")} volver>
      <Aviso>{t("recuperar.aviso")}</Aviso>
      <form className="tarjeta" onSubmit={enviar}>
        <Campo etiqueta={t("comun.email")} type="email" autoComplete="email" value={email}
               onChange={(e) => setEmail(e.target.value)} required />
        <Campo etiqueta={t("recuperar.nueva")} type="password" autoComplete="new-password"
               value={contrasena} onChange={(e) => setContrasena(e.target.value)} required />
        <Campo etiqueta={t("recuperar.repetir")} type="password" autoComplete="new-password"
               value={repetir} onChange={(e) => setRepetir(e.target.value)} required />
        <Aviso error>{error}</Aviso>
        <Boton disabled={ocupado}>{ocupado ? t("recuperar.guardando") : t("recuperar.boton")}</Boton>
      </form>
    </Pantalla>
  );
}
