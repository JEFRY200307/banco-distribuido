import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api/cliente.js";
import { IconoBajar, IconoFlechas, IconoLista, IconoOjo, IconoSubir } from "../componentes/Iconos.jsx";
import Pantalla from "../componentes/Pantalla.jsx";
import { formato, mascaraCuenta } from "../lib/dinero.js";
import {
  guardarCuentaId,
  guardarSaldosVisibles,
  leerCuentas,
  leerSaldosVisibles,
  recordarCuenta,
  recordarCuentas,
} from "../lib/sesion.js";

const ATAJOS = [
  { to: "/depositar", titulo: "Depositar", Icono: IconoBajar },
  { to: "/transferir", titulo: "Transferir", Icono: IconoFlechas },
  { to: "/retirar", titulo: "Retirar", Icono: IconoSubir },
  { to: "/extracto", titulo: "Extracto", Icono: IconoLista },
];

function porMoneda(cuentas) {
  const grupos = new Map();
  for (const cuenta of cuentas) {
    const moneda = cuenta.moneda || "";
    grupos.set(moneda, (grupos.get(moneda) || 0) + Number(cuenta.saldo_centavos || 0));
  }
  return [...grupos.entries()];
}

export default function Inicio() {
  const navegar = useNavigate();
  const [verSaldo, setVerSaldo] = useState(leerSaldosVisibles);
  const [cuentas, setCuentas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

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
            setError("No pude actualizar los saldos.");
          }
        }
      } finally {
        if (vivo) setCargando(false);
      }
    })();
    return () => {
      vivo = false;
    };
  }, []);

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

  const lineas = porMoneda(cuentas);
  const monto = (centavos, moneda) => (verSaldo ? formato(centavos, moneda) : "••••");

  return (
    <Pantalla
      titulo="Inicio"
      conMenu
      accion={(
        <button
          className="icono-btn"
          type="button"
          aria-pressed={verSaldo}
          aria-label={verSaldo ? "Ocultar saldos" : "Mostrar saldos"}
          onClick={alternarSaldo}
        >
          <IconoOjo cerrado={!verSaldo} />
        </button>
      )}
    >
      <section className="hero" aria-label="Saldo">
        <p className="hero-etiqueta">{lineas.length > 1 ? "Saldos" : "Saldo disponible"}</p>
        {lineas.length <= 1 && (
          <p className="hero-monto">
            {lineas.length === 0 ? (verSaldo ? "0.00" : "••••") : monto(lineas[0][1], lineas[0][0])}
          </p>
        )}
        {lineas.length > 1 && lineas.map(([moneda, centavos]) => (
          <div className="hero-linea" key={moneda || "sin"}>
            <span>{moneda || "Cuenta"}</span>
            <span>{monto(centavos, moneda)}</span>
          </div>
        ))}
      </section>

      <nav className="atajos" aria-label="Acciones frecuentes">
        {ATAJOS.map(({ to, titulo, Icono }) => (
          <Link key={to} className="atajo" to={to}>
            <span className="burbuja"><Icono /></span>
            {titulo}
          </Link>
        ))}
      </nav>

      <div className="bloque-cuentas">
        <h2>Tus cuentas</h2>
        {cargando && <p className="subtitulo">Cargando cuentas…</p>}
        {error && <p className="subtitulo">{error}</p>}
        {!cargando && cuentas.length === 0 && (
          <div className="vacio">
            <p>Todavía no hay cuentas a tu nombre.</p>
            <Link to="/cuentas/nueva">Crear la primera</Link>
          </div>
        )}
        <div className="cuentas-visuales">
          {cuentas.map((cuenta, indice) => (
            <button
              key={cuenta.id}
              type="button"
              className={`cuenta-visual tono-${indice % 3}`}
              onClick={() => abrir(cuenta)}
            >
              <span className="cuenta-tope">
                <span>{cuenta.moneda || "Cuenta"}</span>
                <span>{cuenta.estado || "ACTIVA"}</span>
              </span>
              <span className="cuenta-saldo">{monto(cuenta.saldo_centavos, "")}</span>
              <span className="cuenta-id">{mascaraCuenta(cuenta.id)}</span>
            </button>
          ))}
        </div>
      </div>
    </Pantalla>
  );
}
