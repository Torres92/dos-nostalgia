# DOS Nostalgia — notas de producto y aristas

Documento vivo de **decisiones de negocio**, **deuda técnica** y **detalles fáciles de olvidar**.  
Handoff operativo Steam: ver también [`STEAM-RESUME.md`](STEAM-RESUME.md).

Última actualización: 2026-10-07.

---

## Soporte al usuario

| Qué | Estado | Notas |
|-----|--------|--------|
| Modal **Reportar problema** (`DosSupportDialog`) | **Hecho** | Error legible + comentario opcional + **Enviar** |
| Dónde aparece | **Hecho** | Launch error, ErrorBoundary (crash UI), Ajustes |
| Qué hace Enviar hoy | **Hecho (GitHub)** | Copia diagnóstico + abre Issues en [Torres92/dos-nostalgia](https://github.com/Torres92/dos-nostalgia/issues) |
| Backend de tickets / email | **Pendiente** | Sustituir o complementar Issues si hace falta |
| Mailto dedicado | **Pendiente** | Alternativa si no queremos depender de GitHub login |
| Pegar diagnóstico en el issue | **Manual** | URL no puede llevar el JSON completo; el usuario pega Ctrl+V |

Archivos: `DosSupportDialog.tsx`, `diagnostics.submitSupportReport`, IPC `diagnostics:submit-support`.

---

## Confirmación al salir del juego

| Qué | Estado | Notas |
|-----|--------|--------|
| Modal DOS al salir (`DosConfirmDialog`) | **Hecho** | Back / Guardar y volver / Guardar y jugar |
| Esc en fullscreen | **Hecho** | Solo sale de fullscreen (no del juego) |
| Cerrar ventana OS (X) | **Pendiente** | No intercepta aún; podría perder partida sin confirmar |
| Teclas in-game que “salen” | **N/A app** | Esc del juego DOS es del título, no de la app |

---

## Persistencia (saves / SETUP)

| Qué | Estado | Notas |
|-----|--------|--------|
| Write-back carpeta/exe al salir | **Hecho** | `ci.persist` → disco |
| ZIP/RAR | **Limitación de producto** | No se escribe al archivo; UI avisa descomprimir |
| Detección setup en `.rar` al scan | **Pendiente** | Peek caro; zip/carpeta sí |
| Keen `CONFIG.CK*` / Raptor `SETUP.INI` / `.FIL` | **Hecho** | Filtros de persistencia |
| Win98 / LBA2 etc. | **Fuera de scope** | Solo DOS vía js-dos / DOSBox-X |

---

## Mouse / controles

| Qué | Estado | Notas |
|-----|--------|--------|
| Shooters (Raptor…): mouse relativo | **Hecho** | Heurística autolock; sin pointer-lock de la app en SETUP |
| SETUP sensibilidad | **Hecho** | Cursor libre en setup |
| WASD / teclado en SETUP | **Depende del juego** | Persistido si write-back OK |

---

## i18n (ES / EN)

| Qué | Estado | Notas |
|-----|--------|--------|
| UI seleccionable ES/EN | **Diferido** | Textos mezclados ES/EN hoy; no bloquear MVP |
| Preferencia en settings | **Pendiente** | Cuando se haga i18n |

---

## Updates / distribución

| Qué | Estado | Notas |
|-----|--------|--------|
| Canal `steam` \| `direct` | **Scaffold** | Detecta Steam / override env |
| Banner + check en Ajustes/About | **Hecho** | |
| `homepage` + `publish` GitHub | **Hecho** | `Torres92/dos-nostalgia` |
| Primera Release en GitHub | **Pendiente** | Crear release para que el feed de updates tenga algo que servir |
| Steam self-update | **No** | Steam gestiona updates |
| Code signing Windows | **Pendiente** | SmartScreen sin cert |

---

## Legal / publicación

| Qué | Estado | Notas |
|-----|--------|--------|
| BYOG + gate legal | **Hecho** | |
| GPLv2 + carpeta licenses | **Hecho** | |
| Repo público GitHub | **Hecho** | https://github.com/Torres92/dos-nostalgia |
| NOTICE / PRIVACY con URL fuente | **Hecho** | 2026-10-07 |
| Mini-juegos bundled | **Eliminados** | No reintroducir en dist |
| Steam store copy BYOG | **Pendiente** | Fase 3 |

---

## Calidad / engineering

| Qué | Estado | Notas |
|-----|--------|--------|
| Review launch (canvas) | **Hecho** | `launch-review.canvas.tsx` P0–P3 |
| P0 seguridad IPC paths | **Hecho** (sesión previa) | |
| Tests smoke scan/bundle | **Pendiente** | Fase 2 |
| CI | **Pendiente** | |
| Lint warnings CRLF/prettier | **Deuda** | |

---

## UX / producto menores

| Qué | Estado | Notas |
|-----|--------|--------|
| Icono ventana Electron | **Hecho** (sesión previa) | |
| Botón F10 en UI | **Eliminado** | F10 sigue siendo del juego/SETUP |
| Confirm exit + Reportar | **Hecho** | Estilo DOS compartido |

---

## Cómo retomar

1. Leer este archivo + `STEAM-RESUME.md`.
2. Fase 2: tests smoke, CI, signing; opcional primera GitHub Release.
3. Prompt útil: *“Seguí desde PROJECT-NOTES.md y STEAM-RESUME.md — Fase 1 cerrada; arrancá Fase 2”*.
