# Blocklist Harvester

![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)

Herramienta web full-stack para la recolección inteligente, normalización, validación **RFC 1035**, inspección DNS/CNAME y exportación multiformato de blocklists listas para desplegar en **Pi-hole**, **Unbound DNS**, **MikroTik RouterOS**, **pfSense / OPNsense (pfBlockerNG)**, **AdGuard Home** y **Dnsmasq**.

<!-- TODO: agrega una captura o GIF de la interfaz -->
<!-- ![Vista general](docs/screenshot-main.png) -->

## Tabla de contenidos

- [Características principales](#características-principales)
- [Formatos de exportación soportados](#formatos-de-exportación-soportados)
- [Ejemplos de salida](#ejemplos-de-salida)
- [Stack tecnológico](#stack-tecnológico)
- [Instalación y uso local](#instalación-y-uso-local)
- [Seguridad](#seguridad)
- [Estructura del proyecto](#estructura-del-proyecto)
- [Limitaciones y advertencias](#limitaciones-y-advertencias)
- [Contribuir](#contribuir)
- [Licencia](#licencia)

---

## Características principales

### Recolección y análisis de dominios

- **Búsqueda web multi-variación:** ejecuta consultas paralelas en español e inglés (búsqueda literal, listas top, variaciones de intención, autocompletado de sugerencias y síntesis opcional con Gemini API).
- **Normalización inteligente:** extrae únicamente el dominio relevante eliminando protocolos, puertos, rutas y prefijos redundantes (`www.`, `m.`, `amp.`), y descarta acortadores de URL, IPs internas y agregadores genéricos.
- **Validación RFC 1035:** verifica la longitud total (≤ 253 caracteres), etiquetas válidas (1–63 caracteres), TLDs alfabéticos/punycode y rechaza direcciones IP numéricas.
- **Detección de falsos positivos y variantes:** marca automáticamente dominios de infraestructura compartida, CDN o pasarelas de pago para revisión manual, y agrupa variantes de TLD/subdominio (ej. `dominio.com` vs `dominio.io`).

### Rendimiento para listas masivas (client-side)

- **Deduplicación eficiente:** uso extensivo de `Set` y `Map`, con inserción y consulta en O(1) amortizado, para fusiones, comparaciones y búsquedas instantáneas.
- **Scroll virtual (`@tanstack/react-virtual`):** renderiza únicamente las filas visibles, manteniendo una interfaz fluida con decenas de miles de dominios.
- **Web Worker en segundo plano:** al importar o comparar archivos con más de **5.000 líneas**, el parseo, la validación RFC 1035 y la deduplicación se ejecutan en un Web Worker dedicado sin congelar la interfaz.
- **Verificación DNS por lotes:** procesamiento en chunks de 30 dominios con semáforo de concurrencia, barra de progreso porcentual y cancelación en vivo.

### Herramientas de gestión y red

- **Modo acumulativo (Append / Merge):** combina los resultados de múltiples búsquedas consecutivas sin duplicados, conservando selecciones previas y estados DNS.
- **Inspección de CNAME y redirecciones HTTP:** resuelve registros `A/AAAA` y `CNAME`, y sigue hasta 3 saltos de redirección HTTP/HTTPS (`↳ CNAME / Redirige a: destino.com`), permitiendo añadir y bloquear el dominio final con un clic.
- **Comparar con lista existente (Diff Mode):** importa o pega una blocklist existente (hosts, AdGuard, Dnsmasq, Unbound, CSV o texto plano) para clasificar los resultados en **`Ya en tu lista`** y **`Nuevos descubiertos`**, con filtros y selección rápida de solo nuevos.
- **Guías de despliegue dinámicas:** el botón de guía del encabezado se adapta al formato seleccionado y muestra las instrucciones y comandos CLI exactos para ese sistema.

---

## Formatos de exportación soportados

| Formato | Sintaxis generada | Bloquea subdominios | Extensión |
| :--- | :--- | :---: | :--- |
| **Pi-hole / hosts** | `0.0.0.0 dominio.com` (con bloque de metadatos UTC ISO 8601) | No (solo dominio exacto) | `.txt` |
| **Unbound DNS** | `local-zone: "dominio.com" always_nxdomain` | Sí | `.txt` |
| **MikroTik RouterOS** | `/ip dns static add name="dominio.com" address=0.0.0.0` | No (en RouterOS 7 requiere `match-subdomain=yes`) | `.txt` |
| **pfSense / pfBlockerNG** | Lista limpia DNSBL (`dominio.com`) con encabezados `#` | Según la configuración de pfBlockerNG | `.txt` |
| **AdGuard Home** | `\|\|dominio.com^` | Sí | `.txt` |
| **Dnsmasq** | `address=/dominio.com/0.0.0.0` | Sí | `.txt` |
| **Solo dominios** | `dominio.com` (1 por línea) | Depende del destino | `.txt` |
| **CSV (Auditoría / SIEM)** | `dominio,estado_dns,ip_resuelta,variante_tld,es_redireccion` | N/A | `.csv` |

> **Nota:** el alcance del bloqueo (solo el dominio exacto o también sus subdominios) depende del sistema de destino, no de esta herramienta. Verifícalo antes de desplegar.

---

## Ejemplos de salida

Ejemplos con dominios ficticios.

**Pi-hole / hosts**
```text
# Generado por Blocklist Harvester - 2026-01-01T00:00:00Z
0.0.0.0 ejemplo-malo.com
0.0.0.0 tracker-ejemplo.net
```

**Unbound DNS**
```text
local-zone: "ejemplo-malo.com" always_nxdomain
local-zone: "tracker-ejemplo.net" always_nxdomain
```

**MikroTik RouterOS**
```text
/ip dns static add name="ejemplo-malo.com" address=0.0.0.0
/ip dns static add name="tracker-ejemplo.net" address=0.0.0.0
```

**AdGuard Home**
```text
||ejemplo-malo.com^
||tracker-ejemplo.net^
```

**Dnsmasq**
```text
address=/ejemplo-malo.com/0.0.0.0
address=/tracker-ejemplo.net/0.0.0.0
```

**CSV (Auditoría / SIEM)**
```csv
dominio,estado_dns,ip_resuelta,variante_tld,es_redireccion
ejemplo-malo.com,resuelve,203.0.113.10,no,no
tracker-ejemplo.net,nxdomain,,no,no
```

---

## Stack tecnológico

- **Frontend:** React 19, TypeScript, Tailwind CSS v4, Lucide Icons, `@tanstack/react-virtual`
- **Backend:** Node.js, Express, `tsx`, `dns/promises`
- **IA / Grounding (opcional):** `@google/genai`

---

## Instalación y uso local

### Requisitos

- Node.js <!-- TODO: versión mínima, ej. 20+ -->
- npm

### 1. Clonar el repositorio e instalar dependencias

```bash
git clone <url-de-tu-repositorio>
cd blocklist-harvester
npm install
```

### 2. Configurar variables de entorno

Crea un archivo `.env` en la raíz del proyecto (puedes basarte en `.env.example`):

```env
# Opcional: mejora la síntesis semántica de dominios por tema
GEMINI_API_KEY="TU_API_KEY_DE_GEMINI"

# Puerto del servidor (por defecto 3000)
PORT=3000
```

<!-- TODO: confirma que GEMINI_API_KEY solo se usa en el servidor y nunca se envía al cliente, y dilo aquí -->

### 3. Ejecutar en desarrollo

```bash
npm run dev
```

La aplicación estará disponible en <http://localhost:3000>.

### 4. Compilar y ejecutar en producción

```bash
npm run build
NODE_ENV=production npm start
```

### 5. Verificación de tipos TypeScript

```bash
npm run lint
```

---


## Seguridad

El backend resuelve DNS y sigue redirecciones HTTP/HTTPS de dominios proporcionados por el usuario, por lo que conviene tener en cuenta el riesgo de **SSRF** (que el servidor sea inducido a consultar recursos internos).

<!-- TODO: completa con lo que realmente implementa el proyecto, por ejemplo:
- Bloqueo de rangos privados, loopback y link-local (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, 127.0.0.0/8, 169.254.0.0/16, ::1, fc00::/7).
- Revalidación de la IP resuelta en cada salto de redirección.
- Límite de saltos (3), timeouts y límite de tamaño de respuesta.
- Rate limiting de las peticiones al backend.
-->

Recomendaciones:

- Ejecuta la herramienta en **local o en una red de confianza**; no la expongas a Internet sin autenticación.
- Mantén `GEMINI_API_KEY` solo en el servidor y fuera del control de versiones (`.env` en `.gitignore`).

---

## Estructura del proyecto

<!-- TODO: ajusta a tu estructura real -->
```text
blocklist-harvester/
├── src/              # Frontend (React)
│   └── workers/      # Web Worker de parseo y deduplicación
├── server.ts         # Backend Express (endpoints de búsqueda, DNS y redirecciones)
├── .env.example
└── package.json
```

### Endpoints del backend

<!-- TODO: documenta tus endpoints, por ejemplo:
| Método | Ruta | Descripción |
| :--- | :--- | :--- |
| POST | /api/search | ... |
| POST | /api/dns-check | ... |
-->

---

## Limitaciones y advertencias

- Las listas se generan automáticamente a partir de resultados de búsqueda públicos y análisis heurístico; **no reemplazan la revisión manual** del administrador antes de desplegar en producción.
- Pueden existir **falsos positivos** (dominios legítimos en resultados relacionados tangencialmente o alojados en infraestructura compartida) y **falsos negativos** (sitios con baja indexación).
- <!-- TODO: indica qué motores o fuentes de búsqueda se usan y si pueden aplicar límites o restricciones de uso -->

---

## Contribuir

Las contribuciones son bienvenidas. Abre un *issue* para discutir cambios mayores y envía un *pull request* con una descripción clara.

---

## Licencia

Distribuido bajo la licencia **Apache-2.0**. Consulta el archivo [`LICENSE`](LICENSE) para más información.
