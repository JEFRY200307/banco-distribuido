import { api } from "../../api/cliente.js";
import FormularioTransferencia from "./FormularioTransferencia.jsx";

export default function Autotransferencia() {
  return (
    <FormularioTransferencia
      titulo="Autotransferencia"
      nota="Esta operación todavía no está implementada en el nodo. La respuesta esperada es 501."
      enviar={api.autotransferir}
    />
  );
}
