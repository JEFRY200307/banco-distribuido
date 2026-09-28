import { useState } from "react";
import Aviso from "../../componentes/Aviso.jsx";
import Boton from "../../componentes/Boton.jsx";
import Campo from "../../componentes/Campo.jsx";
import CampoCuenta from "../../componentes/CampoCuenta.jsx";
import Pantalla from "../../componentes/Pantalla.jsx";
import { aCentavos, formato } from "../../lib/dinero.js";
import { leerCuentaId } from "../../lib/sesion.js";

export default function FormularioTransferencia({ titulo, nota, enviar }) {
  const [origen, setOrigen] = useState(leerCuentaId);
  const [destino, setDestino] = useState("");
  const [monto, setMonto] = useState("");
  const [resultado, setResultado] = useState(null);
  const [error, setError] = useState(null);
  const [ocupado, setOcupado] = useState(false);

  async function onSubmit(evento) {
    evento.preventDefault();
    setError(null);
    setResultado(null);
    setOcupado(true);
    try {
      setResultado(await enviar(origen.trim(), destino.trim(), aCentavos(monto)));
    } catch (err) {
      setError(err.message);
    } finally {
      setOcupado(false);
    }
  }

  const saldos = resultado?.saldos_centavos;

  return (
    <Pantalla titulo={titulo} volver>
      {nota && <Aviso>{nota}</Aviso>}
      <form className="tarjeta" onSubmit={onSubmit}>
        <CampoCuenta etiqueta="Cuenta origen" value={origen} onChange={(e) => setOrigen(e.target.value)} />
        <Campo etiqueta="Cuenta destino" value={destino} onChange={(e) => setDestino(e.target.value)} required />
        <Campo etiqueta="Monto" inputMode="decimal" value={monto}
               onChange={(e) => setMonto(e.target.value)} required />
        <Aviso error>{error}</Aviso>
        <Boton disabled={ocupado}>{ocupado ? "Enviando…" : titulo}</Boton>
      </form>
      {saldos && (
        <div className="lista">
          {Object.entries(saldos).map(([id, centavos]) => (
            <div className="lista-item" key={id}>
              <span className="info"><span className="titulo">{id}</span></span>
              <span className="monto">{formato(centavos)}</span>
            </div>
          ))}
        </div>
      )}
    </Pantalla>
  );
}
