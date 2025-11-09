"use client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export default function UploadGuideDialog() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" className="h-auto p-0 text-xs opacity-70 hover:opacity-100">
          上传指南
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>上传指南</DialogTitle>
          <DialogDescription>
            为获得更好的几何与贴图质量，请参考以下建议：
          </DialogDescription>
        </DialogHeader>
        <div className="prose prose-sm dark:prose-invert">
          <ul>
            <li>主体居中、无遮挡；背景尽量简洁纯色。</li>
            <li>单图生成：请选择清晰的正面视图。</li>
            <li>多视图生成：前视图必选；后/左/右视图可选但更佳。</li>
            <li>避免强反光、过暗或过曝；保持物体完整边界。</li>
            <li>支持 JPG/PNG/WebP，单张不超过 20MB。</li>
          </ul>
        </div>
      </DialogContent>
    </Dialog>
  );
}

