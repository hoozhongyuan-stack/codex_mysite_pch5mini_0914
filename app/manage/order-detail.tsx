'use client';
import { AdminPageHeader } from './admin-ui';
import SiteLink from '../../components/site-link';

import { refundQuote } from '@/lib/refund-domain.mjs';
import { useState } from 'react';
import {
  ordersApi,
  OrderFileUpload,
  OrderItems,
  OrderNumber,
  OrderSummary,
  historyLabels,
  money,
} from '../order-shared';
import { orderStatuses } from '@/lib/order-domain.mjs';
import {
  Dialog,
  AdminFormActions,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from './admin-dialog';
const titles: Record<string, string> = {
  approve: '确认收款',
  reject: '驳回付款凭证',
  ship: '确认发货',
  logistics: '更新物流信息',
  refund: '登记全额退款',
  reject_aftersale: '驳回售后',
  close: '关闭订单',
  restock: '返还库存',
  note: '编辑内部备注',
};
export default function OrderDetail({ order, onBack, reload,role='editor',permissions=[] }: any) {
  const [op, setOp] = useState(''),
    [input, setInput] = useState<any>({}),
    [files, setFiles] = useState<string[]>([]),
    [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [busy, setBusy] = useState(false);
  const set = (key: string, value: any) => setInput({ ...input, [key]: value });
  const open = (action: string) => {
    setInput({
      items: order.items.map((i:any)=>({id:i.id,quantity:i.quantity-(order.data.refundedItems?.[i.id] || 0)})).filter((i:any)=>i.quantity>0),
      amount: action==='refund' ? refundQuote(order).amount : order.total,
      reason: '',
      company: order.data.logistics?.company || '',
      number: order.data.logistics?.number || '',
      note:
        action === 'note'
          ? order.data.internalNote || ''
          : action === 'logistics'
            ? order.data.logistics?.note || ''
            : '',
      time: new Date(Date.now() - new Date().getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 16),
      returned: false,
    });
    setFiles([]);
    setError('');
    setOp(action);
  };
  const submit = async () => {
    setBusy(true);
    setError('');
    try {
      let payload: any = { id: order.id };
      if (['approve', 'refund'].includes(op))
        payload = {
          ...payload,
          amount: input.amount,
          [op === 'approve' ? 'receivedAt' : 'refundedAt']: new Date(
            input.time,
          ).toISOString(),
        };
      if (op === 'refund')
        payload = { ...payload, file: files[0], returned: input.returned, items:input.items };
      if (['ship', 'logistics'].includes(op))
        payload = { ...payload, company: input.company, number: input.number };
      if (['reject', 'reject_aftersale', 'close', 'restock'].includes(op))
        payload = { ...payload, reason: input.reason };
      payload = { ...payload, note: input.note };
      await ordersApi('admin-' + op, payload, true);
      await reload();
      setOp('');
      setNotice('操作已保存');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  const can=(action:string)=>role==='owner'||permissions.includes('orders.'+(['approve','reject'].includes(action)?'finance':['ship','logistics'].includes(action)?'fulfill':['refund','restock','reject_aftersale'].includes(action)?'aftersale':'manage'));
  const button = (action: string, primary = false) => !can(action)?null:(
    <button
      key={action}
      className={'btn' + (primary ? ' primary' : '')}
      onClick={() => open(action)}
    >
      {titles[action]}
    </button>
  );
  return (
    <section className="admin-order-detail">
      <AdminPageHeader title="订单详情" onBack={onBack} backLabel="订单列表"/>
      <div className="order-status-heading">
        <OrderNumber order={order} />
        <b>{(orderStatuses as any)[order.status]}</b>
        {order.sandbox === 1 && <span role="status" className="notice">沙箱测试订单</span>}
      </div>
      {notice && <p role="status">{notice}</p>}
      <div className="order-layout">
        <div className="order-main">
          <OrderItems order={order} />
          <section className="panel">
            <h3>收货信息</h3>
            <p>
              <b>{order.data.address.name}</b> · {order.data.address.phone}
            </p>
            <p>
              {[
                order.data.address.country,
                order.data.address.province, order.data.address.city, order.data.address.district,
                order.data.address.street, order.data.address.postalCode,
              ].join(' · ')}
            </p>
            <p>{order.data.email}</p>
            <p>买家备注：{order.data.note || '—'}</p>
          </section>
          {order.data.latestProof && (
            <section className="panel">
              <h3>付款凭证</h3>
              <p>付款人：{order.data.latestProof.payer}</p>
              <p>
                付款时间：
                {new Date(order.data.latestProof.paidAt).toLocaleString(
                  'zh-CN',
                )}
              </p>
              <p>{order.data.latestProof.note}</p>
              <div className="proof-gallery">
                {order.data.latestProof.files.map((id: string) => (
                  <SiteLink
                    key={id}
                    href={'/api/order-files/' + id}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <img
                      className="proof-thumbnail"
                      src={'/api/order-files/' + id}
                      alt="付款凭证"
                    />
                  </SiteLink>
                ))}
              </div>
            </section>
          )}
          {order.data.logistics && (
            <section className="panel">
              <h3>物流信息</h3>
              <p>物流公司：{order.data.logistics.company || '未填写'}</p>
              <p>物流编号：{order.data.logistics.number || '未填写'}</p>
              <p>备注：{order.data.logistics.note || '—'}</p>
            </section>
          )}
          {order.data.aftersale && (
            <section className="panel">
              <h3>售后申请</h3>
              <p>
                {order.data.aftersale.kind === 'refund' ? '仅退款' : '退货退款'}{' '}
                · {order.data.aftersale.reason}
              </p>
              <p>{order.data.aftersale.description}</p>
              <div className="proof-gallery">
                {order.data.aftersale.files?.map((id: string) => (
                  <SiteLink
                    key={id}
                    href={'/api/order-files/' + id}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <img
                      className="proof-thumbnail"
                      src={'/api/order-files/' + id}
                      alt="售后凭证"
                    />
                  </SiteLink>
                ))}
              </div>
            </section>
          )}
        </div>
        <div className="order-side">
          <OrderSummary order={order} />
          <section className="panel">
            <h3>订单操作</h3>
            <div className="order-actions">
              {order.currency !== 'PTS' && order.status === 'pending_review' && (
                <>
                  {button('approve', true)}
                  {button('reject')}
                </>
              )}
              {order.status === 'pending_ship' && button('ship', true)}
              {['pending_receive', 'completed'].includes(order.status) &&
                button('logistics')}
              {order.status === 'aftersale' && (
                <>
                  {button('refund', true)}
                  {button('reject_aftersale')}
                </>
              )}
              {order.currency !== 'PTS' && ['pending_payment', 'pending_review'].includes(order.status) &&
                button('close')}
              {order.refunded === 1 &&
                order.restocked === 0 &&
                button('restock')}
            </div>
          </section>
          <section className="panel">
            <h3>内部备注</h3>
            <p>{order.data.internalNote || '暂无备注'}</p>
            {button('note')}
          </section>
        </div>
      </div>
      <section className="panel order-history">
        <h3>操作记录</h3>
        {order.history.map((h: any) => (
          <div key={h.id} className="order-history-entry">
            <strong>{historyLabels[h.action]?.[0] || h.action}</strong>
            <small>
              {new Date(h.created_at).toLocaleString('zh-CN')} · {h.actor}
            </small>
            {h.data.reason && <p>原因：{h.data.reason}</p>}
            {h.data.note && <p>备注：{h.data.note}</p>}
            {h.data.amount != null && (
              <p>金额：{money(h.data.amount, order.currency)}</p>
            )}
            {(h.data.receivedAt || h.data.refundedAt) && (
              <p>
                实际时间：
                {new Date(
                  h.data.receivedAt || h.data.refundedAt,
                ).toLocaleString('zh-CN')}
              </p>
            )}
            {h.data.file && (
              <SiteLink
                href={'/api/order-files/' + h.data.file}
                target="_blank"
                rel="noreferrer"
              >
                查看退款凭证
              </SiteLink>
            )}
            {h.data.files?.map((id: string) => (
              <SiteLink
                key={id}
                href={'/api/order-files/' + id}
                target="_blank"
                rel="noreferrer"
              >
                查看历史凭证{' '}
              </SiteLink>
            ))}
          </div>
        ))}
      </section>
      <Dialog
        open={!!op}
        onOpenChange={(value) => {
          if (!value && !busy) setOp('');
        }}
      >
        <DialogContent
          className="order-operation-dialog"
          showCloseButton={!busy}
        >
          <DialogTitle>{titles[op] || '订单操作'}</DialogTitle>
          <DialogDescription>
            {['approve', 'refund'].includes(op)
              ? (order.currency === 'PTS' ? '确认后退回兑换积分，退货商品需单独确认回库。' : '请核实线下实际款项后提交，系统不会自动转账。')
              : '仅修改当前订单，保存后记录操作日志。'}
          </DialogDescription>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
          >
            {op==='refund' && order.currency!=='PTS' && <fieldset><legend>退款商品数量</legend>{order.items.map((item:any)=>{const remaining=item.quantity-(order.data.refundedItems?.[item.id]||0);return <label className="field" key={item.id}><span>{item.snapshot.titleZh} · {item.snapshot.spu || '—'}（可退 {remaining}）</span><input type="number" min={0} max={remaining} value={input.items?.find((x:any)=>x.id===item.id)?.quantity || 0} onChange={e=>{const items=[...(input.items||[]).filter((x:any)=>x.id!==item.id),{id:item.id,quantity:Number(e.target.value)}].filter((x:any)=>x.quantity>0);let amount=0;try{amount=refundQuote(order,items).amount;}catch{}setInput({...input,items,amount});}}/></label>})}<p>金额按订单商品单价计算；最后全部退完时退回原运费。部分退款不自动回补库存。</p></fieldset>}
            {['approve', 'refund'].includes(op) && (
              <div className="field-grid">
                <label className="field">
                  <span>
                    <b className="required-mark">*</b>
                    {order.currency === 'PTS' ? '退回积分' : op === 'approve' ? '实际到账金额' : '实际退款金额'}
                  </span>
                  <input
                    readOnly={op==='refund'}
                    required
                    type="number"
                    min={order.currency === 'PTS' ? 1 : 0.01}
                    step={order.currency === 'PTS' ? 1 : 0.01}
                    value={order.currency === 'PTS' ? input.amount : input.amount / 100}
                    onChange={(e) =>
                      set('amount', Math.round(Number(e.target.value) * (order.currency === 'PTS' ? 1 : 100)))
                    }
                  />
                </label>
                <label className="field">
                  <span>
                    <b className="required-mark">*</b>
                    {op === 'approve' ? '到账时间' : '退款时间'}
                  </span>
                  <input
                    required
                    type="datetime-local"
                    value={input.time || ''}
                    onChange={(e) => set('time', e.target.value)}
                  />
                </label>
              </div>
            )}
            {['ship', 'logistics'].includes(op) && (
              <div className="field-grid">
                <label className="field">
                  物流公司（选填）
                  <input
                    value={input.company || ''}
                    onChange={(e) => set('company', e.target.value)}
                  />
                </label>
                <label className="field">
                  物流编号（选填）
                  <input
                    value={input.number || ''}
                    onChange={(e) => set('number', e.target.value)}
                  />
                </label>
              </div>
            )}
            {['reject', 'reject_aftersale', 'close', 'restock'].includes(
              op,
            ) && (
              <label className="field">
                <span>
                  <b className="required-mark">*</b>操作原因
                </span>
                <textarea
                  required
                  maxLength={500}
                  value={input.reason || ''}
                  onChange={(e) => set('reason', e.target.value)}
                />
              </label>
            )}
            {op === 'refund' && (
              <>
                <label>
                  <input
                    type="checkbox"
                    checked={input.returned || false}
                    onChange={(e) => set('returned', e.target.checked)}
                  />{' '}
                  已核实收到退货
                </label>
                {order.currency !== 'PTS' && <OrderFileUpload
                  orderId={order.id}
                  purpose="refund"
                  maxFiles={1}
                  files={files}
                  onChange={setFiles}
                />}
              </>
            )}
            <label className="field">
              {op === 'note' ? '内部备注' : '备注（选填）'}
              <textarea
                maxLength={1000}
                value={input.note || ''}
                onChange={(e) => set('note', e.target.value)}
              />
            </label>
            {error && (
              <p role="alert" className="error">
                {error}
              </p>
            )}
            <AdminFormActions busy={busy}>
              <button aria-busy={Boolean(busy)}
                className="btn primary"
                disabled={busy || (op === 'refund' && order.currency !== 'PTS' && !files.length)}
              >
                {busy ? '保存中…' : '确认保存'}
              </button>

            </AdminFormActions>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  );
}
