import { Link, useNavigate } from "react-router-dom";
import Boton from "../componentes/Boton.jsx";
import Pantalla from "../componentes/Pantalla.jsx";
import { cerrarSesion, usuarioId } from "../lib/sesion.js";

const ACCIONES = [
  { to: "/cuentas/nueva", titulo: "Crear cuenta", texto: "Cuenta corriente en una moneda" },
  { to: "/saldo", titulo: "Consultar saldo", texto: "Saldo de una cuenta tuya" },
  { to: "/depositar", titulo: "Depositar", texto: "Sumar dinero a una cuenta" },
  { to: "/retirar", titulo: "Retirar", texto: "Restar dinero, solo el dueño" },
  { to: "/extracto", titulo: "Extracto", texto: "Movimientos de una cuenta" },
  { to: "/transferir", titulo: "Transferir", texto: "Misma moneda, entre dos cuentas" },
  { to: "/conversion", titulo: "Conversión", texto: "Otra moneda. El nodo aún responde 501" },
  { to: "/autotransferencia", titulo: "Autotransferencia", texto: "Entre cuentas propias. Aún 501" },
  { to: "/auditoria", titulo: "Auditoría", texto: "Cuadra saldos contra el log del nodo" },
  { to: "/estado", titulo: "Estado del nodo", texto: "Quién atendió: id, rol y epoch" },
];

export default function Inicio() {
  const navegar = useNavigate();
  const id = usuarioId();

  function salir() {
    cerrarSesion();
    navegar("/login");
  }

  return (
    <Pantalla titulo="Tu banco">
      <p className="subtitulo">Sesión {id ? id.slice(0, 8) : "activa"}</p>
      <nav className="lista" aria-label="Operaciones">
        {ACCIONES.map((accion) => (
          <Link key={accion.to} className="lista-item" to={accion.to}>
            <span className="info">
              <span className="titulo">{accion.titulo}</span>
              <span className="subtitulo">{accion.texto}</span>
            </span>
            <span className="flecha" aria-hidden="true">›</span>
          </Link>
        ))}
      </nav>
      <Boton tipo="button" variante="secundario" onClick={salir}>Cerrar sesión</Boton>
    </Pantalla>
  );
}
