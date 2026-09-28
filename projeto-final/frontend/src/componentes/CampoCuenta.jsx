import Campo from "./Campo.jsx";
import { mascaraCuenta } from "../lib/dinero.js";
import { leerCuentas } from "../lib/sesion.js";

export default function CampoCuenta({ etiqueta = "Cuenta", value, onChange }) {
  const cuentas = leerCuentas();
  if (cuentas.length === 0) {
    return <Campo etiqueta={etiqueta} value={value} onChange={onChange} required autoComplete="off" />;
  }
  const conocida = cuentas.some((cuenta) => cuenta.id === value);
  return (
    <Campo etiqueta={etiqueta}>
      <select className="select-cuenta" value={value} onChange={onChange} required>
        <option value="">Elige una cuenta</option>
        {!conocida && value && <option value={value}>{mascaraCuenta(value)}</option>}
        {cuentas.map((cuenta) => (
          <option key={cuenta.id} value={cuenta.id}>
            {cuenta.moneda ? `${cuenta.moneda} · ` : ""}{mascaraCuenta(cuenta.id)}
          </option>
        ))}
      </select>
    </Campo>
  );
}
