# DOS Nostalgia — notas de producto y aristas

Documento vivo de **decisiones de negocio**, **deuda técnica** y **detalles fáciles de olvidar**.  
Handoff operativo Steam: ver también [`STEAM-RESUME.md`](STEAM-RESUME.md).

Última actualización: 2026-09-19.

---

## Soporte al usuario

| Qué | Estado | Notas |
|-----|--------|--------|
| Modal **Reportar problema** (`DosSupportDialog`) | **Hecho** | Error legible + comentario opcional + **Enviar** |
| Dónde aparece | **Hecho** | Launch error, ErrorBoundary (crash UI), Ajustes |
| Qué hace Enviar hoy | **Temporal** | Copia diagnóstico al portapapeles + abre GitHub Issues **si** `package.json` → `homepage` es un repo real |
| Sin repo aún | **Actual** | Solo clipboard; mensaje lo explica |
| Backend de tickets / email | **Pendiente** | Sustituir o complementar Issues cuando exista |
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
| Feed GitHub Releases | **Pendiente** | Requiere `homepage` + `publish` reales en electron-builder |
| Steam self-update | **No** | Steam gestiona updates |
| Code signing Windows | **Pendiente** | SmartScreen sin cert |

---

## Legal / publicación

| Qué | Estado | Notas |
|-----|--------|--------|
| BYOG + gate legal | **Hecho** | |
| GPLv2 + carpeta licenses | **Hecho** | |
| Repo público GitHub | **Pendiente** | Bloquea homepage, Issues, updates feed |
| `homepage` placeholder | **Actual** | `https://github.com` — reemplazar |
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
2. Si ya hay repo: actualizar `homepage`, NOTICE, publish, y probar **Enviar** del modal de soporte (debe abrir Issues).
3. Prompt útil: *“Seguí desde PROJECT-NOTES.md y STEAM-RESUME.md”*.
