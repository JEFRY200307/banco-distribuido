import { lazy, Suspense } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import Carga from "./componentes/Carga.jsx";
import { leerToken } from "./lib/sesion.js";
import Login from "./paginas/Login.jsx";

const Registro = lazy(() => import("./paginas/Registro.jsx"));
const Recuperar = lazy(() => import("./paginas/Recuperar.jsx"));
const Terminos = lazy(() => import("./paginas/Terminos.jsx"));
const Inicio = lazy(() => import("./paginas/Inicio.jsx"));
const CrearCuenta = lazy(() => import("./paginas/acciones/CrearCuenta.jsx"));
const Saldo = lazy(() => import("./paginas/acciones/Saldo.jsx"));
const Depositar = lazy(() => import("./paginas/acciones/Depositar.jsx"));
const Retirar = lazy(() => import("./paginas/acciones/Retirar.jsx"));
const Extracto = lazy(() => import("./paginas/acciones/Extracto.jsx"));
const Transferir = lazy(() => import("./paginas/acciones/Transferir.jsx"));
const Conversion = lazy(() => import("./paginas/acciones/Conversion.jsx"));
const Autotransferencia = lazy(() => import("./paginas/acciones/Autotransferencia.jsx"));
const Auditoria = lazy(() => import("./paginas/acciones/Auditoria.jsx"));
const Estado = lazy(() => import("./paginas/acciones/Estado.jsx"));

function Privada({ children }) {
  if (!leerToken()) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<Carga />}>
        <Routes>
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/login" element={<Login />} />
          <Route path="/registro" element={<Registro />} />
          <Route path="/recuperar" element={<Recuperar />} />
          <Route path="/terminos" element={<Terminos />} />
          <Route path="/inicio" element={<Privada><Inicio /></Privada>} />
          <Route path="/cuentas/nueva" element={<Privada><CrearCuenta /></Privada>} />
          <Route path="/saldo" element={<Privada><Saldo /></Privada>} />
          <Route path="/depositar" element={<Privada><Depositar /></Privada>} />
          <Route path="/retirar" element={<Privada><Retirar /></Privada>} />
          <Route path="/extracto" element={<Privada><Extracto /></Privada>} />
          <Route path="/transferir" element={<Privada><Transferir /></Privada>} />
          <Route path="/conversion" element={<Privada><Conversion /></Privada>} />
          <Route path="/autotransferencia" element={<Privada><Autotransferencia /></Privada>} />
          <Route path="/auditoria" element={<Privada><Auditoria /></Privada>} />
          <Route path="/estado" element={<Privada><Estado /></Privada>} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
