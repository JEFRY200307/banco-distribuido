import { useState } from "react";
import { api } from "../../api/cliente.js";
import Aviso from "../../componentes/Aviso.jsx";
import Boton from "../../componentes/Boton.jsx";
import Campo from "../../componentes/Campo.jsx";
import Pantalla from "../../componentes/Pantalla.jsx";
import { formato } from "../../lib/dinero.js";
import { leerCuentaId } from "../../lib/sesion.js";

export default function Extracto() {
  const [cuentaId, setCuentaId] = useState(leerCuentaId);
  const [filas, setFilas] = useState(null);
  const [error, setError] = useState(null);
  const [ocupado, setOcupado] = useState(false);

  async function enviar(evento) {
    evento.preventDefault();
    setError(null);
    setFilas(null);
    setOcupado(true);
    try {
      setFilas(await api.consultarExtracto(cuentaId.trim()));
    } catch (err) {
      setError(err.message);
    } finally {
      setOcupado(false);
    }
  }

  return (
    <Pantalla titulo="Extracto" volver>
      <form className="tarjeta" onSubmit={enviar}>
        <Campo etiqueta="Id de cuenta" value={cuentaId} onChange={(e) => setCuentaId(e.target.value)} required />
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
