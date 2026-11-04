# Credenciales necesarias y presupuesto pequeño

**Regla:** ninguna clave se pega en el chat, en GitHub, en capturas ni en registros. Se cargan **solo en el servidor** con `deploy/convivencia/configurar_openrouter.sh`, que las pide sin mostrarlas.

## Credenciales
| Credencial | Para qué | Quién la crea | Dónde vive | ¿Ya existe? |
|---|---|---|---|---|
| **`OPENROUTER_API_KEY`** | Llamar a modelos por OpenRouter | **Tú**, en tu cuenta de OpenRouter (Keys → Create Key). Usa una clave **solo para esta prueba** | `/etc/crea-oficina/env` (permiso restringido) | **No** |
| `ANTHROPIC_API_KEY` | Modelo avanzado directo (alterno) y verificación actual de la IA | Tú (ya está) | `/etc/crea-oficina/env` | Probablemente sí (confírmalo) |
| Cuenta de OpenRouter con **saldo pequeño** | Pagar la prueba | Tú | OpenRouter | No |
**No se necesitan** claves de Stripe, Resend ni OpenClaw para esta prueba, ni contraseñas de ninguna cuenta.

## Presupuesto en capas (cada una detiene el gasto por sí sola)
1. **Saldo de la cuenta de OpenRouter: US$5** (o lo que decidas; el máximo absoluto que se puede gastar). **Sin recarga automática** (revisa que esté desactivada).
2. **Límite de crédito de la propia clave** (si OpenRouter lo ofrece al crearla): US$2. *(No pude verificar la opción; confírmalo en la pantalla de creación.)*
3. **Plan de prueba de la plataforma**: `prueba` = 50 000 créditos y US$0.50/mes por cuenta, tope por tarea US$0.05 (ya es el valor por defecto).
4. **Reglas del router** (`/admin/ia`): tope por llamada **US$0.05**, intentos máximos 3, gratuito→pago **desactivado**, gratuitos **sin** datos internos.
5. **Scripts**: `ia:humo --max-usd 0.01` por modelo y `ia:evaluar --max-usd 1` (se detiene solo).
6. **Y lo más importante:** `AI_ROUTER=off` en producción: ningún cliente consume nada por este camino.
Total máximo realista de la prueba: **≈ US$1.5**; techo duro por saldo: **US$5**.

## Rotación y revocación
Si sospechas que la clave se expuso: revócala en OpenRouter (Keys → Delete), crea otra y vuelve a correr el script. La clave vieja deja de servir de inmediato. El respaldo del archivo de configuración queda en `/var/backups/crea-oficina/` (permiso 600): bórralo si contiene una clave revocada que ya no quieras conservar.
