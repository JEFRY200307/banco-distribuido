import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api/cliente.js";
import { IconoBajar, IconoFlechas, IconoLista, IconoOjo, IconoSubir } from "../componentes/Iconos.jsx";
import Pantalla from "../componentes/Pantalla.jsx";
import { formato, numeroVisible } from "../lib/dinero.js";
import { useIdioma } from "../lib/idioma.jsx";
import {
  guardarCuentaId,
  guardarPrincipal,
  guardarSaldosVisibles,
  leerCuentas,
  leerPrincipal,
  leerSaldosVisibles,
  recordarCuenta,
  recordarCuentas,
} from "../lib/sesion.js";

const ATAJOS = [
  { to: "/depositar", clave: "atajo.depositar", Icono: IconoBajar },
  { to: "/transferir", clave: "atajo.transferir", Icono: IconoFlechas },
  { to: "/retirar", clave: "atajo.retirar", Icono: IconoSubir },
  { to: "/extracto", clave: "atajo.extracto", Icono: IconoLista },
];

const TOPE = 2;

export default function Inicio() {
  const { t } = useIdioma();
  const navegar = useNavigate();
  const [verSaldo, setVerSaldo] = useState(leerSaldosVisibles);
  const [cuentas, setCuentas] = useState([]);
  const [expandido, setExpandido] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [principalId, setPrincipalId] = useState(leerPrincipal);

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const remotas = await api.listarCuentas();
        recordarCuentas(remotas);
        if (vivo) setCuentas(remotas);
      } catch {
        const locales = leerCuentas();
        const frescas = [];
        for (const cuenta of locales) {
          try {
            const viva = await api.consultarSaldo(cuenta.id);
            recordarCuenta(viva);
            frescas.push(viva);
          } catch {
            frescas.push(cuenta);
          }
        }
        if (vivo) {
          setCuentas(frescas);
          if (locales.length > 0 && frescas.every((cuenta) => cuenta.saldo_centavos == null)) {
            setError(t("inicio.error"));
          }
        }
      } finally {
        if (vivo) setCargando(false);
      }
    })();
    return () => {
      vivo = false;
    };
  }, [t]);

  function alternarSaldo() {
    const siguiente = !verSaldo;
    setVerSaldo(siguiente);
    guardarSaldosVisibles(siguiente);
  }

  function abrir(cuenta) {
    guardarCuentaId(cuenta.id);
    recordarCuenta(cuenta);
    navegar("/extracto");
  }

  function marcarPrincipal(cuenta) {
    guardarPrincipal(cuenta.id);
    setPrincipalId(cuenta.id);
  }

  const elegida = cuentas.find((cuenta) => cuenta.id === principalId) || cuentas[0] || null;
  const monto = (centavos, moneda) => (verSaldo ? formato(centavos, moneda) : "••••");
  const visibles = expandido ? cuentas : cuentas.slice(0, TOPE);

  return (
    <Pantalla
      titulo={t("inicio.titulo")}
      conMenu
      accion={(
        <button
          className="icono-btn"
          type="button"
          aria-pressed={verSaldo}
          aria-label={verSaldo ? t("comun.ocultar") : t("comun.mostrar")}
          onClick={alternarSaldo}
        >
          <IconoOjo cerrado={!verSaldo} />
        </button>
      )}
    >
      <section className="hero" aria-label={t("inicio.saldo")}>
        <p className="hero-etiqueta">{t("inicio.saldo")}</p>
        <p className="hero-monto">
          {elegida ? monto(elegida.saldo_centavos, elegida.moneda) : (verSaldo ? "0.00" : "••••")}
        </p>
        {elegida && <p className="hero-etiqueta">{numeroVisible(elegida)}</p>}
      </section>

      <nav className="atajos" aria-label={t("menu.dinero")}>
        {ATAJOS.map(({ to, clave, Icono }) => (
          <Link key={to} className="atajo" to={to}>
            <span className="burbuja"><Icono /></span>
            {t(clave)}
          </Link>
        ))}
      </nav>

      <div className="bloque-cuentas">
        <h2>{t("inicio.cuentas")}</h2>
        {cargando && <p className="subtitulo">{t("inicio.cargando")}</p>}
        {error && <p className="subtitulo">{error}</p>}
        {!cargando && cuentas.length === 0 && (
          <div className="vacio">
            <p>{t("inicio.vacio")}</p>
            <Link to="/cuentas/nueva">{t("inicio.crear")}</Link>
          </div>
        )}
        <div className="cuentas-visuales">
          {visibles.map((cuenta, indice) => (
            <article key={cuenta.id} className={`cuenta-visual tono-${indice % 3}`}>
              <button type="button" className="cuenta-cuerpo" onClick={() => abrir(cuenta)}>
                <span className="cuenta-tope">
                  <span>{cuenta.moneda || t("comun.cuenta")}</span>
                  <span>{cuenta.id === (elegida && elegida.id) ? t("comun.principal") : (cuenta.estado || "ACTIVA")}</span>
                </span>
                <span className="cuenta-saldo">{monto(cuenta.saldo_centavos, "")}</span>
                <span className="cuenta-id">{numeroVisible(cuenta)}</span>
              </button>
              {cuenta.id !== (elegida && elegida.id) && (
                <button type="button" className="btn-texto" onClick={() => marcarPrincipal(cuenta)}>
                  {t("comun.hacerPrincipal")}
                </button>
              )}
            </article>
          ))}
        </div>
        {cuentas.length > TOPE && (
          <button className="btn-expansion" type="button" onClick={() => setExpandido((valor) => !valor)}>
            {expandido ? t("comun.verMenos") : t("comun.verMas")}
          </button>
        )}
      </div>
    </Pantalla>
  );
}
