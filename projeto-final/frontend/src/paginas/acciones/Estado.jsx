import { useState } from "react";
import { api } from "../../api/cliente.js";
import Aviso from "../../componentes/Aviso.jsx";
import Boton from "../../componentes/Boton.jsx";
import Pantalla from "../../componentes/Pantalla.jsx";

export default function Estado() {
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState(null);
  const [ocupado, setOcupado] = useState(false);

  async function consultar() {
    setError(null);
    setOcupado(true);
    try {
      setDatos(await api.estadoNodo());
    } catch (err) {
      setError(err.message);
    } finally {
      setOcupado(false);
    }
  }

  return (
    <Pantalla titulo="Estado del nodo" volver>
      <Aviso>El balanceador elige un nodo vivo y muestra su estado. No lista el clúster entero.</Aviso>
      <Boton tipo="button" disabled={ocupado} onClick={consultar}>
        {ocupado ? "Consultando…" : "Consultar estado"}
      </Boton>
      <Aviso error>{error}</Aviso>
      {datos && (
        <div className="resumen">
          <div className="linea-resumen"><span>Nodo</span><strong>{datos.nodo}</strong></div>
          <div className="linea-resumen"><span>Rol</span><strong>{datos.rol}</strong></div>
          <div className="linea-resumen"><span>Epoch</span><strong>{datos.epoch}</strong></div>
        </div>
      )}
    </Pantalla>
  );
}
