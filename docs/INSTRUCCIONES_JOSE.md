# Lo que tienes que hacer tú — paso a paso

Todo lo demás ya está preparado y probado. Estos pasos son tuyos porque implican **tu dinero, tus cuentas o tus claves**. Nunca me pegues claves en el chat.

## Parte 1 — Poner la plataforma en internet (privada)
1. **Elige un nombre de dirección** (por ejemplo `app.tudominio.com`). Si no tienes dominio, cómpralo donde prefieras (cuesta dinero, decides tú).
2. **Contrata el servidor en Hostinger**: un **VPS**, el plan **KVM 2** o similar. Al elegir sistema, escoge **«Ubuntu 24.04» limpio** (sin «OpenLiteSpeed» ni otras aplicaciones preinstaladas, porque estorban). *(Precio: míralo tú en Hostinger; yo no pude confirmarlo.)*
3. **Apunta tu dirección al servidor**: en el panel de tu dominio crea un registro tipo **A** con el nombre elegido y la **IP** que te muestra Hostinger. Espera unos minutos.
4. **Abre la terminal del servidor** (en Hostinger, tu VPS → «Terminal» o conéctate por SSH). Pega esta línea y pulsa Enter:
   ```
   curl -fsSL https://raw.githubusercontent.com/JCMMEIA/crea-tu-oficina-ia/main/deploy/instalar.sh -o instalar.sh && bash instalar.sh
   ```
5. Te hará 5 preguntas (tu dirección, tu correo, correos autorizados, correo de contacto). Contesta. Tarda unos 10 minutos.
6. Al final debe decir **«✅ Listo»**. Abre tu dirección en el navegador: verás la página.
7. **Crea tu cuenta** en `/registro` con el **mismo correo de operador**. Luego entra a `tu-dirección/admin`: es tu panel de prospectos.
8. **Revisa el respaldo**: en la terminal escribe `cto-respaldo`. Debe decir «respaldo: …». Además, activa en Hostinger las copias («snapshots/backups») del VPS: así hay copia fuera del servidor.

> Aviso honesto: este instalador **no se pudo probar en un servidor real de Hostinger** desde aquí; sí se probó la base de datos real (PostgreSQL), la aplicación compilada, las cabeceras de seguridad, el respaldo y la restauración. Si algo falla en el paso 5, copia el mensaje de error y mándamelo (no tiene claves).

## Parte 2 — Probar a Claude de verdad (cuesta centavos)
1. Entra a **console.anthropic.com**, crea una cuenta y **carga un saldo pequeño** (por ejemplo lo mínimo que te permita). 
2. En la configuración de gasto, **pon un límite mensual bajo**. Ese límite es el que de verdad te protege.
3. Crea una **clave de API** y cópiala (se muestra una sola vez).
4. En la página de precios de Anthropic busca el precio del modelo `claude-sonnet-5-5`: necesito dos números, **dólares por millón de palabras-pieza («tokens») de entrada y de salida**.
5. En el servidor escribe `nano /etc/cto/env` y agrega al final estas 3 líneas (con tus datos) y guarda (Ctrl+O, Enter, Ctrl+X):
   ```
   ANTHROPIC_API_KEY=tu-clave
   MODEL_INPUT_USD_PER_MTOK=numero-de-entrada
   MODEL_OUTPUT_USD_PER_MTOK=numero-de-salida
   ```
6. Escribe: `systemctl restart cto`
7. Escribe: `cd /opt/cto && sudo -u cto bash -c 'set -a; . /etc/cto/env; set +a; npm run pilot:claude'`
8. Si todo sale bien dirá **«✓ CLAUDE REAL …»** y creará `docs/pilot/evidencia/claude_real.json` (no contiene claves). Avísame y lo guardo en GitHub. Si dice «✗», mándame el texto.

## Parte 3 — Pasarela de pagos (solo preparar, sin cobrar)
1. Decide los **precios en pesos** de cada plan (Emprendedor, Agencia, Avanzado).
2. Crea una cuenta en **Stripe México** (stripe.com/mx) con los datos de tu negocio. Mantén el **«modo de pruebas»** activado.
3. En Stripe, sección Desarrolladores: copia tu **clave secreta de pruebas** (empieza con `sk_test_`).
4. Cuando quieras hacer la prueba conmigo, en `/etc/cto/env` agrega: `STRIPE_SECRET_KEY=…`, `STRIPE_WEBHOOK_SECRET=…` (Stripe te la da al crear el «webhook» apuntando a `https://tu-dirección/api/billing/webhook`), `PLAN_PRICE_MXN_EMPRENDEDOR=…`, `PLAN_PRICE_MXN_AGENCIA=…`, `PLAN_PRICE_MXN_AVANZADO=…` y **al final** `BILLING_ENABLED=true`. Con tarjetas de prueba de Stripe no se cobra dinero real.
5. **No pongas claves reales (`sk_live_`)**: el sistema las rechaza a propósito.

## Parte 4 — Antes de recibir visitas reales
- [ ] Pide a un **abogado** que revise la política de privacidad y redacte los **términos del servicio** (hoy no existen). 
- [ ] Decide quién responde el correo de contacto y **revisa `/admin` todos los días**: **nadie recibe aviso cuando llega un prospecto** (no hay correo conectado).
- [ ] Prueba tú mismo: pide una demostración con otro correo, mira que aparezca en `/admin/prospectos`.
- [ ] Confirma que tu dominio muestra el candado (HTTPS).

## Lo que NO debes hacer todavía
Publicar anuncios, activar cobros reales (`sk_live_`), ni abrir el registro a todo el mundo.
