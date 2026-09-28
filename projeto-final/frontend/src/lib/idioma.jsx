import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { TEXTOS } from "./textos.js";

const Contexto = createContext(null);

export function IdiomaProvider({ children }) {
  const [idioma, setIdioma] = useState(() => localStorage.getItem("idioma") || "es");

  useEffect(() => {
    localStorage.setItem("idioma", idioma);
    document.documentElement.lang = idioma === "pt" ? "pt" : "es";
  }, [idioma]);

  const t = useCallback(
    (clave) => TEXTOS[idioma]?.[clave] ?? TEXTOS.es[clave] ?? clave,
    [idioma],
  );
  const alternar = () => setIdioma((valor) => (valor === "es" ? "pt" : "es"));

  return (
    <Contexto.Provider value={{ idioma, t, alternar }}>
      {children}
    </Contexto.Provider>
  );
}

export function useIdioma() {
  return useContext(Contexto);
}
