import { useState } from "react";
import { api } from "../../api/cliente.js";
import Aviso from "../../componentes/Aviso.jsx";
import Boton from "../../componentes/Boton.jsx";
import Pantalla from "../../componentes/Pantalla.jsx";
import { useIdioma } from "../../lib/idioma.jsx";

export default function Estado() {
  const { t } = useIdioma();
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
    <Pantalla titulo={t("estado.titulo")} volver>
      <Aviso>{t("estado.aviso")}</Aviso>
      <Boton tipo="button" disabled={ocupado} onClick={consultar}>
        {ocupado ? t("estado.consultando") : t("estado.boton")}
      </Boton>
      <Aviso error>{error}</Aviso>
      {datos && (
        <div className="resumen">
          <div className="linea-resumen"><span>{t("estado.nodo")}</span><strong>{datos.nodo}</strong></div>
          <div className="linea-resumen"><span>{t("estado.rol")}</span><strong>{datos.rol}</strong></div>
          <div className="linea-resumen"><span>{t("estado.epoch")}</span><strong>{datos.epoch}</strong></div>
        </div>
      )}
    </Pantalla>
  );
}
