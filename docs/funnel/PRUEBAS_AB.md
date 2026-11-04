# Pruebas A/B (más adelante)

Hoy **no hay** motor A/B. Camino recomendado sin duplicar rutas:
1. Elegir UNA variable (p. ej. título del hero) y mover las dos versiones a `config/content.ts` como `HERO_A` / `HERO_B`.
2. Decidir la variante en el servidor con un parámetro (`?v=b`) que viene del anuncio (`utm_content`), así cada anuncio ve una versión fija y no hace falta cookie.
3. La variante queda en `utm_content`, que ya se guarda con la visita y con el pedido; `/admin/conversion` permite compararlas.
4. No concluir con menos de ~100 clics por variante ni durante menos de una semana completa.
