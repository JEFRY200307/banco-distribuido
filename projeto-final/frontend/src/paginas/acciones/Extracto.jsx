import { useEffect, useState } from "react";
import { api } from "../../api/cliente.js";
import Aviso from "../../componentes/Aviso.jsx";
import Boton from "../../componentes/Boton.jsx";
import CampoCuenta from "../../componentes/CampoCuenta.jsx";
import Pantalla from "../../componentes/Pantalla.jsx";
import { formato } from "../../lib/dinero.js";
import { guardarCuentaId, leerCuentaId } from "../../lib/sesion.js";

export default function Extracto() {
  const [cuentaId, setCuentaId] = useState(leerCuentaId);
  const [filas, setFilas] = useState(null);
  const [error, setError] = useState(null);
  const [ocupado, setOcupado] = useState(false);

  async function consultar(id) {
    setError(null);
    setFilas(null);
    setOcupado(true);
    try {
      guardarCuentaId(id.trim());
      setFilas(await api.consultarExtracto(id.trim()));
    } catch (err) {
      setError(err.message);
    } finally {
      setOcupado(false);
    }
  }

  useEffect(() => {
    if (cuentaId) consultar(cuentaId);
  }, []);

  async function enviar(evento) {
    evento.preventDefault();
    await consultar(cuentaId);
  }

  return (
    <Pantalla titulo="Extracto" volver>
      <form className="tarjeta" onSubmit={enviar}>
        <CampoCuenta value={cuentaId} onChange={(e) => setCuentaId(e.target.value)} />
        <Aviso error>{error}</Aviso>
        <Boton disabled={ocupado}>{ocupado ? "Buscando…" : "Ver extracto"}</Boton>
      </form>
      {filas && (
        <div className="lista">
          {filas.length === 0 && <p className="subtitulo">Esta cuenta no tiene movimientos.</p>}
          {filas.map((fila) => (
            <div className="lista-item" key={fila.id}>
              <span className="info">
                <span className="titulo">{fila.tipo}</span>
                <span className="subtitulo">{fila.estado}</span>
              </span>
              <span className="monto">{formato(fila.valor_centavos)}</span>
            </div>
          ))}
        </div>
      )}
    </Pantalla>
  );
}
