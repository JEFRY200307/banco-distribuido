const CLAVE = "token";
const CUENTA = "cuentaId";
const CUENTAS = "cuentas";
const SALDOS = "saldosVisibles";
const PRINCIPAL = "cuentaPrincipal";

export function leerToken() {
  return localStorage.getItem(CLAVE);
}

export function guardarToken(token) {
  localStorage.setItem(CLAVE, token);
}

export function cerrarSesion() {
  const id = usuarioId();
  localStorage.removeItem(CLAVE);
  localStorage.removeItem(CUENTAS);
  if (id) localStorage.removeItem(`${PRINCIPAL}:${id}`);
  sessionStorage.removeItem(CUENTA);
}

export function usuarioId() {
  const token = leerToken();
  if (!token) return null;
  try {
    const cuerpo = token.split(".")[0].replace(/-/g, "+").replace(/_/g, "/");
    const json = JSON.parse(atob(cuerpo));
    return json.usuario_id ?? null;
  } catch {
    return null;
  }
}

export function leerCuentaId() {
  return sessionStorage.getItem(CUENTA) || leerCuentas()[0]?.id || "";
}

export function guardarCuentaId(id) {
  if (id) sessionStorage.setItem(CUENTA, id);
}

export function leerCuentas() {
  try {
    const datos = JSON.parse(localStorage.getItem(CUENTAS) || "[]");
    return Array.isArray(datos) ? datos : [];
  } catch {
    return [];
  }
}

export function recordarCuenta(cuenta) {
  if (!cuenta?.id) return;
  const previas = leerCuentas();
  const anterior = previas.find((item) => item.id === cuenta.id);
  const siguiente = {
    id: cuenta.id,
    moneda: cuenta.moneda || anterior?.moneda || "",
    saldo_centavos: cuenta.saldo_centavos ?? anterior?.saldo_centavos ?? null,
    estado: cuenta.estado || anterior?.estado || "",
    numero_cuenta: cuenta.numero_cuenta || anterior?.numero_cuenta || "",
    agencia: cuenta.agencia || anterior?.agencia || "0001",
  };
  const resto = previas.filter((item) => item.id !== cuenta.id);
  localStorage.setItem(CUENTAS, JSON.stringify([...resto, siguiente]));
}

export function recordarCuentas(lista) {
  localStorage.setItem(CUENTAS, JSON.stringify(lista.map((cuenta) => ({
    id: cuenta.id,
    moneda: cuenta.moneda || "",
    saldo_centavos: cuenta.saldo_centavos ?? null,
    estado: cuenta.estado || "",
    numero_cuenta: cuenta.numero_cuenta || "",
    agencia: cuenta.agencia || "0001",
  }))));
}

export function leerPrincipal() {
  const id = usuarioId();
  if (!id) return "";
  return localStorage.getItem(`${PRINCIPAL}:${id}`) || "";
}

export function guardarPrincipal(cuentaId) {
  const id = usuarioId();
  if (id && cuentaId) localStorage.setItem(`${PRINCIPAL}:${id}`, cuentaId);
}

export function leerSaldosVisibles() {
  return localStorage.getItem(SALDOS) !== "0";
}

export function guardarSaldosVisibles(visibles) {
  localStorage.setItem(SALDOS, visibles ? "1" : "0");
}
