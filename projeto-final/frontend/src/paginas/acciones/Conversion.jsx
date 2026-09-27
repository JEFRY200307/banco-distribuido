import { api } from "../../api/cliente.js";
import FormularioTransferencia from "./FormularioTransferencia.jsx";

export default function Conversion() {
  return (
    <FormularioTransferencia
      titulo="Conversión"
      nota="Esta operación todavía no está implementada en el nodo. La respuesta esperada es 501."
      enviar={api.transferirConversion}
    />
  );
}
