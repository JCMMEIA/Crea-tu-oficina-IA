# Cómo editar textos, imágenes, precios y promociones

- **Textos** (hero, beneficios, pasos, FAQ, avisos): `src/features/funnel/config/content.ts`.
- **Imágenes de la demo**: se regeneran con `scripts/landing/capturas.sh` (servidor en `PORT=3115`) y quedan en `public/demo/`.
- **Precio**: variable `PLAN_PRICE_MXN_<PLAN>` en el servidor (`configurar_ventas.sh`); debe coincidir con el precio de Stripe.
- **Promoción**: `FUNNEL_PROMO_TEXT`.
- **Testimonios**: solo reales y con permiso; se agregan a la lista de `Testimonials.tsx`; sin entradas, la sección no aparece.
- Después de cambiar: `npm run check` y `node scripts/e2e/landing_premium.cjs`.
