import { api } from "../../api/cliente.js";
import FormularioTransferencia from "./FormularioTransferencia.jsx";

export default function Transferir() {
  return <FormularioTransferencia titulo="Transferir" enviar={api.transferir} />;
}
