export function aCentavos(texto) {
  const normal = String(texto).trim().replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(normal)) {
    throw new Error("Escribe un monto con hasta dos decimales");
  }
  return Math.round(Number(normal) * 100);
}

export function formato(centavos, moneda = "") {
  const valor = (Number(centavos) / 100).toFixed(2);
  return moneda ? `${valor} ${moneda}` : valor;
}

export function mascaraCuenta(id) {
  const texto = String(id || "");
  if (texto.length <= 4) return texto;
  return `···· ${texto.slice(-4)}`;
}
