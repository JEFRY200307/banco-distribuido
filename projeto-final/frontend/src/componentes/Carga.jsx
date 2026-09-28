import { useIdioma } from "../lib/idioma.jsx";

export default function Carga() {
  const { t } = useIdioma();
  return <p className="carga">{t("comun.cargando")}</p>;
}
