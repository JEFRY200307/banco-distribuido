import { useState } from "react";
import { api } from "../../api/cliente.js";
import Aviso from "../../componentes/Aviso.jsx";
import Boton from "../../componentes/Boton.jsx";
import Pantalla from "../../componentes/Pantalla.jsx";
import { formato } from "../../lib/dinero.js";
import { useIdioma } from "../../lib/idioma.jsx";

export default function Auditoria() {
  const { t } = useIdioma();
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
    <Pantalla titulo={t("auditoria.titulo")} volver>
      <Aviso>{t("auditoria.aviso")}</Aviso>
      <Boton tipo="button" disabled={ocupado} onClick={consultar}>
        {ocupado ? t("auditoria.calculando") : t("auditoria.boton")}
      </Boton>
      <Aviso error>{error}</Aviso>
      {datos && (
        <div className="resumen">
          <div className="linea-resumen"><span>{t("auditoria.saldos")}</span><strong>{formato(datos.total_centavos)}</strong></div>
          <div className="linea-resumen"><span>{t("auditoria.log")}</span><strong>{formato(datos.total_esperado_centavos)}</strong></div>
          <div className="linea-resumen"><span>{t("auditoria.diff")}</span><strong>{formato(datos.divergencia_centavos)}</strong></div>
          <div className={datos.divergente ? "chip chip-error" : "chip chip-exito"}>
            {datos.divergente ? t("auditoria.diverge") : t("auditoria.cuadra")}
          </div>
        </div>
      )}
    </Pantalla>
  );
}
