import { useEffect, useState } from "react";
import { api } from "../../api/cliente.js";
import Aviso from "../../componentes/Aviso.jsx";
import Boton from "../../componentes/Boton.jsx";
import CampoCuenta from "../../componentes/CampoCuenta.jsx";
import Pantalla from "../../componentes/Pantalla.jsx";
import { formato } from "../../lib/dinero.js";
import { guardarCuentaId, leerCuentaId, recordarCuenta } from "../../lib/sesion.js";

export default function Saldo() {
  const [cuentaId, setCuentaId] = useState(leerCuentaId);
  const [cuenta, setCuenta] = useState(null);
  const [error, setError] = useState(null);
  const [ocupado, setOcupado] = useState(false);

  async function consultar(id) {
    setError(null);
    setCuenta(null);
    setOcupado(true);
    try {
      const datos = await api.consultarSaldo(id.trim());
      guardarCuentaId(id.trim());
      recordarCuenta(datos);
      setCuenta(datos);
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
    <Pantalla titulo="Consultar saldo" volver>
      <form className="tarjeta" onSubmit={enviar}>
        <CampoCuenta value={cuentaId} onChange={(e) => setCuentaId(e.target.value)} />
        <Aviso error>{error}</Aviso>
        <Boton disabled={ocupado}>{ocupado ? "Consultando…" : "Consultar"}</Boton>
      </form>
      {cuenta && (
        <div className="saldo-grande">
          <div className="etiqueta">{cuenta.moneda} · {cuenta.estado}</div>
          <div className="monto">{formato(cuenta.saldo_centavos, cuenta.moneda)}</div>
        </div>
      )}
    </Pantalla>
  );
}
