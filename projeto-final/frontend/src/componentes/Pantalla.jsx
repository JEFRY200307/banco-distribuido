import { useNavigate } from "react-router-dom";

export default function Pantalla({ titulo, volver = false, children }) {
  const navegar = useNavigate();
  return (
    <div className="telefono">
      <header>
        {volver && (
          <button className="volver" type="button" aria-label="Volver" onClick={() => navegar(-1)}>
            ←
          </button>
        )}
        <div className="marca-titulo">
          <span className="marca" aria-hidden="true" />
          <h1>{titulo}</h1>
        </div>
      </header>
      <main>{children}</main>
    </div>
  );
}
