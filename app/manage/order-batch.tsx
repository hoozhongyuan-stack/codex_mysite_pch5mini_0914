'use client';
import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ordersApi } from '../order-shared';
export default function OrderBatch({ rows, operation, onClose, onDone }: any) {
  const [shipments, setShipments] = useState<
    Record<string, { company: string; number: string }>
  >({});
  const [reason, setReason] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  return (
    <Dialog
      open
      onOpenChange={(v) => {
        if (!v && !busy) onClose();
      }}
    >
      <DialogContent className="order-batch-dialog">
        <DialogHeader>
          <DialogTitle>
            {operation === 'ship' ? '批量发货' : '关闭兑换订单'} · {rows.length}{' '}
            单
          </DialogTitle>
        </DialogHeader>
        <p className="muted">
          仅处理所选的待发货兑换订单。每单独立校验，失败项目会保留原因。
        </p>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError('');
            try {
              const r = await ordersApi(
                'admin-batch',
                {
                  operation,
                  selected: rows.map((r: any) => r.id),
                  shipments,
                  reason,
                },
                true,
              );
              onDone(r.results);
            } catch (e: any) {
              setError(e.message);
            } finally {
              setBusy(false);
            }
          }}
        >
          {operation === 'ship' ? (
            <div className="batch-shipments">
              {rows.map((r: any) => (
                <div className="batch-shipment" key={r.id}>
                  <b>{r.order_number || r.id}</b>
                  <input
                    required
                    aria-label={'物流公司 ' + r.id}
                    placeholder="物流公司"
                    value={shipments[r.id]?.company || ''}
                    onChange={(e) =>
                      setShipments({
                        ...shipments,
                        [r.id]: { ...shipments[r.id], company: e.target.value },
                      })
                    }
                  />
                  <input
                    required
                    aria-label={'物流单号 ' + r.id}
                    placeholder="物流单号"
                    value={shipments[r.id]?.number || ''}
                    onChange={(e) =>
                      setShipments({
                        ...shipments,
                        [r.id]: { ...shipments[r.id], number: e.target.value },
                      })
                    }
                  />
                </div>
              ))}
            </div>
          ) : (
            <label className="field">
              关闭原因
              <input
                required
                maxLength={500}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
              <small>
                确认后关闭未发货兑换订单，并按原规则退回积分、库存及兑换配额。
              </small>
            </label>
          )}
          {error && <p role="alert">{error}</p>}
          <div className="flex-actions">
            <button aria-busy={Boolean(busy)}
              className="btn"
              type="button"
              disabled={busy}
              onClick={onClose}
            >
              取消
            </button>
            <button aria-busy={Boolean(busy)} className="btn primary" disabled={busy}>
              {busy ? '正在处理…' : '确认处理'}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
