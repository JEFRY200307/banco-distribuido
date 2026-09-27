import { lazy, Suspense, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/cliente.js";
import Aviso from "../componentes/Aviso.jsx";
import Boton from "../componentes/Boton.jsx";
import Campo from "../componentes/Campo.jsx";
import Carga from "../componentes/Carga.jsx";
import Pantalla from "../componentes/Pantalla.jsx";

const TextoTerminos = lazy(() => import("./TextoTerminos.jsx"));

export default function Registro() {
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [contrasena, setContrasena] = useState("");
  const [acepta, setAcepta] = useState(false);
  const [verTerminos, setVerTerminos] = useState(false);
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
    setOcupado(true);
    try {
      await api.registrar(nombre, email, contrasena);
      navegar("/login", { state: { aviso: "Usuario creado. Ya puedes entrar." } });
    } catch (err) {
      setError(err.message);
    } finally {
      setOcupado(false);
    }
  }

  return (
    <Pantalla titulo="Crear usuario" volver>
      <form className="tarjeta" onSubmit={enviar}>
        <Campo etiqueta="Nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} required />
        <Campo etiqueta="Email" type="email" autoComplete="email" value={email}
               onChange={(e) => setEmail(e.target.value)} required />
        <Campo etiqueta="Contraseña" type="password" autoComplete="new-password"
               value={contrasena} onChange={(e) => setContrasena(e.target.value)} required />
        <label className="check">
          <input type="checkbox" checked={acepta} onChange={(e) => setAcepta(e.target.checked)} />
          <span>
            Acepto los{" "}
            <button type="button" className="enlace-boton" onClick={() => setVerTerminos(true)}>
              términos y condiciones
            </button>
          </span>
        </label>
        <Aviso error>{error}</Aviso>
        <Boton disabled={!acepta || ocupado}>{ocupado ? "Creando…" : "Registrarme"}</Boton>
      </form>
      {verTerminos && (
        <div className="cortina" role="dialog" aria-modal="true" aria-label="Términos y condiciones">
          <Suspense fallback={<Carga />}>
            <TextoTerminos onCerrar={() => setVerTerminos(false)} />
          </Suspense>
        </div>
      )}
    </Pantalla>
  );
}
