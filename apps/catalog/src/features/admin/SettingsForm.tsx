import { useState } from 'react';
import { actions } from 'astro:actions';
import { Button, Card, Field, input, NoticeBar, run, useNotice } from './ui';

export default function SettingsForm({ settings }: { settings: Record<string, any> }) {
  const [s, setS] = useState({
    store_name: settings.store_name ?? 'Leyma Shop',
    whatsapp_number: settings.whatsapp_number ?? '',
    extra: ((settings.extra_whatsapp_numbers ?? []) as string[]).join(', '),
    contact_email: settings.contact_email ?? '',
    instagram_url: settings.instagram_url ?? '',
    tiktok_url: settings.tiktok_url ?? '',
    city: settings.city ?? '',
    business_hours: settings.business_hours ?? '',
    shipping_info: settings.shipping_info ?? '',
    payment_methods: settings.payment_methods ?? '',
    low_stock_threshold: String(settings.low_stock_threshold ?? 3),
    new_badge_days: String(settings.new_badge_days ?? 30),
  });
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useNotice();
  const bind = (k: keyof typeof s) => ({
    value: s[k],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setS({ ...s, [k]: e.target.value }),
  });

  async function save() {
    setBusy(true);
    const { extra, ...rest } = s;
    const res = await run(
      actions.saveSettings({
        ...rest,
        extra_whatsapp_numbers: extra.split(',').map((n) => n.replace(/\D/g, '')).filter(Boolean),
        low_stock_threshold: Number(s.low_stock_threshold),
        new_badge_days: Number(s.new_badge_days),
      }),
    );
    setBusy(false);
    setNotice('error' in res ? { kind: 'error', text: res.error } : { kind: 'ok', text: 'Ajustes guardados' });
  }

  return (
    <div className="space-y-4 pb-24">
      <h1 className="font-serif text-3xl font-semibold text-primary">Ajustes</h1>
      <Card title="Tienda">
        <Field label="Nombre">
          <input className={input} {...bind('store_name')} />
        </Field>
        <Field label="WhatsApp principal" hint="Con indicativo de país, ej. 573001234567">
          <input className={input} inputMode="tel" {...bind('whatsapp_number')} />
        </Field>
        <Field label="Otros WhatsApp" hint="Separados por coma">
          <input className={input} {...bind('extra')} />
        </Field>
        <Field label="Correo de contacto">
          <input className={input} type="email" {...bind('contact_email')} />
        </Field>
        <Field label="Instagram (URL)">
          <input className={input} {...bind('instagram_url')} />
        </Field>
        <Field label="TikTok (URL)">
          <input className={input} {...bind('tiktok_url')} />
        </Field>
        <Field label="Ciudad">
          <input className={input} {...bind('city')} />
        </Field>
        <Field label="Horario">
          <input className={input} {...bind('business_hours')} />
        </Field>
      </Card>
      <Card title="Envíos y pagos">
        <Field label="Envíos">
          <textarea className={input} rows={3} {...bind('shipping_info')} />
        </Field>
        <Field label="Métodos de pago">
          <textarea className={input} rows={3} {...bind('payment_methods')} />
        </Field>
      </Card>
      <Card title="Catálogo">
        <Field label="Umbral de “Últimas unidades”">
          <input className={input} inputMode="numeric" {...bind('low_stock_threshold')} />
        </Field>
        <Field label="Días con la etiqueta “Nuevo”">
          <input className={input} inputMode="numeric" {...bind('new_badge_days')} />
        </Field>
      </Card>
      <div className="fixed inset-x-0 bottom-0 z-10 border-t border-line bg-bg px-4 py-3">
        <div className="mx-auto max-w-4xl">
          <Button className="w-full" busy={busy} busyText="Guardando…" onClick={save}>
            Guardar ajustes
          </Button>
        </div>
      </div>
      <NoticeBar notice={notice} />
    </div>
  );
}
