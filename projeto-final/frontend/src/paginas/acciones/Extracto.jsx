import { useEffect, useState } from "react";
import { api } from "../../api/cliente.js";
import Aviso from "../../componentes/Aviso.jsx";
import Boton from "../../componentes/Boton.jsx";
import CampoCuenta from "../../componentes/CampoCuenta.jsx";
import Pantalla from "../../componentes/Pantalla.jsx";
import { formato } from "../../lib/dinero.js";
import { useIdioma } from "../../lib/idioma.jsx";
import { guardarCuentaId, leerCuentaId } from "../../lib/sesion.js";

const TOPE = 5;

export default function Extracto() {
  const { t } = useIdioma();
  const [cuentaId, setCuentaId] = useState(leerCuentaId);
  const [filas, setFilas] = useState(null);
  const [expandido, setExpandido] = useState(false);
  const [error, setError] = useState(null);
  const [ocupado, setOcupado] = useState(false);

  async function consultar(id) {
    setError(null);
    setFilas(null);
    setExpandido(false);
    setOcupado(true);
    try {
      guardarCuentaId(id.trim());
      setFilas(await api.consultarExtracto(id.trim()));
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

  const visibles = filas && (expandido ? filas : filas.slice(0, TOPE));

  return (
    <Pantalla titulo={t("extracto.titulo")} volver>
      <form className="tarjeta" onSubmit={enviar}>
        <CampoCuenta value={cuentaId} onChange={(e) => setCuentaId(e.target.value)} />
        <Aviso error>{error}</Aviso>
        <Boton disabled={ocupado || !cuentaId}>{ocupado ? t("extracto.buscando") : t("extracto.boton")}</Boton>
      </form>
      {visibles && (
        <div className="lista">
          {visibles.length === 0 && <p className="subtitulo">{t("extracto.vacio")}</p>}
          {visibles.map((fila) => (
            <div className="lista-item" key={fila.id}>
              <span className="info">
                <span className="titulo">{t(`op.${fila.tipo}`) === `op.${fila.tipo}` ? fila.tipo : t(`op.${fila.tipo}`)}</span>
                <span className="subtitulo">{fila.estado}</span>
              </span>
              <span className="monto">{formato(fila.valor_centavos)}</span>
            </div>
          ))}
          {filas.length > TOPE && (
            <button className="btn-expansion" type="button" onClick={() => setExpandido((valor) => !valor)}>
              {expandido ? t("comun.verMenos") : t("comun.verMas")}
            </button>
          )}
        </div>
      )}
    </Pantalla>
  );
}
