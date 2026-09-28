import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { api } from "../api/cliente.js";
import Aviso from "../componentes/Aviso.jsx";
import Boton from "../componentes/Boton.jsx";
import Campo from "../componentes/Campo.jsx";
import Pantalla from "../componentes/Pantalla.jsx";
import { useIdioma } from "../lib/idioma.jsx";
import { guardarToken } from "../lib/sesion.js";

export default function Login() {
  const [email, setEmail] = useState("");
  const [contrasena, setContrasena] = useState("");
  const [error, setError] = useState(null);
  const [ocupado, setOcupado] = useState(false);
  const { t } = useIdioma();
  const navegar = useNavigate();
  const aviso = useLocation().state?.aviso;

  async function enviar(evento) {
    evento.preventDefault();
    setError(null);
    setOcupado(true);
    try {
      const { token } = await api.login(email, contrasena);
      guardarToken(token);
      navegar("/inicio");
    } catch (err) {
      setError(err.message === "error de red" ? t("login.error") : err.message);
    } finally {
      setOcupado(false);
    }
  }

  return (
    <Pantalla titulo={t("login.titulo")}>
      <div className="portada">
        <img src="/logo.png" alt="" />
        <strong>{t("login.banco")}</strong>
        <p>{t("login.tagline")}</p>
      </div>
      <form className="tarjeta" onSubmit={enviar}>
        <Campo etiqueta={t("comun.email")} type="email" autoComplete="email" value={email}
               onChange={(e) => setEmail(e.target.value)} required />
        <Campo etiqueta={t("comun.contrasena")} type="password" autoComplete="current-password"
               value={contrasena} onChange={(e) => setContrasena(e.target.value)} required />
        <Aviso>{aviso}</Aviso>
        <Aviso error>{error}</Aviso>
        <Boton disabled={ocupado}>{ocupado ? t("login.entrando") : t("login.entrar")}</Boton>
      </form>
      <div className="enlaces">
        <Link to="/registro">{t("login.crear")}</Link>
        <Link to="/recuperar">{t("login.recuperar")}</Link>
      </div>
    </Pantalla>
  );
}
