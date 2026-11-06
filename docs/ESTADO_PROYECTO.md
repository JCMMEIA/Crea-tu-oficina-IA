# Crea tu Oficina IA — estado del proyecto (documento único)

Pensado para pegar al inicio de una conversación con Claude chat. Una sola fuente de verdad: actualízalo aquí y vuelve a pegarlo. Sin secretos ni correos.
Última actualización: 2026-11-06.

## 1. Contexto
- **Qué es:** SaaS en https://app.mmeia.tech. Cada cliente tiene una «oficina» con empleados de IA (vista 2D y 3D). Corre en un VPS Ubuntu de Hostinger que convive con OpenClaw (no tocar). Repositorio: JCMMEIA/Crea-tu-oficina-IA.
- **Quién decide:** el dueño, persona no técnica. Nada se fusiona ni se despliega sin su autorización expresa. En el VPS él ejecuta los comandos que se le dan; Claude no tiene acceso remoto. La terminal web de Hostinger pierde los saltos de línea al pegar: los comandos deben ser de UNA línea o un script que se instale con una línea (gzip+base64 con huella SHA-256).
- **Historia clave:** una instalación anterior mal diseñada causó un HTTP 502. Por eso el instalador v2 compila en una carpeta aparte, intercambia de forma atómica y revierte sin recompilar. `actualizar_convivencia.sh` tiene el mismo defecto: no usarlo.
- **Equipo local (Windows):** el disco C: está lleno; compilar y probar en `D:\crea-verif\repo`. Windows causa falsos fallos (finales de línea CRLF, `npx` sin shell, pruebas que exigen root/Linux).

## 2. Router de IA (PR #7) — ya en producción, apagado
- Rama `claude/humo-sonnet-seguro`, commit `8f84f20` instalado; `main` = `a4c9e67` (PR #7 sin fusionar, en borrador).
- `AI_ROUTER=off` (con `on` es global y sin vuelta a Anthropic directo: sin modelos activos, todas las oficinas fallan; solo en ventanas cortas con regla de vuelta a `off`).
- Modelos en `/admin/ia`: Haiku 5.5 activo y verificado (economy, nivel B, peso 1, contexto 100 000); Sonnet 5.5 inactivo y verificado (premium, nivel C, peso 5). Proveedores aprobados solo Amazon Bedrock us-east-1 y eu-west-1, retención cero.
- Privacidad en OpenRouter: «Solo ZDR», entrenamiento apagado, claves con límite acumulado, recarga automática apagada. Pendiente menor: confirmar a mano el interruptor de entrenamiento.
- Topes: US$0.05 por llamada, 2 intentos; plan Prueba US$0.05 por tarea y US$0.50 al mes; saldo de OpenRouter US$5.
- **Prueba de humo (2026-11-05):** una llamada real a Sonnet 5.5, costo ≈ US$0.00017, respondió «hola».
- **Hallazgos de auditoría:** tareas de nivel C necesitan Sonnet en nivel C; «Crear tarea» ejecuta de inmediato, así que con el router apagado y clave de Anthropic iría directo a Anthropic (facturable): no crear tareas fuera de la ventana de prueba.
- **Faltantes para vender:** Stripe en modo prueba, Resend (SPF/DKIM de mmeia.tech), `configurar_ventas.sh`, compra con tarjeta de prueba; no existen avisos de cuota por correo, reembolsos automáticos ni términos legales.

## 3. Ventana de prueba con Lucía (2026-11-06)
- Oficina interna de prueba creada por el dueño: «OFICINA DEMO MENTES MAESTRAS», plan Prueba, empleada Lucía Fernández (Guionista de storytelling, sin conexiones externas).
- Script `prueba_lucia.sh` (fuera del repositorio, se instala con una línea con huella SHA-256). Modos: `verificar` (solo lectura), `iniciar` (pide escribir `AUTORIZO UNA TAREA`), `restaurar`.
- `verificar` en el VPS real: **17 OK, 0 FALLA**; router apagado en disco y en memoria, un solo modelo activo, OpenClaw sano.
- El dueño autorizó expresamente `iniciar` (una sola tarea). Pendiente: el resultado real de esa ventana, que lo gestiona otra sesión. **No tocar producción desde aquí.**

## 4. Personaliza tu oficina (PR #8) — preparado, sin desplegar
- Función: estilo (7) × espacio (6) + 5 interruptores; «Diseño personalizado» con reglas locales de palabras clave (sin IA ni costo). Dato nuevo: `agencies.office_design jsonb` (`ADD COLUMN IF NOT EXISTS`, aditiva; `agencies.brand` no se toca). Al revertir NO se hace `DROP COLUMN`.
- Ramas publicadas:
  - `claude/personaliza-tu-oficina` (PR #8, contra `main`), commit `703a407`.
  - `claude/personaliza-sobre-router` (PR #7 + PR #8, la que instala `instalar_personaliza.sh` en el VPS), commit `e1eb312`.
  - Orden recomendado para `main`: primero PR #7, luego PR #8 (después de rebasar sobre el nuevo `main`).
- Plan acordado: el PR #8 se instala **después del lanzamiento**, en su propia ventana, nunca la misma semana que Stripe o Resend (un cambio a la vez).
- Verificado: 27 de 29 archivos de prueba pasan en la rama combinada (21/21 de Personaliza, hidratación sin errores, JS ≈ 471–505 KB y ≈ 1,4 MB en la página 3D). No verificadas por Windows: `prueba_humo` e `instalar_real_historia` (del PR #7).
- **Veredicto: NO ESTÁ LISTO PARA DESPLEGAR.** Falta ver el instalador nuevo ejecutarse en Linux, probar la migración con PostgreSQL real (solo PGlite hasta ahora), confirmar con `--verificar` la versión realmente instalada y la autorización expresa del dueño.
- Procedimiento: `docs/personaliza/INSTALAR_Y_REVERTIR.md` (`--verificar` → simulacro → `--aplicar` → revisión a mano; `--revertir` restaura `.next` y el código sin recompilar y no toca la base de datos). Antes de la ventana real: instantánea del VPS desde el panel de Hostinger, si el plan la incluye.

## 5. Pruebas en Linux (GitHub Actions) — resultado 2026-11-06
- Rama `claude/ci-linux` (commit `4add681`), sin secretos ni llamadas de IA de pago. **Tres trabajos, todos en verde:** https://github.com/JCMMEIA/Crea-tu-oficina-IA/actions/runs/42308352744
  1. Rama combinada (PR #7 + PR #8): tipos, secretos y suite completa en Linux, más `instalar_personaliza.sh` aplicado y revertido sobre la historia real (8f84f20 → punta de la rama combinada), como root y con servicios simulados. El flujo exige que esas pruebas se ejecuten de verdad (no omitidas).
  2. PR #7: `prueba_humo` (servidor local, clave ficticia) e `instalar_real_historia` pasan en Linux. Los bloqueos de Windows quedan resueltos.
  3. PostgreSQL 16 real: `schema.sql` se aplica dos veces sin error y `agencies.office_design` existe como jsonb. Cubre solo el esquema, no la aplicación completa contra Postgres.
- Sigue sin cubrirse: un VPS real (systemd, Hostinger, OpenClaw), la compilación real (`next build`) dentro del instalador (se simuló) y la versión instalada en producción (solo `--verificar` en el VPS).
- Veredicto de Personaliza: sigue **NO LISTO** hasta confirmar con `--verificar` en el VPS y tener autorización del dueño; el riesgo de que el instalador falle en Linux baja de forma importante.

## 6. Reglas que no se rompen
- Sin fusionar ni desplegar sin autorización expresa; sin reiniciar servicios, activar `AI_ROUTER`, llamadas de IA de pago, ni tocar Stripe, Resend, claves, `.data` de producción u OpenClaw. Nunca imprimir ni pedir secretos.

## 7. Preguntas útiles para pensar con Claude chat
- ¿Qué más conviene verificar antes de la ventana de instalación sin acceso al VPS?
- ¿Cómo reducir el riesgo de que un instalador falle en Linux?
- ¿En qué orden y cuándo fusionar los PR #7 y #8?
