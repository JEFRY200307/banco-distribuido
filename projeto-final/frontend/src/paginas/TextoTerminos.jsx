export default function TextoTerminos({ onCerrar }) {
  return (
    <article className="tarjeta terminos">
      <h2>Términos y condiciones</h2>
      <p>
        Este banco es un proyecto de curso. No es una entidad financiera, no custodia
        dinero real y no tiene rol de administrador.
      </p>
      <p>
        Al registrarte guardamos tu nombre, tu email y un hash de la contraseña en el
        nodo que atiende el alta. La sesión dura 8 horas. Quien tenga el email puede
        definir una contraseña nueva desde «Recuperar contraseña», porque no hay
        servidor de correo que confirme la identidad.
      </p>
      <p>
        Las operaciones de saldo, retiro, extracto y transferencia exigen esa sesión
        y que la cuenta sea tuya. Crear cuenta y depositar, en la API actual, no
        piden sesión.
      </p>
      {onCerrar && <button className="btn-secundario" type="button" onClick={onCerrar}>Cerrar</button>}
    </article>
  );
}
