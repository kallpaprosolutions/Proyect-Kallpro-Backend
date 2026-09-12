import { useRef, useState } from 'react';
import { useToast } from './Toast';
import { inventoryApi } from '../../api/inventory';

/**
 * Uploader de imagen de producto.
 * Soporta drag & drop, click, y captura de cámara (móvil con accept="image/*; capture=environment").
 */

interface Props {
  productId: string;
  currentImageUrl?: string | null;
  onUploaded?: (newUrl: string | null) => void;
  size?: 'sm' | 'md' | 'lg';
}

const SIZE_CLASS = {
  sm: 'w-24 h-24',
  md: 'w-40 h-40',
  lg: 'w-56 h-56',
};

export default function ProductImageUpload({ productId, currentImageUrl, onUploaded, size = 'md' }: Props) {
  const toast = useToast();
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [preview, setPreview] = useState<string | null>(currentImageUrl || null);
  const inputRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    if (!file.type.startsWith('image/')) {
      toast.error('Solo se permiten archivos de imagen');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Imagen demasiado grande (máx 5 MB)');
      return;
    }
    setUploading(true);
    // Preview optimista
    const reader = new FileReader();
    reader.onload = () => setPreview(reader.result as string);
    reader.readAsDataURL(file);

    try {
      const res = await inventoryApi.uploadProductImage(productId, file);
      const newUrl = res.data?.imageUrl ?? null;
      setPreview(newUrl);
      onUploaded?.(newUrl);
      toast.success('Imagen subida correctamente');
    } catch (e: any) {
      setPreview(currentImageUrl || null);
      toast.error(e?.response?.data?.error || 'Error al subir imagen');
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete() {
    setUploading(true);
    try {
      await inventoryApi.deleteProductImage(productId);
      setPreview(null);
      onUploaded?.(null);
      toast.success('Imagen eliminada');
    } catch (e: any) {
      toast.error(e?.response?.data?.error || 'Error al eliminar imagen');
    } finally {
      setUploading(false);
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-start gap-3">
        {/* Preview o dropzone */}
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => !preview && inputRef.current?.click()}
          className={`${SIZE_CLASS[size]} flex-shrink-0 rounded-xl border-2 ${
            dragging
              ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/30'
              : preview
              ? 'border-surface-200 dark:border-surface-700'
              : 'border-dashed border-surface-300 dark:border-surface-600 cursor-pointer hover:border-brand-400'
          } overflow-hidden bg-surface-50 dark:bg-surface-900/50 transition-colors relative`}
        >
          {preview ? (
            <img src={preview} alt="Producto" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-surface-400 p-2 text-center">
              <span className="text-3xl mb-1">🖼️</span>
              <p className="text-xs">Arrastra o haz click</p>
              <p className="text-[10px]">PNG, JPG, WEBP · máx 5 MB</p>
            </div>
          )}
          {uploading && (
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
              <div className="animate-spin w-6 h-6 border-4 border-white border-t-transparent rounded-full" />
            </div>
          )}
        </div>

        {/* Botones */}
        <div className="flex flex-col gap-1.5 flex-1">
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            className="hidden"
            onChange={(e) => { if (e.target.files?.[0]) handleFile(e.target.files[0]); e.target.value = ''; }}
          />
          <input
            ref={cameraRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => { if (e.target.files?.[0]) handleFile(e.target.files[0]); e.target.value = ''; }}
          />
          <button type="button" onClick={() => inputRef.current?.click()} disabled={uploading}
            className="text-xs px-3 py-1.5 bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white rounded-lg font-medium">
            📁 Seleccionar archivo
          </button>
          <button type="button" onClick={() => cameraRef.current?.click()} disabled={uploading}
            className="text-xs px-3 py-1.5 bg-surface-100 dark:bg-surface-700 hover:bg-surface-200 dark:hover:bg-surface-600 text-surface-700 dark:text-surface-200 rounded-lg font-medium">
            📷 Tomar foto
          </button>
          {preview && (
            <button type="button" onClick={handleDelete} disabled={uploading}
              className="text-xs px-3 py-1.5 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg font-medium">
              🗑 Eliminar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
