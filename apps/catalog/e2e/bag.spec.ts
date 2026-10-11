import { expect, test, type BrowserContext, type Page } from '@playwright/test';

const product = '/p/base-matte-glow';
const NUMBER = '573043478682';

/** Evita salir a internet: wa.me responde vacío y el registro del pedido no toca la base. */
async function stubExternal(context: BrowserContext) {
  await context.route('https://wa.me/**', (route) => route.fulfill({ status: 200, contentType: 'text/html', body: 'wa' }));
  const logged: unknown[] = [];
  await context.route('**/rest/v1/order_requests', async (route) => {
    logged.push(route.request().postDataJSON());
    await route.fulfill({ status: 201, body: '' });
  });
  return logged;
}

async function openTone(page: Page, tone: string) {
  await page.goto(`${product}?tono=${tone}`);
  await expect(page.getByRole('heading', { name: new RegExp(`Tono:\\s*${tone}`) })).toBeVisible();
}

test('elegir tono, agregar a la bolsa y enviar el pedido por WhatsApp', async ({ page, context }) => {
  const logged = await stubExternal(context);
  await openTone(page, '03');

  await page.getByRole('button', { name: /^Agregar a la bolsa ·/ }).click();
  await expect(page.getByRole('status')).toContainText('Agregado a la bolsa · 03 Beige cálido');
  await expect(page.getByText('1 producto en la bolsa')).toBeAttached();

  await page.getByRole('link', { name: 'Ver bolsa' }).click();
  await expect(page).toHaveURL(/\/bolsa$/);
  await expect(page.getByText('Base Matte Glow').first()).toBeVisible();
  await expect(page.getByText('03 Beige cálido').first()).toBeVisible();
  await expect(page.getByText('Total estimado', { exact: true })).toBeVisible();

  await page.getByLabel('Nombre').fill('Daniela');
  const [popup] = await Promise.all([
    context.waitForEvent('page'),
    page.getByRole('button', { name: /Enviar pedido por WhatsApp/ }).click(),
  ]);
  const url = new URL(popup.url());
  expect(url.origin + url.pathname).toBe(`https://wa.me/${NUMBER}`);
  const text = url.searchParams.get('text') ?? '';
  expect(text).toContain('Hola Leyma Shop, quiero hacer este pedido:');
  expect(text).toContain('• Base Matte Glow, tono 03 Beige cálido x1 — $45.000');
  expect(text).toContain('Total estimado: $45.000');
  expect(text).toContain('Nombre: Daniela');
  expect(text).toMatch(/Ref: LS-[A-Z2-9]{4}$/);

  await expect.poll(() => logged.length).toBe(1);
  expect(logged[0]).toMatchObject({ total: 45000, items: [{ quantity: 1, name: 'Base Matte Glow' }] });
});

test('la bolsa se conserva al recargar y la cantidad no pasa del stock', async ({ page }) => {
  await openTone(page, '04'); // 2 unidades
  const plus = page.getByRole('button', { name: 'Agregar uno' });
  await plus.click();
  await expect(plus).toBeDisabled();
  await page.getByRole('button', { name: /^Agregar a la bolsa ·/ }).click();
  await expect(page.getByText('2 productos en la bolsa')).toBeAttached();

  // Ya tiene todo el stock en la bolsa: no agrega más.
  await page.getByRole('button', { name: /^Agregar a la bolsa ·/ }).click();
  await expect(page.getByRole('status')).toContainText('Ya tienes todo el stock');

  await page.reload();
  await expect(page.getByText('2 productos en la bolsa')).toBeAttached();
});

test('"Pedir ya" arma el mensaje solo con este producto', async ({ page, context }) => {
  await stubExternal(context);
  await openTone(page, '03');
  await page.getByRole('button', { name: 'Agregar uno' }).click();
  const [popup] = await Promise.all([context.waitForEvent('page'), page.getByRole('button', { name: 'Pedir ya por WhatsApp' }).click()]);
  const text = new URL(popup.url()).searchParams.get('text') ?? '';
  expect(text).toContain('x2 — $90.000');
  expect(text).toContain('Total estimado: $90.000');
  // No toca la bolsa guardada.
  await expect(page.getByText('productos en la bolsa')).toHaveCount(0);
});

test('un producto agotado en la bolsa se marca y no entra al mensaje', async ({ page, context }) => {
  await stubExternal(context);
  await page.goto(`${product}?tono=05`);
  const out = await page.getByRole('radio', { name: /05 Moca/ }).getAttribute('data-vid');
  await page.goto(`${product}?tono=03`);
  const ok = await page.getByRole('radio', { name: '03 Beige cálido' }).getAttribute('data-vid');
  const line = (variantId: string, variantName: string, unitPrice: number) => ({
    variantId, productId: 'x', slug: 'base-matte-glow', name: 'Base Matte Glow', variantLabel: 'Tono', variantName,
    hex: '#8E5E41', image: null, art: 'bottle', unitPrice, quantity: 1,
  });
  await page.evaluate(
    ([a, b]) => localStorage.setItem('leyma:bag', JSON.stringify([a, b])),
    [line(out as string, '05 Moca', 45000), line(ok as string, '03 Beige cálido', 45000)],
  );
  await page.goto('/bolsa');
  await expect(page.getByRole('alert')).toContainText('05 Moca se agotó');
  await expect(page.getByText('Agotado', { exact: true })).toBeVisible();
  await expect(page.getByText('Total estimado', { exact: true }).locator('..').getByText('$45.000')).toBeVisible();
  const [popup] = await Promise.all([context.waitForEvent('page'), page.getByRole('button', { name: /Enviar pedido por WhatsApp/ }).click()]);
  const text = new URL(popup.url()).searchParams.get('text') ?? '';
  expect(text).toContain('03 Beige cálido');
  expect(text).not.toContain('05 Moca');
});

test('una bolsa corrupta en localStorage no rompe la página', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('leyma:bag', '{no es json'));
  await page.goto('/bolsa');
  await expect(page.getByRole('heading', { name: 'Tu bolsa está vacía' })).toBeVisible();
});

test('la bolsa vacía no tiene scroll horizontal en móvil ni escritorio', async ({ page }) => {
  for (const width of [360, 1440]) {
    await page.setViewportSize({ width, height: 800 });
    await page.goto('/bolsa');
    await expect(page.getByRole('heading', { name: 'Tu bolsa está vacía' })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }
});
