'use client';
import SiteLink from '../components/site-link';

import { useState } from 'react';
import {
  MessageCircle,
  Camera,
  Video,
  Globe,
  ExternalLink,
  QrCode,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
export default function FooterSocials({
  items,
  en,
}: {
  items: any[];
  en: boolean;
}) {
  const [selected, setSelected] = useState<any>(null);
  const icons: any = {
    wechat: MessageCircle,
    linkedin: Globe,
    facebook: Globe,
    whatsapp: MessageCircle,
    instagram: Camera,
    youtube: Video,
    custom: Globe,
    x: Globe,
  };
  return (
    <>
      <div className="footer-socials">
        {items
          .filter((s) => s.enabled)
          .map((s, i) => {
            const customIcons: any = {
              globe: Globe,
              message: MessageCircle,
              camera: Camera,
              video: Video,
            };
            const Icon =
              s.platform === 'custom'
                ? customIcons[s.icon] || Globe
                : icons[s.platform] || Globe;
            const label = en ? s.labelEn : s.labelZh;
            const inner = (
              <>
                <Icon size={17} aria-hidden="true" />
                <span>{label}</span>
                {s.kind === 'qr' ? (
                  <QrCode size={13} aria-hidden="true" />
                ) : (
                  <ExternalLink size={12} aria-hidden="true" />
                )}
              </>
            );
            return s.kind === 'qr' ? (
              <div className="footer-social-card" key={i}>
                <button
                  type="button"
                  onClick={() => setSelected(s)}
                  aria-haspopup="dialog"
                >
                  {inner}
                </button>
                {s.imageId && (
                  <button
                    type="button"
                    className="footer-social-qr"
                    onClick={() => setSelected(s)}
                    aria-label={(label || '') + (en ? ' QR code' : '二维码')}
                  >
                    <img src={'/api/media/' + s.imageId} alt="" />
                  </button>
                )}
              </div>
            ) : (
              <SiteLink key={i} href={s.url} target="_blank" rel="noreferrer">
                {inner}
              </SiteLink>
            );
          })}
      </div>
      <Dialog
        open={!!selected}
        onOpenChange={(open) => !open && setSelected(null)}
      >
        <DialogContent className="footer-qr-dialog">
          <DialogHeader>
            <DialogTitle>
              {selected && (en ? selected.labelEn : selected.labelZh)}
            </DialogTitle>
            <DialogDescription>
              {en
                ? 'Scan this QR code to connect.'
                : '扫描二维码，与我们联系。'}
            </DialogDescription>
          </DialogHeader>
          {selected && (
            <img
              src={'/api/media/' + selected.imageId}
              alt={en ? 'Contact QR code' : '联系二维码'}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
