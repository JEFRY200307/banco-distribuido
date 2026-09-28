import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useIdioma } from "../lib/idioma.jsx";
import { cerrarSesion } from "../lib/sesion.js";
import { IconoMenu } from "./Iconos.jsx";

const DINERO = [
  ["menu.crear", "menu.crearTexto", "/cuentas/nueva"],
  ["menu.depositar", "menu.depositarTexto", "/depositar"],
  ["menu.retirar", "menu.retirarTexto", "/retirar"],
  ["menu.transferir", "menu.transferirTexto", "/transferir"],
  ["menu.extracto", "menu.extractoTexto", "/extracto"],
];

const MAS = [
  ["menu.saldo", "menu.saldoTexto", "/saldo"],
  ["menu.auditoria", "menu.auditoriaTexto", "/auditoria"],
  ["menu.estado", "menu.estadoTexto", "/estado"],
];

export default function Pantalla({ titulo, volver = false, conMenu = false, accion = null, children }) {
  const navegar = useNavigate();
  const { t, alternar, idioma } = useIdioma();
  const [abierto, setAbierto] = useState(false);
  const [mas, setMas] = useState(false);

  function salir() {
    cerrarSesion();
    navegar("/login");
  }

  function fila(clave, texto, ruta) {
    return (
      <Link key={ruta} className="menu-item" to={ruta} onClick={() => setAbierto(false)}>
        <strong>{t(clave)}</strong>
        <span>{t(texto)}</span>
      </Link>
    );
  }

  return (
    <div className="telefono">
      <div className="cabecera">
        <header>
          <div className="cabecera-lado">
            {volver && (
              <button className="icono-btn" type="button" aria-label={t("comun.volver")} onClick={() => navegar(-1)}>
                ←
              </button>
            )}
            {conMenu && (
              <button
                className="icono-btn"
                type="button"
                aria-label={abierto ? t("menu.cerrar") : t("menu.abrir")}
                aria-expanded={abierto}
                aria-controls="menu-app"
                onClick={() => setAbierto((valor) => !valor)}
              >
                <IconoMenu />
              </button>
            )}
          </div>
          <div className="marca-titulo">
            <img className="logo-app" src="/logo.png" alt="" />
            <h1>{titulo}</h1>
          </div>
          <div className="cabecera-lado cabecera-der">
            <button className="idioma-btn" type="button" onClick={alternar} aria-label={idioma === "es" ? "Português" : "Español"}>
              {t("idioma.otro")}
            </button>
            {accion}
          </div>
        </header>
        {conMenu && abierto && (
          <nav className="menu-panel" id="menu-app" aria-label={t("menu.opciones")}>
            <div className="menu-lista">
              <p className="menu-grupo">{t("menu.dinero")}</p>
              {DINERO.map(([clave, texto, ruta]) => fila(clave, texto, ruta))}
              <button className="menu-item" type="button" onClick={() => setMas((valor) => !valor)}>
                <strong>{mas ? t("comun.verMenos") : t("comun.verMas")}</strong>
                <span>{t("menu.mas")}</span>
              </button>
              {mas && (
                <>
                  <p className="menu-grupo">{t("menu.mas")}</p>
                  {MAS.map(([clave, texto, ruta]) => fila(clave, texto, ruta))}
                </>
              )}
            </div>
            <button className="menu-item menu-salir" type="button" onClick={salir}>
              <strong>{t("menu.salir")}</strong>
              <span>{t("menu.salirTexto")}</span>
            </button>
          </nav>
        )}
      </div>
      <main>{children}</main>
    </div>
  );
}
