import { expect, test } from '@playwright/test';

const routes = ['/', '/c/maquillaje', '/c/kits', '/buscar?q=base'];
const viewports = [
  { name: '360', width: 360, height: 780 },
  { name: '1440', width: 1440, height: 900 },
];

for (const vp of viewports) {
  for (const route of routes) {
    test(`sin scroll horizontal en ${route} a ${vp.name}px`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto(route);
      const { scroll, inner } = await page.evaluate(() => ({
        scroll: document.documentElement.scrollWidth,
        inner: window.innerWidth,
      }));
      expect(scroll).toBeLessThanOrEqual(inner);
    });
  }
}

test('los filtros del listado funcionan sin JavaScript', async ({ page }) => {
  await page.goto('/c/maquillaje?sub=labiales');
  await expect(page.getByText('1 de 3 productos')).toBeVisible();
});

test('el drawer de filtros abre y cierra en móvil', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await page.goto('/c/maquillaje');
  await page.getByRole('button', { name: /^Filtrar/ }).click();
  const dialog = page.getByRole('dialog', { name: 'Filtrar y ordenar' });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Cerrar' }).click();
  await expect(dialog).toBeHidden();
});
