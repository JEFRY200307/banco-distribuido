import { useIdioma } from "../lib/idioma.jsx";

export default function TextoTerminos({ onCerrar }) {
  const { t } = useIdioma();
  return (
    <article className="tarjeta terminos">
      <h2>{t("terminos.h2")}</h2>
      <p>{t("terminos.p1")}</p>
      <p>{t("terminos.p2")}</p>
      <p>{t("terminos.p3")}</p>
      {onCerrar && <button className="btn-secundario" type="button" onClick={onCerrar}>{t("terminos.cerrar")}</button>}
    </article>
  );
}
