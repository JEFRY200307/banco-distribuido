import { useState } from "react";
import { api } from "../../api/cliente.js";
import Aviso from "../../componentes/Aviso.jsx";
import Boton from "../../componentes/Boton.jsx";
import Pantalla from "../../componentes/Pantalla.jsx";
import { formato } from "../../lib/dinero.js";

export default function Auditoria() {
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState(null);
  const [ocupado, setOcupado] = useState(false);

  async function consultar() {
    setError(null);
    setOcupado(true);
    try {
      setDatos(await api.auditoria());
    } catch (err) {
      setError(err.message);
    } finally {
      setOcupado(false);
    }
  }

  return (
    <Pantalla titulo="Auditoría" volver>
      <Aviso>Compara la suma de saldos con el log del nodo que atendió la llamada. No hay rol administrador.</Aviso>
      <Boton tipo="button" disabled={ocupado} onClick={consultar}>
        {ocupado ? "Calculando…" : "Auditar nodo"}
      </Boton>
      <Aviso error>{error}</Aviso>
      {datos && (
        <div className="resumen">
          <div className="linea-resumen"><span>Suma de saldos</span><strong>{formato(datos.total_centavos)}</strong></div>
          <div className="linea-resumen"><span>Suma del log</span><strong>{formato(datos.total_esperado_centavos)}</strong></div>
          <div className="linea-resumen"><span>Diferencia</span><strong>{formato(datos.divergencia_centavos)}</strong></div>
          <div className={datos.divergente ? "chip chip-error" : "chip chip-exito"}>
            {datos.divergente ? "Hay divergencia" : "Cuadra"}
          </div>
        </div>
      )}
    </Pantalla>
  );
}
