'use client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from './admin-dialog';
import MediaBrowser from './media-browser';
export default function AssetPicker(props: any) {
  return (
    <Dialog guardChanges={false} open onOpenChange={(o) => !o && props.onClose()}>
      <DialogContent size="media" className="asset-picker-dialog unified-picker">
        <DialogHeader>
          <DialogTitle>选择素材</DialogTitle>
          <DialogDescription>
            选择已有素材，或直接上传新素材。上传完成后会自动选中，可直接确认使用。
          </DialogDescription>
        </DialogHeader>
        <MediaBrowser {...props} picker />
      </DialogContent>
    </Dialog>
  );
}
