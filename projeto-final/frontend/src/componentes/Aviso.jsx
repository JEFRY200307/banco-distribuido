export default function Aviso({ children, error = false }) {
  if (!children) return null;
  return (
    <div className={error ? "aviso aviso-error" : "aviso"} role={error ? "alert" : "status"}>
      <span className="punto">●</span>
      <span>{children}</span>
    </div>
  );
}
