// Habla siempre con el balanceador (/api). En desarrollo lo reenvía Vite;
// en Vercel, vercel.json. El token, si hay sesión, va en cada llamada.
import { leerToken } from "../lib/sesion.js";

const BASE = "/api";

function opId() {
  return crypto.randomUUID();
}

function mensajeError(datos) {
  const detalle = datos?.detail;
  if (!detalle) return "error de red";
  if (typeof detalle === "string") return detalle;
  if (detalle.mensagem) return detalle.mensagem;
  if (Array.isArray(detalle)) return detalle.map((item) => item.msg).filter(Boolean).join(", ");
  return "error de red";
}

async function peticion(ruta, { metodo = "GET", cuerpo } = {}) {
  const cabeceras = { "Content-Type": "application/json" };
  if (metodo !== "GET") cabeceras["X-Op-Id"] = opId();
  const token = leerToken();
  if (token) cabeceras.Authorization = `Bearer ${token}`;

  const respuesta = await fetch(`${BASE}${ruta}`, {
    method: metodo,
    headers: cabeceras,
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
  });

  const datos = await respuesta.json().catch(() => null);
  if (!respuesta.ok) throw new Error(mensajeError(datos));
  return datos;
}

export const api = {
  registrar: (nombre, email, contrasena) =>
    peticion("/auth/registro", { metodo: "POST", cuerpo: { nombre, email, contrasena } }),
  login: (email, contrasena) =>
    peticion("/auth/login", { metodo: "POST", cuerpo: { email, contrasena } }),
  recuperar: (email, contrasena) =>
    peticion("/auth/recuperar", { metodo: "POST", cuerpo: { email, contrasena } }),
  crearCuenta: (usuario_id, moneda, saldo_inicial_centavos) =>
    peticion("/cuentas", { metodo: "POST", cuerpo: { usuario_id, moneda, saldo_inicial_centavos } }),
  listarCuentas: () => peticion("/cuentas"),
  consultarSaldo: (cuentaId) => peticion(`/cuentas/${cuentaId}`),
  consultarExtracto: (cuentaId) => peticion(`/cuentas/${cuentaId}/extracto`),
  depositar: (cuentaId, montoCentavos) =>
    peticion(`/cuentas/${cuentaId}/deposito`, { metodo: "POST", cuerpo: { monto_centavos: montoCentavos } }),
  retirar: (cuentaId, montoCentavos) =>
    peticion(`/cuentas/${cuentaId}/retiro`, { metodo: "POST", cuerpo: { monto_centavos: montoCentavos } }),
  transferir: (origenId, destinoId, montoCentavos) =>
    peticion("/transferencias", {
      metodo: "POST",
      cuerpo: { cuenta_origen_id: origenId, cuenta_destino_id: destinoId, monto_centavos: montoCentavos },
    }),
  transferirConversion: (origenId, destinoId, montoCentavos) =>
    peticion("/transferencias/conversion", {
      metodo: "POST",
      cuerpo: { cuenta_origen_id: origenId, cuenta_destino_id: destinoId, monto_centavos: montoCentavos },
    }),
  autotransferir: (origenId, destinoId, montoCentavos) =>
    peticion("/transferencias/autotransferencia", {
      metodo: "POST",
      cuerpo: { cuenta_origen_id: origenId, cuenta_destino_id: destinoId, monto_centavos: montoCentavos },
    }),
  auditoria: () => peticion("/auditoria"),
  estadoNodo: () => peticion("/interno/estado"),
};
