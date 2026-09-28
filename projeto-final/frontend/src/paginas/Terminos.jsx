import Pantalla from "../componentes/Pantalla.jsx";
import { useIdioma } from "../lib/idioma.jsx";
import TextoTerminos from "./TextoTerminos.jsx";

export default function Terminos() {
  const { t } = useIdioma();
  return (
    <Pantalla titulo={t("terminos.titulo")} volver>
      <TextoTerminos />
    </Pantalla>
  );
}
