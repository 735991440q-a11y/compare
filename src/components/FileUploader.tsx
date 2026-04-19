import React, { useRef } from 'react';
import { Upload, File, X } from 'lucide-react';
import { cn } from '@/src/lib/utils';

interface FileUploaderProps {
  label: string;
  accept: string;
  file: File | null;
  onFileSelect: (file: File | null) => void;
  className?: string;
}

export function FileUploader({ label, accept, file, onFileSelect, className }: FileUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      onFileSelect(droppedFile);
    }
  };

  return (
    <div className={cn("space-y-2", className)}>
      <label className="text-xs font-mono uppercase tracking-wider text-gray-500 font-semibold">
        {label}
      </label>
      <div
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={cn(
          "relative border-2 border-dashed rounded-lg p-6 transition-all cursor-pointer flex flex-col items-center justify-center gap-3",
          file ? "border-emerald-500/50 bg-emerald-50/30" : "border-gray-200 hover:border-gray-300 bg-gray-50/50"
        )}
      >
        <input
          type="file"
          ref={inputRef}
          accept={accept}
          className="hidden"
          onChange={(e) => onFileSelect(e.target.files?.[0] || null)}
        />
        
        {file ? (
          <>
            <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">
              <File size={20} />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-gray-900 truncate max-w-[200px]">{file.name}</p>
              <p className="text-xs text-gray-500">{(file.size / 1024).toFixed(1)} KB</p>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onFileSelect(null);
              }}
              className="absolute top-2 right-2 p-1 hover:bg-gray-200 rounded-full transition-colors"
            >
              <X size={14} className="text-gray-400" />
            </button>
          </>
        ) : (
          <>
            <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-400">
              <Upload size={20} />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-gray-700">点击或拖拽文件至此处上传</p>
              <p className="text-xs text-gray-400">仅限 {accept.toUpperCase()} 格式文件</p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
