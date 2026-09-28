-- Número visible de las cuentas que ya existen.
-- Corrilo en el Postgres de A y, igual, en el de B, ANTES de crear cuentas
-- con la imagen nueva. El mismo id produce el mismo número en las dos bases.
-- Ejemplo: id a1b2c3d4e5f6 -> numero 61760246-8, agencia 0001.

ALTER TABLE cuenta ADD COLUMN IF NOT EXISTS agencia CHAR(4);
ALTER TABLE cuenta ADD COLUMN IF NOT EXISTS numero_cuenta VARCHAR(16);

UPDATE cuenta SET agencia = '0001' WHERE agencia IS NULL;
ALTER TABLE cuenta ALTER COLUMN agencia SET DEFAULT '0001';

CREATE OR REPLACE FUNCTION cuenta_cuerpo(cuenta_id text) RETURNS text AS $$
DECLARE
    raw bytea := decode(cuenta_id, 'hex');
    n bigint := 0;
    i int;
BEGIN
    FOR i IN 0..octet_length(raw) - 1 LOOP
        n := (n * 256 + get_byte(raw, i)) % 100000000;
    END LOOP;
    RETURN lpad(n::text, 8, '0');
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION cuenta_digito(cuerpo text) RETURNS text AS $$
DECLARE
    pesos int[] := ARRAY[2, 3, 4, 5, 6, 7, 8, 9];
    total int := 0;
    i int;
    resto int;
BEGIN
    FOR i IN 1..length(cuerpo) LOOP
        total := total + substr(cuerpo, length(cuerpo) - i + 1, 1)::int * pesos[((i - 1) % 8) + 1];
    END LOOP;
    resto := total % 11;
    IF resto < 2 THEN
        RETURN '0';
    END IF;
    RETURN (11 - resto)::text;
END;
$$ LANGUAGE plpgsql;

UPDATE cuenta
SET numero_cuenta = cuenta_cuerpo(id) || '-' || cuenta_digito(cuenta_cuerpo(id))
WHERE numero_cuenta IS NULL
  AND id ~ '^[0-9a-fA-F]+$'
  AND length(id) % 2 = 0;

CREATE UNIQUE INDEX IF NOT EXISTS uq_cuenta_numero ON cuenta (numero_cuenta)
    WHERE numero_cuenta IS NOT NULL;

SELECT id, agencia, numero_cuenta, moneda, saldo_centavos
FROM cuenta
ORDER BY fecha_creacion;
