import { useEffect, useState } from "react";
import { api } from "../../api/cliente.js";
import Aviso from "../../componentes/Aviso.jsx";
import Boton from "../../componentes/Boton.jsx";
import CampoCuenta from "../../componentes/CampoCuenta.jsx";
import Pantalla from "../../componentes/Pantalla.jsx";
import { formato, numeroVisible } from "../../lib/dinero.js";
import { useIdioma } from "../../lib/idioma.jsx";
import { guardarCuentaId, leerCuentaId, leerCuentas, recordarCuenta } from "../../lib/sesion.js";

export default function Saldo() {
  const { t } = useIdioma();
  const [cuentaId, setCuentaId] = useState(leerCuentaId);
  const [cuenta, setCuenta] = useState(null);
  const [error, setError] = useState(null);
  const [ocupado, setOcupado] = useState(false);

  async function consultar(id) {
    if (!id) return;
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

  const conocida = leerCuentas().find((item) => item.id === cuenta?.id);

  return (
    <Pantalla titulo={t("saldo.titulo")} volver>
      <form className="tarjeta" onSubmit={enviar}>
        <CampoCuenta value={cuentaId} onChange={(e) => setCuentaId(e.target.value)} />
        <Aviso error>{error}</Aviso>
        <Boton disabled={ocupado || !cuentaId}>{ocupado ? t("saldo.consultando") : t("saldo.boton")}</Boton>
      </form>
      {cuenta && (
        <div className="saldo-grande">
          <div className="etiqueta">{numeroVisible({ ...conocida, ...cuenta })} · {cuenta.moneda}</div>
          <div className="monto">{formato(cuenta.saldo_centavos, cuenta.moneda)}</div>
        </div>
      )}
    </Pantalla>
  );
}
