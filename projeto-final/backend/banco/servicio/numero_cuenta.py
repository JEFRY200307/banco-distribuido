"""Número visible de la cuenta. El id interno sigue siendo otro dato.

La agencia es 0001 para todo el banco: no hay sucursales. El número son
8 dígitos y un dígito de control (módulo 11). El mismo id produce el mismo
número, así las dos bases pueden rellenarlo con la misma cuenta.
"""

AGENCIA = "0001"


def digito(cuerpo: str) -> str:
    pesos = (2, 3, 4, 5, 6, 7, 8, 9)
    total = sum(int(d) * pesos[i % 8] for i, d in enumerate(reversed(cuerpo)))
    resto = total % 11
    if resto < 2:
        return "0"
    return str(11 - resto)


def numero_desde_id(cuenta_id: str, salto: int = 0) -> str:
    base = (int(cuenta_id, 16) + salto) % 100_000_000
    cuerpo = f"{base:08d}"
    return f"{cuerpo}-{digito(cuerpo)}"


def normalizar_numero(texto: str) -> str:
    digitos = "".join(ch for ch in str(texto) if ch.isdigit())
    if digitos.startswith(AGENCIA) and len(digitos) >= 13:
        digitos = digitos[len(AGENCIA):]
    if len(digitos) < 9:
        raise ValueError("número de cuenta inválido")
    return f"{digitos[:8]}-{digitos[8]}"


def elegir_numero(cuenta_id: str, ocupado) -> str:
    for salto in range(30):
        candidato = numero_desde_id(cuenta_id, salto)
        if ocupado(candidato) is None:
            return candidato
    raise RuntimeError("sin numero libre")
