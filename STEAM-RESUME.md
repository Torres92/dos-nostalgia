# DOS Nostalgia → Steam — handoff

**Repo:** https://github.com/Torres92/dos-nostalgia  
**Fase 1:** **Cerrada** (2026-10-07) — homepage, NOTICE, publish, remote  
**Siguiente:** Fase 2 (estabilidad) → Fase 3 (Steam)

---

## Veredicto actual

El proyecto es un **MVP sólido / beta privada**, **no listo para publicar en Steam**.

- Legal BYOG + GPLv2 + fuente pública: OK
- Falta: tests/CI/signing, pipeline Steam, primera GitHub Release para updates

---

## Fases

| Fase | Estado | Contenido |
|------|--------|-----------|
| **1** Legal + higiene | **Cerrada** | Repo, homepage, NOTICE, publish, limpiezas |
| **2** Estabilidad | Pendiente | Tests smoke, CI, checklist firmado, Release |
| **3** Steam | Pendiente | AppID, depots, store copy BYOG, upload |

---

## Hecho (resumen)

### Play + Setup / persistencia / UX
- SETUP detect, PLAY/SETUP, write-back carpeta, avisos ZIP/RAR
- Confirm exit (`DosConfirmDialog`), Reportar (`DosSupportDialog`)
- Updates scaffold steam|direct; publish → `Torres92/dos-nostalgia`
- Mini-juegos bundled eliminados (no reintroducir)

### Fase 1 closeout (2026-10-07)
- Remote: `origin` → https://github.com/Torres92/dos-nostalgia.git
- `package.json` homepage + repository + bugs
- `electron-builder.yml` publish owner `Torres92`
- `licenses/NOTICE.txt`, `THIRD_PARTY_NOTICES.txt`, `PRIVACY.txt` con URL de fuente/Issues
- README sin placeholder de homepage

---

## Checklist post–Fase 1

### Verificar build (manual / CI)
- [ ] `npm run build:win`
- [ ] No reaparecen `bundled-games` en dist
- [ ] `licenses/` viaja en el instalador
- [ ] Probar Raptor (carpeta): SETUP → guardar → PLAY
- [ ] Reportar problema → abre Issues

### Fase 2
- Tests smoke `scan-games` / `build-bundle` / setup detect
- CI (GitHub Actions)
- Lint usable (CRLF/prettier)
- Checklist code signing
- Primera GitHub Release (para electron-updater)

### Fase 3 (Steam)
- Steam Direct / AppID
- Depots + upload
- Store: BYOG explícito, sin ROMs, disclaimer de compatibilidad

---

## Decisiones

1. **Soporte:** GitHub Issues (Enviar copia reporte + abre form).
2. **Sin mini-juegos bundled.**
3. **i18n ES/EN:** diferido.
4. **Play + Setup:** preferir juegos en carpeta para persistir.

---

## Comandos

```bash
npm run typecheck
npm run lint
npm run dev
npm run build:win
```

Node 20+. Carpeta: `d:\mis documentos\projects\legacy-arcade`

---

## Prompt próximo chat

> Seguí desde `STEAM-RESUME.md` / `PROJECT-NOTES.md`. Fase 1 cerrada (repo Torres92/dos-nostalgia). Arrancá Fase 2: tests smoke + CI.
