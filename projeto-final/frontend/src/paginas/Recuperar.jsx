import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/cliente.js";
import Aviso from "../componentes/Aviso.jsx";
import Boton from "../componentes/Boton.jsx";
import Campo from "../componentes/Campo.jsx";
import Pantalla from "../componentes/Pantalla.jsx";

export default function Recuperar() {
  const [email, setEmail] = useState("");
  const [contrasena, setContrasena] = useState("");
  const [repetir, setRepetir] = useState("");
  const [error, setError] = useState(null);
  const [ocupado, setOcupado] = useState(false);
  const navegar = useNavigate();

  async function enviar(evento) {
    evento.preventDefault();
    setError(null);
    if (contrasena.length < 8) {
      setError("La contraseña necesita al menos 8 caracteres");
      return;
    }
    if (contrasena !== repetir) {
      setError("Las contraseñas no coinciden");
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
    <Pantalla titulo="Recuperar contraseña" volver>
      <Aviso>
        No hay correo de confirmación. Si el email existe, esta pantalla le pone la contraseña nueva.
      </Aviso>
      <form className="tarjeta" onSubmit={enviar}>
        <Campo etiqueta="Email" type="email" autoComplete="email" value={email}
               onChange={(e) => setEmail(e.target.value)} required />
        <Campo etiqueta="Contraseña nueva" type="password" autoComplete="new-password"
               value={contrasena} onChange={(e) => setContrasena(e.target.value)} required />
        <Campo etiqueta="Repetir contraseña" type="password" autoComplete="new-password"
               value={repetir} onChange={(e) => setRepetir(e.target.value)} required />
        <Aviso error>{error}</Aviso>
        <Boton disabled={ocupado}>{ocupado ? "Guardando…" : "Actualizar contraseña"}</Boton>
      </form>
    </Pantalla>
  );
}
