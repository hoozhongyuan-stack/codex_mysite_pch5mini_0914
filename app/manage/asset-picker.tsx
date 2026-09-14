'use client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import MediaBrowser from './media-browser';
export default function AssetPicker(props: any) {
  return (
    <Dialog open onOpenChange={(o) => !o && props.onClose()}>
      <DialogContent className="asset-picker-dialog unified-picker">
        <DialogHeader>
          <DialogTitle>选择素材</DialogTitle>
          <DialogDescription>
            按文件夹查找，选择后点击确定。也可上传新素材。
          </DialogDescription>
        </DialogHeader>
        <MediaBrowser {...props} picker />
      </DialogContent>
    </Dialog>
  );
}
