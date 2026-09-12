import { useState, useRef } from 'react';
import api from '../api/client';

interface Attachment {
  id: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  uploadedAt: string;
}

interface Props {
  entityType: string;   // 'requisitions' | 'orders' (URL segment)
  entityId: string;
  label?: string;
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1048576).toFixed(1) + ' MB';
}

function fileIcon(type: string) {
  if (type.includes('pdf'))  return '📄';
  if (type.includes('image')) return '🖼️';
  if (type.includes('xml'))  return '🗂️';
  if (type.includes('spreadsheet') || type.includes('excel')) return '📊';
  return '📎';
}

export default function AttachmentUpload({ entityType, entityId, label = 'Adjuntos' }: Props) {
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [loading, setLoading]         = useState(false);
  const [uploading, setUploading]     = useState(false);
  const [dragging, setDragging]       = useState(false);
  const [loaded, setLoaded]           = useState(false);
  const [error, setError]             = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  async function load() {
    if (loaded) return;
    setLoading(true);
    try {
      const res = await api.get(`/${entityType}/${entityId}/attachments`);
      setAttachments(res.data);
      setLoaded(true);
    } catch {
      setError('No se pudieron cargar los adjuntos');
    }
    setLoading(false);
  }

  async function downloadAttachment(att: Attachment) {
    // Descarga vía axios (incluye el token Bearer y usa el proxy /api → backend).
    // Un <a href> directo no manda el header de auth → "No token provided".
    try {
      const res = await api.get(`/${entityType}/attachments/${att.id}/download`, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = att.fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      setError('No se pudo descargar el adjunto');
    }
  }

  async function uploadFile(file: File) {
    if (file.size > 10 * 1024 * 1024) { setError('Máximo 10 MB por archivo'); return; }
    setUploading(true);
    setError('');
    const form = new FormData();
    form.append('file', file);
    try {
      const res = await api.post(`/${entityType}/${entityId}/attachments`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setAttachments(prev => [res.data, ...prev]);
    } catch (e: any) {
      setError(e.response?.data?.error || 'Error al subir archivo');
    }
    setUploading(false);
  }

  async function handleDelete(id: string) {
    try {
      await api.delete(`/${entityType}/attachments/${id}`);
      setAttachments(prev => prev.filter(a => a.id !== id));
    } catch {
      setError('Error al eliminar adjunto');
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) uploadFile(file);
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-sm text-gray-300">📎 {label}</h3>
        <button
          onClick={load}
          disabled={loaded || loading}
          className="text-xs text-cyan-400 hover:text-cyan-300 disabled:opacity-40"
        >
          {loaded ? `${attachments.length} archivo(s)` : loading ? 'Cargando...' : 'Cargar adjuntos'}
        </button>
      </div>

      {/* Drop zone */}
      <div
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-colors mb-3
          ${dragging ? 'border-cyan-600 bg-cyan-950/20' : 'border-gray-700 hover:border-gray-600'}`}
      >
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          onChange={e => { if (e.target.files?.[0]) uploadFile(e.target.files[0]); }}
          accept=".pdf,.xml,.png,.jpg,.jpeg,.xlsx,.xls,.docx,.doc"
        />
        {uploading ? (
          <p className="text-sm text-gray-400">Subiendo...</p>
        ) : (
          <>
            <p className="text-2xl mb-1">☁️</p>
            <p className="text-sm text-gray-400">Arrastra un archivo aquí o haz clic para seleccionar</p>
            <p className="text-xs text-gray-600 mt-0.5">PDF, XML, imágenes, Excel — máx. 10 MB</p>
          </>
        )}
      </div>

      {error && <p className="text-red-400 text-xs mb-2">{error}</p>}

      {/* File list */}
      {loaded && attachments.length === 0 && (
        <p className="text-xs text-gray-600 text-center py-2">Sin adjuntos</p>
      )}
      <div className="space-y-1.5">
        {attachments.map(att => (
          <div key={att.id} className="flex items-center gap-2 bg-gray-800/60 rounded-lg px-3 py-2 group">
            <span className="text-lg flex-shrink-0">{fileIcon(att.fileType)}</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-white truncate">{att.fileName}</p>
              <p className="text-xs text-gray-500">
                {formatBytes(att.fileSize)} · {new Date(att.uploadedAt).toLocaleDateString('es-EC')}
              </p>
            </div>
            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={() => downloadAttachment(att)}
                title="Descargar"
                className="text-cyan-400 hover:text-cyan-300 text-xs px-2 py-1 rounded"
              >
                ↓
              </button>
              <button
                onClick={() => handleDelete(att.id)}
                className="text-gray-600 hover:text-red-400 text-xs px-1.5 py-1 rounded"
              >
                ×
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
