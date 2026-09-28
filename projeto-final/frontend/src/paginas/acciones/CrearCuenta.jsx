import { useState } from "react";
import { api } from "../../api/cliente.js";
import Aviso from "../../componentes/Aviso.jsx";
import Boton from "../../componentes/Boton.jsx";
import Campo from "../../componentes/Campo.jsx";
import Pantalla from "../../componentes/Pantalla.jsx";
import { aCentavos, formato } from "../../lib/dinero.js";
import { guardarCuentaId, recordarCuenta, usuarioId } from "../../lib/sesion.js";

const MONEDAS = ["PEN", "USD", "BRL"];

export default function CrearCuenta() {
  const [moneda, setMoneda] = useState("PEN");
  const [monto, setMonto] = useState("0");
  const [error, setError] = useState(null);
  const [creada, setCreada] = useState(null);
  const [ocupado, setOcupado] = useState(false);

  async function enviar(evento) {
    evento.preventDefault();
    setError(null);
    setCreada(null);
    const id = usuarioId();
    if (!id) {
      setError("La sesión no trae un usuario. Vuelve a entrar.");
      return;
    }
    setOcupado(true);
    try {
      const cuenta = await api.crearCuenta(id, moneda, aCentavos(monto));
      const completa = { ...cuenta, moneda };
      guardarCuentaId(cuenta.id);
      recordarCuenta(completa);
      setCreada(completa);
    } catch (err) {
      setError(err.message);
    } finally {
      setOcupado(false);
    }
  }

  return (
    <Pantalla titulo="Crear cuenta" volver>
      <form className="tarjeta" onSubmit={enviar}>
        <Campo etiqueta="Moneda">
          <select className="select-cuenta" value={moneda} onChange={(e) => setMoneda(e.target.value)}>
            {MONEDAS.map((item) => <option key={item}>{item}</option>)}
          </select>
        </Campo>
        <Campo etiqueta="Saldo inicial" inputMode="decimal" value={monto}
               onChange={(e) => setMonto(e.target.value)} required />
        <Aviso error>{error}</Aviso>
        <Boton disabled={ocupado}>{ocupado ? "Creando…" : "Crear cuenta"}</Boton>
      </form>
      {creada && (
        <div className="saldo-grande">
          <div className="etiqueta">Cuenta {creada.id}</div>
          <div className="monto">{formato(creada.saldo_centavos, creada.moneda || moneda)}</div>
          <p className="subtitulo">Ya aparece en Inicio.</p>
        </div>
      )}
    </Pantalla>
  );
}
