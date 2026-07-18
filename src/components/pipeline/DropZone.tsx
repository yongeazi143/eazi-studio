"use client";

import { useState, useRef } from "react";
import { UploadCloud } from "lucide-react";

import { useToast } from "@/context/ToastContext";

interface DropZoneProps {
  onFileDrop: (file: File) => void;
}

export default function DropZone({ onFileDrop }: DropZoneProps) {
  const { showToast } = useToast();
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      if (file.type.startsWith("audio/") || file.name.endsWith(".mp3") || file.name.endsWith(".wav")) {
        onFileDrop(file);
      } else {
        showToast("Please upload a valid audio file (MP3, WAV, etc.)", "warning");
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onFileDrop(e.target.files[0]);
    }
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={() => fileInputRef.current?.click()}
      className={`w-full max-w-lg mx-auto border-2 border-dashed rounded-2xl p-10 cursor-pointer transition-all duration-300 flex flex-col items-center justify-center ${
        isDragging
          ? "border-[#9B6FF7] bg-[#7C3AED]/10 scale-[1.02]"
          : "border-white/20 hover:border-[#9B6FF7]/50 hover:bg-white/5"
      }`}
    >
      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        accept="audio/*"
        onChange={handleFileChange}
      />
      <UploadCloud className={`w-8 h-8 mb-4 ${isDragging ? "text-[#9B6FF7]" : "text-[#7B7890]"}`} />
      <p className="text-sm font-medium text-white mb-1">
        Click to upload or drag & drop
      </p>
      <p className="text-xs text-[#7B7890]">MP3, WAV, or M4A (Max 50MB)</p>
    </div>
  );
}
