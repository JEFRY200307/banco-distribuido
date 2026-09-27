export default function Boton({ children, variante = "primario", tipo = "submit", ...rest }) {
  const clase = {
    primario: "btn-confirmar",
    secundario: "btn-secundario",
    peligro: "btn-peligro",
  }[variante];
  return (
    <button className={clase} type={tipo} {...rest}>
      {children}
    </button>
  );
}
