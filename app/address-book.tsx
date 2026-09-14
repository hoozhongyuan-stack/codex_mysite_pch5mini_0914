'use client';
import { useEffect, useState, useRef } from 'react';
import { ordersApi } from './order-shared';
import { countryCodes } from '@/lib/order-countries.mjs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
export const blankAddress = {
  name: '',
  phone: '',
  country: '',
  province: '',
  city: '',
  district: '',
  street: '',
  postalCode: '',
  label: '',
  isDefault: false,
};
export function AddressFields({ value, onChange, en = false }: any) {
  const t = (zh: string, eng: string) => (en ? eng : zh);
  const locale = en ? 'en' : 'zh';
  const labelFor = (code: string) =>
    `${new Intl.DisplayNames([locale], { type: 'region' }).of(code)} (${code})`;
  const options = [...countryCodes].sort((a, b) =>
    labelFor(a).localeCompare(labelFor(b), locale, { sensitivity: 'base' }),
  );
  return (
    <div className="field-grid">
      {[
        ['name', '收货人', 'Recipient'],
        ['phone', '联系电话', 'Phone'],
        ['country', '国家/地区', 'Country / region'],
        ['province', '省 / 州', 'Province / state'],
        ['city', '城市', 'City'],
        ['district', '区 / 县', 'District'],
        ['street', '详细地址', 'Street address'],
        ['postalCode', '邮政编码', 'Postal code'],
        ['label', '地址标签（家庭、公司等）', 'Label (home, work)'],
      ].map(([key, zh, eng]) => (
        <label className="field" key={key}>
          <span>
            {['name', 'phone', 'country', 'city', 'street'].includes(key) && (
              <b aria-hidden="true" className="required-mark">*</b>
            )}
            {t(zh, eng)}
          </span>
          {key === 'country' ? (
            <select
              aria-label={t(zh,eng)}
              required
              value={value.country}
              onChange={(e) => onChange({ ...value, country: e.target.value })}
            >
              <option value="">{t('请选择', 'Select')}</option>
              {options.map((code: string) => (
                <option value={code} key={code}>
                  {labelFor(code)}
                </option>
              ))}
            </select>
          ) : (
            <input
              aria-label={t(zh,eng)}
              required={['name', 'phone', 'city', 'street'].includes(key)}
              value={value[key] || ''}
              maxLength={
                key === 'street'
                  ? 500
                  : key === 'phone'
                    ? 30
                    : key === 'postalCode'
                      ? 20
                      : key === 'label'
                        ? 40
                        : 100
              }
              onChange={(e) => onChange({ ...value, [key]: e.target.value })}
            />
          )}
        </label>
      ))}
    </div>
  );
}
export function SavedAddressPicker({ value, onChange, en = false, refresh=0 }: any) {
  const latest=useRef(value);latest.current=value;
  const [rows, setRows] = useState<any[]>([]),
    [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    ordersApi('addresses')
      .then((d) => {
        if (!active) return;
        setRows(d.rows);
        const a = d.rows.find((x: any) => x.isDefault);
        if (a && !Object.entries(latest.current).some(([k,v])=>k!=='isDefault' && Boolean(v))) onChange(a);
      })
      .catch((e) => {
        if (active && e.status !== 401) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [refresh]);
  return (
    <>
      <label className="field">
        <span>{en ? 'Saved address' : '常用地址'}</span>
        <select
          value={value.id || ''}
          onChange={(e) =>
            onChange(
              rows.find((x) => x.id === e.target.value) || { ...blankAddress },
            )
          }
        >
          <option value="">{en ? 'Enter a new address' : '填写新地址'}</option>
          {rows.map((a) => (
            <option key={a.id} value={a.id}>
              {a.isDefault ? (en ? 'Default · ' : '默认 · ') : ''}
              {a.name} · {a.street}
            </option>
          ))}
        </select>
      </label>
      {error && <p role="alert">{error}</p>}
      <AddressFields value={value} onChange={onChange} en={en} />
    </>
  );
}
export default function AddressBook({ en = false }: any) {
  const [rows, setRows] = useState<any[]>([]),
    [edit, setEdit] = useState<any>(null),
    [remove, setRemove] = useState<any>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const t = (z: string, e: string) => (en ? e : z);
  const reload = async () => setRows((await ordersApi('addresses')).rows);
  useEffect(() => {
    reload().catch((e) => setError(e.message));
  }, []);
  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError('');
    try {
      await fn();
      await reload();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <div className="member-heading">
        <h2>{t('我的地址', 'My addresses')}</h2>
        <button
          className="btn primary"
          disabled={rows.length >= 20}
          onClick={() =>
            setEdit({ ...blankAddress, isDefault: rows.length === 0 })
          }
        >
          {t('新增地址', 'Add address')}
        </button>
      </div>
      {error && <p role="alert">{error}</p>}
      <div className="address-grid">
        {rows.map((a) => (
          <article className="address-card" key={a.id}>
            <h3>
              {a.name} {a.label && <small>{a.label}</small>}{' '}
              {a.isDefault && (
                <span className="pill">{t('默认', 'Default')}</span>
              )}
            </h3>
            <p>{a.phone}</p>
            <p>
              {[
                a.country,
                a.province,
                a.city,
                a.district,
                a.street,
                a.postalCode,
              ]
                .filter(Boolean)
                .join(' · ')}
            </p>
            <div className="flex-actions">
              <button className="btn" onClick={() => setEdit(a)}>
                {t('编辑', 'Edit')}
              </button>
              {!a.isDefault && (
                <button aria-busy={Boolean(busy)}
                  className="btn"
                  disabled={busy}
                  onClick={() =>
                    run(async () => {
                      await ordersApi(
                        'address-save',
                        { ...a, isDefault: true },
                        true,
                      );
                    })
                  }
                >
                  {t('设为默认', 'Set default')}
                </button>
              )}
              <button className="btn" onClick={() => setRemove(a)}>
                {t('删除', 'Delete')}
              </button>
            </div>
          </article>
        ))}
      </div>
      {!rows.length && (
        <p className="member-empty">
          {t(
            '添加常用地址，下单时即可直接选择。',
            'Save an address to use at checkout.',
          )}
        </p>
      )}
      {edit && (
        <Dialog
          open
          onOpenChange={(v) => {
            if (!v && !busy) setEdit(null);
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t('收货地址', 'Shipping address')}</DialogTitle>
            </DialogHeader>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                run(async () => {
                  await ordersApi('address-save', edit, true);
                  setEdit(null);
                });
              }}
            >
              <AddressFields value={edit} onChange={setEdit} en={en} />
              <label>
                <input
                  type="checkbox"
                  checked={edit.isDefault}
                  onChange={(e) =>
                    setEdit({ ...edit, isDefault: e.target.checked })
                  }
                />{' '}
                {t('设为默认地址', 'Use as default')}
              </label>
              {error && <p role="alert">{error}</p>}
              <button aria-busy={Boolean(busy)} className="btn primary" disabled={busy}>
                {t('保存地址', 'Save address')}
              </button>
            </form>
          </DialogContent>
        </Dialog>
      )}
      {remove && (
        <Dialog open onOpenChange={() => setRemove(null)}>
          <DialogContent>
            <DialogTitle>
              {t(
                '删除此地址？历史订单不受影响。',
                'Delete this address? Existing orders are unaffected.',
              )}
            </DialogTitle>
            <button aria-busy={Boolean(busy)}
              className="btn"
              disabled={busy}
              onClick={() =>
                run(async () => {
                  await ordersApi('address-delete', { id: remove.id }, true);
                  setRemove(null);
                })
              }
            >
              {t('确认删除', 'Delete')}
            </button>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
