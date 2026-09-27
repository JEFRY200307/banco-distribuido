export default function Campo({ etiqueta, children, ...props }) {
  return (
    <div className="campo">
      <label>{etiqueta}</label>
      {children || <input {...props} />}
    </div>
  );
}
