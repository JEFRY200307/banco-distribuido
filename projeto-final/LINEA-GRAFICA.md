# Línea gráfica

La interfaz es una aplicación móvil. En el teléfono ocupa toda la pantalla. En una ventana ancha se muestra centrada, con el mismo ancho de un celular, para revisar el mismo diseño.

No hay rol de administrador y no hay panel de escritorio.

## Color

| Token | Valor | Uso |
|---|---|---|
| `--morado` | `#820AD1` | Botón principal, enlaces, marca |
| `--morado-oscuro` | `#5A0791` | Botón al pulsarlo |
| `--morado-suave` | `#F3E8FC` | Avisos y chips |
| `--fondo` | `#F7F7F9` | Fondo de la pantalla |
| `--superficie` | `#FFFFFF` | Tarjetas y cabecera |
| `--borde` | `#E7E7EC` | Bordes |
| `--texto` | `#1A1A2E` | Texto principal |
| `--texto-tenue` | `#6B6B7B` | Etiquetas y ayuda |
| `--exito` | `#00A868` | Cuadre de auditoría |
| `--error` | `#E5484D` | Error de formulario |

La barra del navegador usa el mismo morado (`theme-color`).

## Tipo y espacio

Fuente: Inter, y si no está, la del sistema. Títulos de cabecera a 16px y peso 700. Etiquetas de campo en mayúsculas, 11px. Montos grandes a 34px y peso 800.

Los campos de texto usan 16px. En iOS, un tamaño menor hace zoom al enfocar.

El botón principal mide al menos 54px de alto y ocupa el ancho de la tarjeta. El radio de tarjetas es 20px; el de botones, 14px; el de campos, 12px.

## Piezas

| Pieza | Qué es |
|---|---|
| `Pantalla` | Cabecera con el logo, título, volver o menú de tres líneas |
| `Campo` | Etiqueta más input o select |
| `Boton` | Principal, secundario o peligro |
| `Aviso` | Nota neutra o error |
| `Carga` | Texto mientras llega el código de otra pantalla |

La marca es el escudo del archivo `public/logo.jpg`. La cabecera usa `public/logo.png`. El favicon y los iconos de la PWA (`favicon.png`, `icon-192.png`, `icon-512.png`) son ese mismo escudo sobre blanco.

## Móvil

Por debajo de 640px desaparece el marco de teléfono: sin borde, sin sombra, fondo continuo y alto de la ventana (`100dvh`). La cabecera se queda fija. El padding respeta el área segura del teléfono (`safe-area-inset`).

Los términos, abiertos desde el registro, salen en una cortina sobre el formulario para no borrar lo que la persona ya escribió.

## Qué se carga

La pantalla de login viaja con la primera descarga. Crear usuario, recuperar contraseña, términos y cada operación (cuenta, saldo, depósito, retiro, extracto, transferencias, auditoría, estado) son módulos aparte: el navegador los pide cuando se abre esa ruta, no antes.

Las llamadas a `/api` no se guardan en la caché de la PWA. Sin red, la carcasa puede abrir y la operación falla.

## PWA

`vite-plugin-pwa` genera el manifest y el service worker en el build. `display` es `standalone`, orientación vertical, idioma `es`, color de tema `#820AD1`. Se instala desde el navegador del teléfono cuando el sitio está en HTTPS (Vercel).
