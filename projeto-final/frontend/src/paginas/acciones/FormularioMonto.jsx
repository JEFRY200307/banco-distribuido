import { useState } from "react";
import { api } from "../../api/cliente.js";
import Aviso from "../../componentes/Aviso.jsx";
import Boton from "../../componentes/Boton.jsx";
import Campo from "../../componentes/Campo.jsx";
import CampoCuenta from "../../componentes/CampoCuenta.jsx";
import Pantalla from "../../componentes/Pantalla.jsx";
import { aCentavos, formato } from "../../lib/dinero.js";
import { guardarCuentaId, leerCuentaId, recordarCuenta } from "../../lib/sesion.js";

export default function FormularioMonto({ titulo, enviarMonto }) {
  const [cuentaId, setCuentaId] = useState(leerCuentaId);
  const [monto, setMonto] = useState("");
  const [resultado, setResultado] = useState(null);
  const [error, setError] = useState(null);
  const [ocupado, setOcupado] = useState(false);

  async function enviar(evento) {
    evento.preventDefault();
    setError(null);
    setResultado(null);
    setOcupado(true);
    try {
      const datos = await enviarMonto(cuentaId.trim(), aCentavos(monto));
      guardarCuentaId(cuentaId.trim());
      recordarCuenta({ id: cuentaId.trim(), ...datos });
      setResultado(datos);
    } catch (err) {
      setError(err.message);
    } finally {
      setOcupado(false);
    }
  }

  return (
    <Pantalla titulo={titulo} volver>
      <form className="tarjeta" onSubmit={enviar}>
        <CampoCuenta value={cuentaId} onChange={(e) => setCuentaId(e.target.value)} />
        <Campo etiqueta="Monto" inputMode="decimal" value={monto}
               onChange={(e) => setMonto(e.target.value)} required />
        <Aviso error>{error}</Aviso>
        <Boton disabled={ocupado}>{ocupado ? "Enviando…" : titulo}</Boton>
      </form>
      {resultado?.saldo_centavos != null && (
        <div className="saldo-grande">
          <div className="etiqueta">Saldo resultante</div>
          <div className="monto">{formato(resultado.saldo_centavos)}</div>
        </div>
      )}
    </Pantalla>
  );
}

export function pantallaDeposito() {
  return <FormularioMonto titulo="Depositar" enviarMonto={api.depositar} />;
}

export function pantallaRetiro() {
  return <FormularioMonto titulo="Retirar" enviarMonto={api.retirar} />;
}
