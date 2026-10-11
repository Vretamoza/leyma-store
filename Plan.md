# Leyma Shop — Planning del catálogo virtual

Oct 9, 2026 · @Valery

## Resumen

Leyma Shop es un catálogo de belleza mobile-first donde cada pregunta sobre un producto se responde en su ficha, y la compra se cierra por WhatsApp con un mensaje ya armado (producto, tono, cantidad, precio).

**Dentro del alcance (v1)**

- Catálogo público: inicio, listado por categoría, búsqueda, filtros y ficha de producto.
- Variantes por producto: tono (maquillaje), talla (ropa), color/tamaño (accesorios), cada una con sus propias fotos y stock.
- Bolsa de pedido sin pago, guardada en el navegador, que se envía completa por WhatsApp.
- Panel admin con login para crear productos, subir fotos, asignarlas a tonos y actualizar stock.
- SEO y vistas previas de enlace (Open Graph) para que un producto compartido por WhatsApp o Instagram se vea con foto y precio.

**Fuera del alcance (v1)**

- Pagos en línea, cuentas de cliente, cálculo automático de envío, multi-idioma.

## Datos y stack

Decisión: Astro (SSR en Vercel) con islas de React + Supabase (Postgres + Auth + Storage). Supabase es la fuente única de datos, así el admin puede vivir hoy dentro de Astro y mañana como app aparte sin migrar nada.

| Opción                      | Admin                                      | Fotos                       | Stock en tiempo real | Costo inicial | Cuándo elegirla                                                        |
| --------------------------- | ------------------------------------------ | --------------------------- | -------------------- | ------------- | ---------------------------------------------------------------------- |
| **Supabase** (recomendada)  | Lo construyes tú (control total del flujo) | Supabase Storage            | Sí                   | Gratis        | Quieres un admin a la medida y crecer luego a pedidos, reportes, etc.  |
| Sanity (headless CMS)       | Viene listo (Sanity Studio)                | CDN con recortes incluido   | Sí                   | Gratis        | Quieres cero desarrollo de admin y aceptas su interfaz genérica        |
| Google Sheets como DB       | La hoja misma                              | Externas (Drive/Cloudinary) | Con retraso          | Gratis        | Prototipo de una semana; se rompe fácil con variantes y fotos por tono |
| JSON en el repo + Decap CMS | Basado en Git                              | En el repo                  | Requiere rebuild     | Gratis        | Catálogo casi estático, pocos cambios de stock                         |

**Stack propuesto**

- **Astro + TypeScript + Tailwind**, adaptador `@astrojs/vercel` en modo SSR. HTML renderizado en servidor: el catálogo carga rápido en móvil y las vistas previas de WhatsApp funcionan.
- **Islas de React** solo para lo interactivo: galería + selector de tono, bolsa, filtros y búsqueda. `client:visible` o `client:idle` según el caso.
- **Estado de la bolsa** con `nanostores` (+ `@nanostores/persistent` para `localStorage`), compartido entre el contador del header y la ficha.
- **View Transitions** de Astro para la navegación listado → ficha.
- **Caché**: páginas públicas con `Cache-Control: s-maxage=300, stale-while-revalidate`. El stock y el precio de la ficha los consulta en vivo la isla del selector, así un cambio de stock se ve al instante aunque el HTML esté en caché (y esas consultas mantienen activo el proyecto de Supabase).
- **Supabase**: RLS (lectura pública, escritura solo admin), Auth con email/contraseña sin registro público, bucket `product-images`; cliente con `@supabase/ssr` y cookies en el middleware de Astro.
- **Admin v1** dentro del mismo proyecto en `/admin`: rutas con `prerender = false`, middleware de auth y una isla React por pantalla. Las escrituras pasan por Astro Actions.
- **Validación**: Zod compartido entre formularios del admin y Actions.
- **Pruebas**: Vitest para lógica (mensaje de WhatsApp, stock), Playwright para flujos (elegir tono → agregar a la bolsa → abrir WhatsApp).

**Preparado para separar el admin**

Si el admin crece (pedidos, reportes, varias usuarias), se saca a una app propia en Next o Nuxt en `admin.leymashop.com` sin tocar el catálogo. Para que el paso sea fácil desde ahora:

- Monorepo con pnpm workspaces: `apps/catalog` (Astro) y `packages/core` con tipos generados de Supabase, esquemas Zod, formato de precios y generador del mensaje de WhatsApp.
- El admin no importa nada de las páginas del catálogo; solo usa `packages/core` y Supabase.
- La seguridad vive en RLS, no en el código del admin, así cualquier app nueva hereda las mismas reglas.
- Como el stock se lee en vivo, la app de admin separada no necesita avisarle al catálogo; para cambios de fotos o textos basta la expiración corta de la caché.

## Modelo de datos

Todo producto tiene al menos una variante: el stock y las fotos viven en la variante, así maquillaje con tonos, ropa con tallas y un producto único usan la misma lógica.

| Tabla              | Campos clave                                                                                                                                                                                                | Notas                                                                                         |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `categories`       | id, name, slug, parent_id, sort_order, is_active                                                                                                                                                            | Maquillaje, Ropa, Kits, Accesorios faciales (pepitas, cristales), etc.                        |
| `products`         | id, name, slug, short_description, description, category_id, base_price, compare_at_price, variant_label (`Tono` / `Talla` / `Color` / null), details (jsonb), tags\[\], is_active, is_featured, created_at | `details` guarda acabado, tipo de piel, contenido (ml/g), ingredientes, modo de uso, duración |
| `product_variants` | id, product_id, name ("03 Beige cálido"), code, swatch_hex, swatch_image_path, undertone (`frío`/`cálido`/`neutro`), price_override, stock, sort_order, is_active                                           | Producto sin variantes = 1 variante "Única" oculta en la UI                                   |
| `product_images`   | id, product_id, variant_id (nullable), path, alt, sort_order                                                                                                                                                | `variant_id` null = foto general; con valor = foto de ese tono                                |
| `kit_items`        | kit_product_id, item_product_id, item_variant_id, quantity                                                                                                                                                  | Muestra "Qué incluye" en los kits con enlace a cada producto                                  |
| `faqs`             | id, question, answer, product_id (nullable), sort_order                                                                                                                                                     | Null = FAQ global (envíos, pagos, cambios)                                                    |
| `store_settings`   | whatsapp_number, store_name, shipping_info, payment_methods, low_stock_threshold                                                                                                                            | Una sola fila, editable desde el admin                                                        |
| `admins`           | user_id (FK auth.users)                                                                                                                                                                                     | Lista blanca de quién puede escribir                                                          |

**Reglas de stock en la UI**

- `stock = 0` → "Agotado"; el tono se ve tachado pero sigue seleccionable para ver sus fotos, y el botón cambia a "Preguntar por disponibilidad" (WhatsApp prellenado).
- `stock ≤ low_stock_threshold` (por defecto 3) → "Últimas unidades".
- La cantidad máxima en la bolsa se limita al stock disponible.

**Seguridad (RLS)**

- `select` público solo en filas con `is_active = true`.
- `insert` / `update` / `delete` solo si `auth.uid()` existe en `admins`.
- Storage: lectura pública del bucket; escritura con la misma regla de admin.
- Migraciones SQL versionadas en `supabase/migrations` y tipos generados con `supabase gen types typescript`.

## Experiencia pública

La ficha de producto es la pieza central: la clienta elige tono, ve las fotos de ese tono, entiende disponibilidad y precio, y pide sin salir de la página.

**Páginas**

| Ruta             | Contenido                                                                                               |
| ---------------- | ------------------------------------------------------------------------------------------------------- |
| `/`              | Hero breve, categorías en tarjetas, novedades, destacados, bloque "Cómo pedir" (3 pasos)                |
| `/c/[categoria]` | Grilla de productos, filtros (subcategoría, precio, disponibilidad, subtono), orden (novedades, precio) |
| `/p/[slug]`      | Ficha de producto (detalle abajo)                                                                       |
| `/buscar?q=`     | Búsqueda por nombre, categoría y tags                                                                   |
| `/bolsa`         | Drawer o página con la lista de pedido y botón "Enviar pedido por WhatsApp"                             |
| `/info`          | Envíos, métodos de pago, cambios y FAQs globales                                                        |

**Ficha de producto, de arriba a abajo**

1. Galería: foto principal + miniaturas; muestra primero las fotos del tono elegido y luego las generales. Swipe en móvil, zoom al tocar.
2. Nombre, precio (formato COP con `Intl.NumberFormat('es-CO')`), precio anterior tachado si aplica.
3. Selector de variante: círculos de color (swatch) con el nombre del tono al seleccionar; filtro rápido por subtono si hay más de 8 tonos. El tono va en la URL (`?tono=03`) para compartirlo exacto.
4. Estado de stock del tono: Disponible / Últimas unidades / Agotado.
5. Cantidad + "Agregar a la bolsa" + "Pedir ya por WhatsApp". En móvil, barra fija abajo con precio y botón.
6. Acordeones: Descripción · Detalles (acabado, tipo de piel, contenido) · Modo de uso · Ingredientes · Qué incluye (kits) · Guía de tallas (ropa).
7. Envíos y pagos (resumen desde `store_settings`) y FAQs del producto.
8. Productos relacionados de la misma categoría.

**Flujo de WhatsApp**

- Enlace `https://wa.me/57XXXXXXXXXX?text=<mensaje codificado>`, número tomado de `store_settings`.
- Mensaje generado por una función pura y testeada, por ejemplo:

```text
Hola Leyma Shop, quiero hacer este pedido:

• Base Matte Glow, tono 03 Beige cálido x1 — $45.000
• Kit Pepitas Doradas x2 — $36.000

Total estimado: $81.000
Ref: LS-7K2Q
```

- La bolsa se guarda en `localStorage` y se valida contra el stock actual al abrirla (avisa si algo se agotó).
- Código de referencia corto para que puedan ubicar el pedido en el chat; opcionalmente se registra en una tabla `order_requests` para saber qué se pide más.

## Panel admin

El admin vive en `/admin`, protegido por middleware que exige sesión de Supabase y pertenencia a `admins`; está pensado para usarse desde el celular.

| Pantalla          | Qué permite                                                                                                                                     |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Productos         | Lista con buscador, filtro por categoría y estado; activar/desactivar y duplicar en un toque                                                    |
| Editar producto   | Datos generales, detalles, categoría, precio, destacado; variantes en tabla editable (nombre, código, color, subtono, precio propio, stock)     |
| Fotos             | Subida múltiple, compresión en el navegador a WebP (\~1600 px, < 300 KB), arrastrar para ordenar, asignar cada foto a un tono o dejarla general |
| Stock rápido      | Vista única de todas las variantes con botones +/− y edición inline; resalta agotados y bajo stock                                              |
| Categorías y FAQs | CRUD simple con orden                                                                                                                           |
| Ajustes           | Número de WhatsApp, info de envíos y pagos, umbral de bajo stock                                                                                |

**Flujo típico para cargar un labial con 6 tonos**

1. Crear producto con `variant_label = Tono`.
2. Agregar 6 variantes con color de muestra y stock.
3. Subir fotos y arrastrarlas a cada tono.
4. Guardar: se revalida la caché y el producto aparece publicado.

## Dirección visual

Girly y classy: base clara y cálida, rosa empolvado como acento, mucho espacio en blanco y que las fotos de producto sean las protagonistas.

| Token       | Valor sugerido         | Uso                                           |
| ----------- | ---------------------- | --------------------------------------------- |
| `--bg`      | `#FBF7F4` (crema)      | Fondo general                                 |
| `--surface` | `#FFFFFF`              | Tarjetas, drawers                             |
| `--blush`   | `#F2D7D9`              | Fondos suaves, chips, hover                   |
| `--rose`    | `#B5677A` (rosa malva) | Botones principales, enlaces, tono activo     |
| `--ink`     | `#2B2427`              | Texto principal                               |
| `--muted`   | `#8A7F83`              | Texto secundario, bordes                      |
| `--gold`    | `#C9A66B`              | Detalles mínimos (badge "Nuevo", separadores) |

**Tipografía**: serif elegante para títulos (Cormorant Garamond o Playfair Display) y sans limpia para texto e interfaz (DM Sans o Manrope). Precios y botones siempre en la sans.

**Componentes**: bordes redondeados moderados (12 px tarjetas, botones en píldora), bordes de 1 px en lugar de sombras pesadas, fotos con proporción fija 4:5 sobre fondo neutro.

**Animaciones (solo donde ayudan)**

- Cambio de tono: crossfade de la foto en \~200 ms y anillo del swatch activo.
- Drawers de bolsa y filtros: deslizamiento de \~250 ms.
- "Agregado a la bolsa": contador de la bolsa con un pequeño rebote, sin modales.
- Skeletons al cargar imágenes en lugar de spinners.
- Sin carruseles automáticos ni parallax; todo se desactiva con `prefers-reduced-motion`.

## Fases de desarrollo

Siete fases en orden; pásale al agente una fase a la vez con su criterio de "listo", y no avances hasta que se cumpla.

1. **Setup**: monorepo pnpm (`apps/catalog` + `packages/core`), Astro + adaptador Vercel + React + TS estricto + Tailwind con los tokens de color y fuentes, ESLint/Prettier, Vitest, Playwright, cliente de Supabase (server y browser), variables de entorno.
   - Listo cuando: `pnpm dev`, `pnpm test` y `pnpm build` pasan y hay una página de prueba con los tokens aplicados.
2. **Esquema y seguridad**: migraciones de todas las tablas, políticas RLS, bucket de Storage, tipos generados y un seed con 3 categorías y 6 productos (al menos uno con 5 tonos y uno agotado).
   - Listo cuando: un usuario anónimo puede leer productos activos y no puede escribir; un admin sí.
3. **Catálogo público**: layout (header con bolsa, footer), inicio, listado por categoría con filtros y orden, búsqueda.
   - Listo cuando: navegación completa en 360 px y 1440 px sin scroll horizontal, y Lighthouse móvil ≥ 90 en rendimiento.
4. **Ficha de producto**: galería y selector de tono como una isla React sincronizada con la URL y con stock en vivo, estados de stock, acordeones, FAQs, relacionados.
   - Listo cuando: cambiar de tono cambia fotos, nombre y stock, y el enlace con `?tono=` abre el tono correcto.
5. **Bolsa y WhatsApp**: bolsa con nanostores persistida en `localStorage`, validación contra stock, generador de mensaje, botón "Pedir ya" y "Enviar pedido".
   - Listo cuando: los tests unitarios del mensaje pasan y el e2e elegir tono → agregar → abrir `wa.me` funciona.
6. **Admin**: login, middleware de Astro, Astro Actions, CRUD de productos y variantes, subida y asignación de fotos, stock rápido, ajustes, todo usando solo `packages/core` y Supabase.
   - Listo cuando: se carga un producto con 6 tonos desde el celular y aparece publicado en menos de 1 minuto.
7. **Pulido y lanzamiento**: metadatos y Open Graph por producto, sitemap, accesibilidad (contraste AA, foco visible, labels), `prefers-reduced-motion`, analítica liviana, deploy en Vercel con dominio.
   - Listo cuando: un enlace de producto pegado en WhatsApp muestra foto, nombre y precio.

**Convenciones para el agente**: componentes `.astro` por defecto e islas React solo para lo interactivo, con la directiva `client:*` más tardía posible; lógica de negocio en `packages/core`, nunca en las páginas; una carpeta por feature (`catalog`, `product`, `bag`, `admin`); sin dependencias de UI pesadas; textos de la interfaz en español.

## Decisiones abiertas y riesgos

**Por decidir antes de la fase 2**

- [ ] Número de WhatsApp de la tienda y si habrá más de uno (por ciudad o asesora).
- [ ] ¿Precios visibles para todos o "consultar precio" en algunos productos?
- [ ] Zonas y costos de envío a mostrar en la ficha.
- [ ] ¿Se usa subtono (frío/cálido/neutro) en todos los maquillajes o solo en bases y correctores?
- [ ] Quién toma las fotos por tono y con qué formato (idealmente 4:5, mismo fondo y luz).

**Riesgos**

- **Pausa del plan gratuito de Supabase**: los proyectos gratuitos se pausan tras un periodo sin actividad; con caché agresiva la DB puede recibir pocas visitas. Mitigación: un cron semanal (Vercel Cron) que haga una consulta liviana, o pasar a plan pago cuando haya tráfico. Verifica la política vigente en la documentación de Supabase.
- **Peso de las imágenes**: es lo que más consume almacenamiento y transferencia. Mitigación: compresión a WebP al subir y `astro:assets` con tamaños responsivos.
- **Stock desactualizado**: como la venta ocurre en WhatsApp, el stock solo baja si alguien lo ajusta. Mitigación: la vista de stock rápido y, más adelante, marcar `order_requests` como confirmadas para descontar stock automáticamente.
