# Pruebas y evidencia (qué es simulado y qué es real)

**Todo lo que toca modelos y OpenRouter se probó con SIMULACIONES locales** (proveedores guionados y un servidor HTTP local que imita el formato compatible con OpenAI). Lo real: la lógica propia (selección, validación, reservas atómicas contra PostgreSQL real, aislamiento, consumo exacto) y el flujo de navegador. **No hay prueba contra OpenRouter real.**

| Prueba | Qué cubre | ¿Real o simulado? |
|---|---|---|
| `tests/router.test.ts` | Configuración con validación/auditoría; selección por nivel, sensibilidad, plan y presupuesto; validación de salida; fallback (transitorio e inválido); gratuito sin escalar a pago; **sin superar el presupuesto**; máximo de intentos; herramientas sin duplicarse; concurrencia (20 reservas paralelas); liquidación idempotente; reservas huérfanas; bloqueo por cuota; alertas; aislamiento; datos confidenciales | Lógica real; proveedores simulados; PGlite y PostgreSQL 16 |
| `tests/openrouter_contrato.test.ts` | Nuestro adaptador de OpenRouter contra un servidor local que imita el contrato: éxito, herramientas, costo reportado, errores 401/402/429/5xx, argumentos inválidos, privacidad enviada por sensibilidad, sin filtrar la clave, y el router completo sobre ese servidor | **Contrato supuesto**, no verificado contra OpenRouter real |
| `tests/configurar_openrouter.test.ts` | El configurador de la clave: simulacro sin cambios, no imprime la clave, no toca Stripe/Anthropic/BD/Resend, **nunca enciende `AI_ROUTER`** | Lógica real, archivo de configuración de prueba |
| `scripts/e2e/compra_directa.sh` | Flujo de compra + `/admin/ia` (router apagado, alta de modelo con validación, simulador, auditoría) | Navegador y base real; pagos, correo e IA simulados |
| `npx tsx scripts/finanzas/simular.ts` | Rentabilidad 10/100/1 000/10 000 clientes | Simulación con supuestos no verificados |

**No cubierto (requiere acceso a OpenRouter y claves):** calidad real, latencia real, comportamiento real de los límites gratuitos, precios vigentes y políticas de datos de cada proveedor. Eso lo cubre `PRUEBA_REAL_OPENROUTER.md`.
