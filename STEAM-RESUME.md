# Retomar el miércoles — DOS Nostalgia → Steam

**Pausa:** 2026-09-19  
**Retomar:** a partir del miércoles (cuando haya acceso a GitHub)

Este archivo es el contexto de handoff. Abrilo en la nueva ventana/chat y pedí: *“seguí desde STEAM-RESUME.md”*.

---

## Veredicto actual

El proyecto es un **MVP sólido / beta privada**, **no listo para publicar en Steam**.

- Legal BYOG + GPLv2: bien encaminado
- Falta: fuente pública (repo), pipeline Steam, más calidad/tests
- Review detallada (canvas Cursor): `launch-review.canvas.tsx` — seguridad, UX, packaging, roadmap P0–P3 (2026-09-19)

---

## Fases acordadas

| Fase | Estado | Contenido |
|------|--------|-----------|
| **1** Legal + higiene | **Parcial** | Repo, URL, TERMS, eslint, limpiezas |
| **2** Estabilidad | Pendiente | Tests smoke, CI, checklist firmado |
| **3** Steam | Pendiente | AppID, depots, store copy BYOG, upload |

---

## Hecho el 2026-09-19 (después de la pausa parcial)

### Play + Setup (UX)
- Detección de `SETUP` / `CONFIG` / `SETSOUND` en carpetas y `.zip` al escanear.
- Botones **PLAY** / **SETUP**, badge `[SET]`, tecla **S**.
- Al salir del Setup desde un juego en **carpeta**, se intenta guardar la config en disco (`ci.persist` → write-back).
- En **ZIP/RAR** se muestra aviso: la config no persiste en el archivo (descomprimir).
- `.rar`: aún no se detecta setup en el scan (peek caro); descomprimir o usar zip/carpeta.

### Fase 1 previa
- Mini-juegos freeware eliminados del `dist/`.
- Eslint ignora js-dos vendored.
- Docs: GitHub Issues = soporte válido.
- Fix `SettingsView` setState-in-effect.
- `homepage` placeholder pendiente de GitHub (miércoles).

---

### Hecho el 2026-09-19 (tarde) — updates scaffold
- Canal `steam` | `direct` (env Steam / `steam_appid.txt` / override `DOS_NOSTALGIA_CHANNEL`).
- `electron-updater` + IPC `updates:check` / download-install / open-release.
- Banner en biblioteca si hay update; botón en Ajustes y Acerca de.
- Steam: no self-update. Direct: feed GitHub cuando `publish` + homepage reales existan.
- Publish en `electron-builder.yml` aún con placeholder `YOUR_GITHUB_USER/dos-nostalgia`.

---

### Hecho el 2026-09-19 (noche) — salida + soporte UX
- Confirmación DOS antes de salir del juego/SETUP (`DosConfirmDialog`).
- Modal **Reportar problema** (`DosSupportDialog`): error + comentario + Enviar → clipboard + GitHub Issues cuando haya repo.
- Notas vivas de producto/aristas: [`PROJECT-NOTES.md`](PROJECT-NOTES.md).

---

## Reiniciar el miércoles — checklist

### 1. GitHub (bloqueante Fase 1)

1. Crear repo público (sugerido: `dos-nostalgia` o el nombre que elijas).
2. En este proyecto:
   - `git init` si aún no hay `.git`
   - Primer commit (cuando lo pidas explícitamente)
   - `git remote add origin <url>`
   - Push
3. Actualizar `package.json` → `"homepage": "https://github.com/<user>/<repo>/issues"` (o la URL del repo).
4. Actualizar `licenses/NOTICE.txt` / `THIRD_PARTY_NOTICES.txt` con cómo obtener la fuente correspondiente a la versión publicada (enlace al tag/release).
5. Quitar o actualizar el recordatorio placeholder en README / PRIVACY.

### 2. Cerrar Fase 1

- Rebuild Windows (`npm run build:win`) y verificar que **no** reaparecen `bundled-games`.
- Confirmar que `licenses/` viaja en el instalador.
- Probar Raptor (u otro) con carpeta descomprimida: SETUP → guardar teclado → PLAY.

### 3. Fase 2 (después del repo)

- Tests smoke de `scan-games` / `build-bundle` / setup detect
- Detección setup en `.rar` on-demand (opcional)
- Dejar lint usable (warnings prettier/CRLF)
- Checklist code signing

### 4. Fase 3 (Steam)

- Steam Direct / AppID
- Depots + script upload
- Store page: BYOG explícito, sin ROMs, disclaimer de compatibilidad

---

## Decisiones ya tomadas

1. **Soporte:** modal Enviar → GitHub Issues (clipboard hasta que exista repo). Evolucionar a backend/mailto si hace falta — ver PROJECT-NOTES.md.
2. **Mini-juegos bundled:** eliminarlos (hecho en dist; no reintroducir).
3. **Pausa GitHub:** sin acceso hasta el miércoles → no forzar remoto ni homepage real antes.
4. **Play + Setup:** implementado (2026-09-19); preferir juegos en carpeta para que la config persista.
5. **i18n ES/EN:** diferido a propósito.

---

## Comandos útiles al retomar

```bash
npm run typecheck
npm run lint
npm run dev
npm run build:win
```

Node 20+. Carpeta del proyecto: `d:\mis documentos\projects\legacy-arcade`

---

## Prompt sugerido para el próximo chat

> Retomá DOS Nostalgia desde `STEAM-RESUME.md`. Ya tengo el repo en GitHub: `<pegar-url>`. Completá Fase 1 (homepage, NOTICE, git remote/push si hace falta) y seguí con Fase 2.
