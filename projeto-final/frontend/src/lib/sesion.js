const CLAVE = "token";
const CUENTA = "cuentaId";

export function leerToken() {
  return localStorage.getItem(CLAVE);
}

export function guardarToken(token) {
  localStorage.setItem(CLAVE, token);
}

export function cerrarSesion() {
  localStorage.removeItem(CLAVE);
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
  return sessionStorage.getItem(CUENTA) || "";
}

export function guardarCuentaId(id) {
  if (id) sessionStorage.setItem(CUENTA, id);
}
