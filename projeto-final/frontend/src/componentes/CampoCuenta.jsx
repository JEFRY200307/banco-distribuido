import { numeroVisible } from "../lib/dinero.js";
import { useIdioma } from "../lib/idioma.jsx";
import { leerCuentas } from "../lib/sesion.js";
import Campo from "./Campo.jsx";

export default function CampoCuenta({ etiqueta, value, onChange, excluir = "" }) {
  const { t } = useIdioma();
  const cuentas = leerCuentas().filter((cuenta) => cuenta.id !== excluir);
  if (cuentas.length === 0) {
    return <p className="subtitulo">{t("comun.sinCuentas")}</p>;
  }
  const conocida = cuentas.some((cuenta) => cuenta.id === value);
  return (
    <Campo etiqueta={etiqueta || t("comun.cuenta")}>
      <select className="select-cuenta" value={conocida ? value : ""} onChange={onChange} required>
        <option value="">{t("comun.elige")}</option>
        {cuentas.map((cuenta) => (
          <option key={cuenta.id} value={cuenta.id}>
            {cuenta.moneda ? `${cuenta.moneda} · ` : ""}{numeroVisible(cuenta)}
          </option>
        ))}
      </select>
    </Campo>
  );
}
