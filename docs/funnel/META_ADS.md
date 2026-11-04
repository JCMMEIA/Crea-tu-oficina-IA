# Meta Ads

**Estado real:** preparado, no probado contra Meta (no hay píxel ni cuenta conectada).
- Atribución: `utm_*` y `fbclid` se leen en la landing y viajan hasta el pedido (`orders.source`).
- Píxel: `NEXT_PUBLIC_META_PIXEL_ID` vacío ⇒ no se carga nada. Con ID: solo tras aceptar el aviso de cookies.
- Nombrar campañas: `utm_source=meta&utm_medium=paid&utm_campaign=<nombre>&utm_content=<anuncio>`.
- Gasto: se registra a mano en `/admin/conversion` (`addAdSpend`) para calcular CAC; no se importa de Meta.
- Pendiente (requiere token de Meta y autorización de José): API de Conversiones (servidor), deduplicación y verificación de dominio.
