# Pruebas de Mi Plan de Libertad
- `tests/libertad_engine.test.ts` (20): fórmulas con cálculo a mano, prorrateo, fondo, meta por tasa, doble conteo, tiempo, inflación, escenarios, casos (asalariada, ingresos variables, alta facturación/poca utilidad, patrimonio ilíquido, deudas, dependientes, seguir trabajando, retiro temprano, datos incompletos, extremos sin NaN).
- `tests/libertad_service.test.ts` (27): cifrado, consentimiento, aislamiento entre clientes/administradores/agencia, auditoría sin datos, cuestionario adaptativo, versiones, seguimiento, exportar/borrar, Cerebro (solo lo autorizado, sin cifras, sin inyección), tareas, coste de IA = 0.
- E2E `scripts/e2e/libertad.sh` (PostgreSQL real, sin IA): consentimiento, reanudar, corto y profundo con ramificación, mapa, supuestos, versiones, tareas, compartir, exportar, aislamiento, móvil, axe, borrado. Capturas en `docs/libertad/evidencia/capturas/`.
`npm run check`: 322 pruebas, tsc y secretos limpios (2026-11-04).
