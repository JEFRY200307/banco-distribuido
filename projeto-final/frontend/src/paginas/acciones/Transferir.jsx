import { useState } from "react";
import { api } from "../../api/cliente.js";
import Aviso from "../../componentes/Aviso.jsx";
import Boton from "../../componentes/Boton.jsx";
import Campo from "../../componentes/Campo.jsx";
import CampoCuenta from "../../componentes/CampoCuenta.jsx";
import Pantalla from "../../componentes/Pantalla.jsx";
import { aCentavos, formato, numeroVisible } from "../../lib/dinero.js";
import { useIdioma } from "../../lib/idioma.jsx";
import { leerCuentaId, leerCuentas } from "../../lib/sesion.js";

const TIPOS = [
  ["propia", "transfer.propia", "transfer.propiaTexto"],
  ["otro", "transfer.otro", "transfer.otroTexto"],
  ["banco", "transfer.banco", "transfer.bancoTexto"],
];

export default function Transferir() {
  const { t } = useIdioma();
  const [tipo, setTipo] = useState("");
  const [origen, setOrigen] = useState(leerCuentaId);
  const [destino, setDestino] = useState("");
  const [numero, setNumero] = useState("");
  const [banco, setBanco] = useState("");
  const [monto, setMonto] = useState("");
  const [resultado, setResultado] = useState(null);
  const [error, setError] = useState(null);
  const [ocupado, setOcupado] = useState(false);

  const origenCuenta = leerCuentas().find((cuenta) => cuenta.id === origen);

  async function enviar(evento) {
    evento.preventDefault();
    setError(null);
    setResultado(null);
    if (tipo === "banco") {
      setError(t("transfer.bancoPendiente"));
      return;
    }
    setOcupado(true);
    try {
      const centavos = aCentavos(monto);
      if (tipo === "propia") {
        const destinoCuenta = leerCuentas().find((cuenta) => cuenta.id === destino);
        if (origenCuenta && destinoCuenta && origenCuenta.moneda !== destinoCuenta.moneda) {
          setResultado(await api.transferirConversion(origen, destino, centavos));
        } else {
          setResultado(await api.transferir(origen, destino, centavos));
        }
        return;
      }
      const ajena = await api.buscarPorNumero(numero.trim());
      if (origenCuenta && ajena.moneda !== origenCuenta.moneda) {
        setError(t("transfer.mismaMoneda"));
        return;
      }
      setResultado(await api.transferir(origen, ajena.id, centavos));
    } catch (err) {
      setError(err.message);
    } finally {
      setOcupado(false);
    }
  }

  const saldos = resultado?.saldos_centavos;
  const destinoCuenta = leerCuentas().find((cuenta) => cuenta.id === destino);
  const esConversion = tipo === "propia" && origenCuenta && destinoCuenta && destinoCuenta.moneda !== origenCuenta.moneda;
  const boton = esConversion ? t("transfer.conversion") : t("transfer.boton");
  const listo = Boolean(origen) && (
    (tipo === "propia" && destino) ||
    (tipo === "otro" && numero.trim()) ||
    (tipo === "banco" && banco.trim() && numero.trim())
  );

  return (
    <Pantalla titulo={t("transfer.titulo")} volver>
      {!tipo && (
        <div className="tipo-grid">
          <p className="subtitulo">{t("transfer.tipo")}</p>
          {TIPOS.map(([id, titulo, texto]) => (
            <button key={id} type="button" className="tipo-opcion" onClick={() => setTipo(id)}>
              <strong>{t(titulo)}</strong>
              <span>{t(texto)}</span>
            </button>
          ))}
        </div>
      )}
      {tipo && (
        <form className="tarjeta" onSubmit={enviar}>
          <CampoCuenta etiqueta={t("transfer.origen")} value={origen} onChange={(e) => setOrigen(e.target.value)} />
          {tipo === "propia" && (
            <CampoCuenta
              etiqueta={t("transfer.destino")}
              value={destino}
              excluir={origen}
              onChange={(e) => setDestino(e.target.value)}
            />
          )}
          {tipo === "otro" && (
            <Campo etiqueta={t("transfer.numero")} value={numero} onChange={(e) => setNumero(e.target.value)} required autoComplete="off" />
          )}
          {tipo === "banco" && (
            <>
              <Campo etiqueta={t("transfer.bancoNombre")} value={banco} onChange={(e) => setBanco(e.target.value)} required />
              <Campo etiqueta={t("transfer.numero")} value={numero} onChange={(e) => setNumero(e.target.value)} required autoComplete="off" />
            </>
          )}
          <Campo etiqueta={t("comun.monto")} inputMode="decimal" value={monto} onChange={(e) => setMonto(e.target.value)} required />
          <Aviso error>{error}</Aviso>
          <Boton disabled={ocupado || !listo}>{ocupado ? t("comun.enviando") : boton}</Boton>
          <button className="btn-expansion" type="button" onClick={() => { setTipo(""); setError(null); }}>
            {t("comun.volver")}
          </button>
        </form>
      )}
      {saldos && (
        <div className="lista">
          {Object.entries(saldos).map(([id, centavos]) => {
            const conocida = leerCuentas().find((cuenta) => cuenta.id === id);
            return (
              <div className="lista-item" key={id}>
                <span className="info"><span className="titulo">{conocida ? numeroVisible(conocida) : id}</span></span>
                <span className="monto">{formato(centavos)}</span>
              </div>
            );
          })}
        </div>
      )}
    </Pantalla>
  );
}
