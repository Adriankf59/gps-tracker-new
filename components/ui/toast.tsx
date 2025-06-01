// File: components/ui/toast.tsx
"use client";

import * as React from "react";

/** 
 * Tipe untuk tombol aksi (misal: tombol “Undo”).
 */
export type ToastActionElement = {
  label: string;
  onClick: () => void;
};

/** 
 * Props utama yang bisa diteruskan saat memanggil toast().
 * 
 * - open: apakah toast sedang tampil (default akan di-handle oleh hook).
 * - onOpenChange: callback ketika state `open` berubah.
 * - title: judul toast (string atau elemen React).
 * - description: deskripsi tambahan (string atau elemen React).
 * - action: objek action button (label + handler).
 * - id: ini akan diisi oleh hook secara otomatis, jadi tidak usah diisi manual.
 */
export interface ToastProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  title?: React.ReactNode;
  description?: React.ReactNode;
  action?: ToastActionElement;
  id?: string;
}

/**
 * Komponen <Toast /> — satu unit toast (tidak wajib, hanya untuk contoh).
 * Kamu bisa menyesuaikan styling-nya sesuai Tailwind atau CSS yang kamu pakai.
 */
export function Toast({
  title,
  description,
  action,
  open = true,
  onOpenChange,
}: ToastProps) {
  if (!open) return null;

  return (
    <div className="relative bg-gray-800 text-white p-4 rounded-lg shadow-lg animate-slide-in">
      {title && <div className="font-semibold text-sm mb-1">{title}</div>}
      {description && <div className="text-xs">{description}</div>}
      {action && (
        <button
          onClick={() => {
            action.onClick();
            onOpenChange?.(false);
          }}
          className="mt-2 text-blue-300 hover:underline text-xs"
        >
          {action.label}
        </button>
      )}
      <button
        onClick={() => onOpenChange?.(false)}
        className="absolute top-1 right-1 text-white text-sm"
      >
        ×
      </button>
    </div>
  );
}
