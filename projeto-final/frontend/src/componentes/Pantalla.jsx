import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { cerrarSesion } from "../lib/sesion.js";
import { IconoMenu } from "./Iconos.jsx";

const GRUPOS = [
  {
    titulo: "Dinero",
    items: [
      { to: "/cuentas/nueva", titulo: "Crear cuenta", texto: "Una cuenta en PEN, USD o BRL" },
      { to: "/depositar", titulo: "Depositar", texto: "Sumar dinero" },
      { to: "/retirar", titulo: "Retirar", texto: "Solo el dueño de la cuenta" },
      { to: "/transferir", titulo: "Transferir", texto: "Entre dos cuentas, misma moneda" },
      { to: "/extracto", titulo: "Extracto", texto: "Movimientos de una cuenta" },
    ],
  },
  {
    titulo: "Más",
    items: [
      { to: "/saldo", titulo: "Consultar saldo", texto: "Detalle de una cuenta" },
      { to: "/conversion", titulo: "Conversión", texto: "Mover a otra moneda" },
      { to: "/autotransferencia", titulo: "Autotransferencia", texto: "Entre cuentas propias" },
      { to: "/auditoria", titulo: "Auditoría", texto: "Cuadre de saldos del nodo" },
      { to: "/estado", titulo: "Estado del nodo", texto: "Quién atendió esta sesión" },
    ],
  },
];

export default function Pantalla({ titulo, volver = false, conMenu = false, accion = null, children }) {
  const navegar = useNavigate();
  const [abierto, setAbierto] = useState(false);

  function salir() {
    cerrarSesion();
    navegar("/login");
  }

  return (
    <div className="telefono">
      <div className="cabecera">
        <header>
          <div className="cabecera-lado">
            {volver && (
              <button className="icono-btn" type="button" aria-label="Volver" onClick={() => navegar(-1)}>
                ←
              </button>
            )}
            {conMenu && (
              <button
                className="icono-btn"
                type="button"
                aria-label={abierto ? "Cerrar menú" : "Abrir menú"}
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
          <div className="cabecera-lado">{accion}</div>
        </header>
        {conMenu && abierto && (
          <nav className="menu-panel" id="menu-app" aria-label="Opciones">
            <div className="menu-lista">
              {GRUPOS.map((grupo) => (
                <div key={grupo.titulo}>
                  <p className="menu-grupo">{grupo.titulo}</p>
                  {grupo.items.map((item) => (
                    <Link key={item.to} className="menu-item" to={item.to} onClick={() => setAbierto(false)}>
                      <strong>{item.titulo}</strong>
                      <span>{item.texto}</span>
                    </Link>
                  ))}
                </div>
              ))}
            </div>
            <button className="menu-item menu-salir" type="button" onClick={salir}>
              <strong>Cerrar sesión</strong>
              <span>Salir de este dispositivo</span>
            </button>
          </nav>
        )}
      </div>
      <main>{children}</main>
    </div>
  );
}
