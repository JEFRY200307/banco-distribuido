import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { api } from "../api/cliente.js";
import Aviso from "../componentes/Aviso.jsx";
import Boton from "../componentes/Boton.jsx";
import Campo from "../componentes/Campo.jsx";
import Pantalla from "../componentes/Pantalla.jsx";
import { guardarToken } from "../lib/sesion.js";

export default function Login() {
  const [email, setEmail] = useState("");
  const [contrasena, setContrasena] = useState("");
  const [error, setError] = useState(null);
  const [ocupado, setOcupado] = useState(false);
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
      setError(err.message === "error de red" ? "Email o contraseña incorrectos" : err.message);
    } finally {
      setOcupado(false);
    }
  }

  return (
    <Pantalla titulo="Iniciar sesión">
      <div className="portada">
        <img src="/logo.png" alt="" />
        <strong>Banco distribuido</strong>
        <p>Cuentas, depósitos y transferencias</p>
      </div>
      <form className="tarjeta" onSubmit={enviar}>
        <Campo etiqueta="Email" type="email" autoComplete="email" value={email}
               onChange={(e) => setEmail(e.target.value)} required />
        <Campo etiqueta="Contraseña" type="password" autoComplete="current-password"
               value={contrasena} onChange={(e) => setContrasena(e.target.value)} required />
        <Aviso>{aviso}</Aviso>
        <Aviso error>{error}</Aviso>
        <Boton disabled={ocupado}>{ocupado ? "Entrando…" : "Entrar"}</Boton>
      </form>
      <div className="enlaces">
        <Link to="/registro">Crear usuario</Link>
        <Link to="/recuperar">Recuperar contraseña</Link>
      </div>
    </Pantalla>
  );
}
