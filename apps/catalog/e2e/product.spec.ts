import { expect, test } from '@playwright/test';

const url = '/p/base-matte-glow';

test('el enlace con ?tono= abre el tono correcto', async ({ page }) => {
  await page.goto(`${url}?tono=03`);
  await expect(page.getByRole('heading', { name: /Tono:\s*03 Beige cálido/ })).toBeVisible();
  await expect(page.getByRole('radio', { name: '03 Beige cálido' })).toBeChecked();
  await expect(page.getByText('Disponible · listo para enviar')).toBeVisible();
});

test('cambiar de tono actualiza nombre, stock y URL', async ({ page }) => {
  await page.goto(url);
  await page.getByRole('radio', { name: '04 Canela' }).click();
  await expect(page.getByRole('heading', { name: /Tono:\s*04 Canela/ })).toBeVisible();
  await expect(page.getByText('¡Últimas 2 unidades en este tono!')).toBeVisible();
  await expect(page).toHaveURL(/tono=04/);

  await page.getByRole('radio', { name: /05 Moca, agotado/ }).click();
  await expect(page.getByText('Agotado en este tono').first()).toBeVisible();
  await expect(page).toHaveURL(/tono=05/);
});

test('un tono agotado se puede abrir y sugiere uno disponible', async ({ page }) => {
  await page.goto(`${url}?tono=05`);
  await expect(page.getByText('Agotado en este tono').first()).toBeVisible();
  await page.getByRole('button', { name: 'Ver un tono parecido disponible' }).click();
  await expect(page.getByText('Agotado en este tono')).toHaveCount(0);
});

test('el stock en vivo pisa el del HTML en caché', async ({ page }) => {
  await page.route('**/rest/v1/product_variants*', async (route) => {
    const response = await route.fetch();
    const rows = (await response.json()) as { id: string; stock: number; price_override: number | null }[];
    await route.fulfill({
      status: 200,
      headers: { ...response.headers(), 'content-type': 'application/json' },
      body: JSON.stringify(rows.map((r) => ({ ...r, stock: 0 }))),
    });
  });
  await page.goto(`${url}?tono=03`);
  await expect(page.getByText('Agotado en este tono').first()).toBeVisible();
});

test('los acordeones y las preguntas frecuentes se abren sin JavaScript', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto(url);
  await expect(page.getByRole('heading', { name: 'Base Matte Glow' })).toBeVisible();
  const faq = page.locator('details', { hasText: '¿Cómo hago mi pedido?' });
  await faq.locator('summary').click();
  await expect(faq.getByText('Agrega los productos a la bolsa')).toBeVisible();
  await context.close();
});

test('un producto sin variantes no muestra selector y 404 para uno inexistente', async ({ page }) => {
  await page.goto('/p/kit-pepitas-doradas');
  await expect(page.getByRole('radiogroup')).toHaveCount(0);
  const res = await page.goto('/p/no-existe');
  expect(res?.status()).toBe(404);
});

for (const width of [360, 1440]) {
  test(`la ficha no tiene scroll horizontal a ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`${url}?tono=03`);
    const { scroll, inner } = await page.evaluate(() => ({
      scroll: document.documentElement.scrollWidth,
      inner: window.innerWidth,
    }));
    expect(scroll).toBeLessThanOrEqual(inner);
  });
}
