import { useCallback, useEffect, useRef, useState } from 'react';
import { BrowserMultiFormatReader, IScannerControls } from '@zxing/browser';
import { BarcodeFormat, DecodeHintType } from '@zxing/library';
import { useCameraScannerEnabled } from '../../hooks/useCameraScannerEnabled';

/**
 * Escáner de códigos de barras y QR.
 * Usa @zxing/browser con la cámara del dispositivo. Soporta:
 * - QR Code, Data Matrix, Aztec, PDF-417 (2D)
 * - EAN-13, EAN-8, UPC-A, UPC-E, Code 128, Code 39 (1D)
 *
 * Diseñado para mobile-first pero funciona en desktop si hay webcam.
 */

interface Props {
  open: boolean;
  onScan: (code: string) => void;
  onClose: () => void;
  title?: string;
  subtitle?: string;
}

// Beep sonoro corto cuando se detecta un código
function playBeep() {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const Ctx = (window.AudioContext || (window as any).webkitAudioContext);
    if (!Ctx) return;
    const audio = new Ctx();
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.connect(gain);
    gain.connect(audio.destination);
    osc.frequency.value = 880;
    osc.type = 'sine';
    gain.gain.setValueAtTime(0.15, audio.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audio.currentTime + 0.15);
    osc.start();
    osc.stop(audio.currentTime + 0.15);
  } catch {}
}

export default function BarcodeScanner({
  open, onScan, onClose,
  title = 'Escanear código',
  subtitle = 'Apunta la cámara al código de barras o QR',
}: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  // Guardamos el MediaStream para poder detener sus tracks incluso si el <video> ya
  // fue desmontado (con useEffect pasivo, videoRef.current es null en la limpieza).
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState('');
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [selectedCamera, setSelectedCamera] = useState<string>('');
  const [manualCode, setManualCode] = useState('');
  const [lastDetected, setLastDetected] = useState('');
  const [starting, setStarting] = useState(false);
  // Escáner con cámara habilitado por configuración (ErpConfig.inventory.enableCameraScanner).
  // Si está OFF, este componente NUNCA pide la cámara (solo queda la entrada manual).
  const cameraEnabled = useCameraScannerEnabled();

  // onScan puede cambiar de referencia en cada render del padre; lo guardamos en una ref
  // para NO re-arrancar la cámara por ese cambio (evita re-adquirir el dispositivo).
  const onScanRef = useRef(onScan);
  useEffect(() => { onScanRef.current = onScan; }, [onScan]);

  // Libera la cámara por completo: detiene el decodificador y TODOS los tracks del stream
  // del <video> (aunque zxing no los haya soltado) y limpia srcObject. Idempotente.
  const stopCamera = useCallback(() => {
    try { controlsRef.current?.stop(); } catch { /* noop */ }
    controlsRef.current = null;
    // Detener tracks del stream capturado Y del que esté en el <video> (por si difieren).
    const streams = [streamRef.current, (videoRef.current?.srcObject ?? null) as MediaStream | null];
    for (const stream of streams) {
      if (!stream) continue;
      for (const track of stream.getTracks()) { try { track.stop(); } catch { /* noop */ } }
    }
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  // Red de seguridad: liberar la cámara al desmontar el componente.
  useEffect(() => () => stopCamera(), [stopCamera]);

  // Reset al abrir
  useEffect(() => {
    if (open) {
      setError('');
      setLastDetected('');
      setManualCode('');
    }
  }, [open]);

  // Listar cámaras al abrir (solo si el escáner con cámara está habilitado)
  useEffect(() => {
    if (!open || !cameraEnabled) return;
    (async () => {
      try {
        // Permiso primero
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        stream.getTracks().forEach((t) => t.stop());
        const devices = await BrowserMultiFormatReader.listVideoInputDevices();
        setCameras(devices);
        // Preferir cámara trasera en móvil
        const back = devices.find((d) => /back|trasera|environment/i.test(d.label));
        setSelectedCamera(back?.deviceId || devices[0]?.deviceId || '');
      } catch (e: any) {
        setError('No se pudo acceder a la cámara. Verifica permisos del navegador.');
      }
    })();
  }, [open, cameraEnabled]);

  // Arrancar el scanner cuando hay cámara seleccionada (solo si está habilitado por config)
  useEffect(() => {
    if (!open || !cameraEnabled || !selectedCamera || !videoRef.current) return;

    const hints = new Map<DecodeHintType, unknown>();
    hints.set(DecodeHintType.POSSIBLE_FORMATS, [
      BarcodeFormat.QR_CODE,
      BarcodeFormat.DATA_MATRIX,
      BarcodeFormat.AZTEC,
      BarcodeFormat.PDF_417,
      BarcodeFormat.EAN_13,
      BarcodeFormat.EAN_8,
      BarcodeFormat.UPC_A,
      BarcodeFormat.UPC_E,
      BarcodeFormat.CODE_128,
      BarcodeFormat.CODE_39,
      BarcodeFormat.CODE_93,
      BarcodeFormat.ITF,
    ]);
    hints.set(DecodeHintType.TRY_HARDER, true);

    const reader = new BrowserMultiFormatReader(hints);
    let cancelled = false;
    setStarting(true);
    reader
      .decodeFromVideoDevice(selectedCamera, videoRef.current, (result, _err, controls) => {
        if (result) {
          const text = result.getText();
          setLastDetected(text);
          playBeep();
          // Detener para no detectar múltiples veces
          controls.stop();
          // Pequeño delay visual para mostrar el código detectado
          setTimeout(() => {
            onScanRef.current(text);
          }, 300);
        }
      })
      .then((controls) => {
        // Si el efecto ya se limpió antes de resolver la promesa, detener este stream
        // recién creado (de lo contrario quedaría la cámara ocupada = fuga).
        if (cancelled) { try { controls.stop(); } catch { /* noop */ } stopCamera(); return; }
        controlsRef.current = controls;
        streamRef.current = (videoRef.current?.srcObject ?? null) as MediaStream | null;
        setStarting(false);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(`No se pudo iniciar la cámara: ${e?.message || 'error desconocido'}`);
        setStarting(false);
      });

    return () => {
      cancelled = true;
      stopCamera();
    };
  }, [open, cameraEnabled, selectedCamera, stopCamera]);

  function handleManualSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (manualCode.trim()) onScan(manualCode.trim());
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[110] flex flex-col bg-black/95" onClick={onClose}>
      <div className="bg-surface-900 text-white px-4 py-3 flex items-center justify-between" onClick={(e) => e.stopPropagation()}>
        <div className="min-w-0">
          <h3 className="font-semibold truncate">{title}</h3>
          <p className="text-xs text-surface-400 truncate">{subtitle}</p>
        </div>
        <button onClick={onClose} className="text-2xl leading-none px-2 hover:text-red-400">×</button>
      </div>

      {/* Selector de cámara */}
      {cameras.length > 1 && (
        <div className="bg-surface-900 px-4 py-2" onClick={(e) => e.stopPropagation()}>
          <select value={selectedCamera} onChange={(e) => setSelectedCamera(e.target.value)}
            className="w-full bg-surface-800 text-white border border-surface-700 rounded-lg px-3 py-1.5 text-sm">
            {cameras.map((c) => <option key={c.deviceId} value={c.deviceId}>{c.label || `Cámara ${c.deviceId.slice(0, 6)}`}</option>)}
          </select>
        </div>
      )}

      {/* Escáner con cámara deshabilitado por configuración */}
      {!cameraEnabled && (
        <div className="relative flex-1 flex items-center justify-center px-6" onClick={(e) => e.stopPropagation()}>
          <div className="max-w-md text-center space-y-3">
            <div className="text-5xl">📷🚫</div>
            <h4 className="text-white font-semibold">Escáner con cámara deshabilitado</h4>
            <p className="text-sm text-surface-400">
              La cámara está desactivada para evitar que el navegador la retenga y bloquee otras
              aplicaciones. Puedes ingresar el código manualmente abajo (o usar una pistola lectora USB).
            </p>
            <p className="text-xs text-surface-500">
              Para activarla: <span className="text-surface-300">Configuración → Empresa → Inventario → Escáner con cámara</span>.
            </p>
          </div>
        </div>
      )}

      {/* Video con overlay */}
      {cameraEnabled && (
      <div className="relative flex-1 flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
        <video ref={videoRef} className="max-h-full max-w-full" muted playsInline autoPlay />

        {/* Marco de scan */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-72 h-72 max-w-[80vw] max-h-[60vh] border-4 border-brand-400 rounded-2xl shadow-[0_0_0_9999px_rgba(0,0,0,0.4)] relative">
            {/* Corners */}
            <div className="absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 border-brand-300 rounded-tl-xl" />
            <div className="absolute -top-1 -right-1 w-6 h-6 border-t-4 border-r-4 border-brand-300 rounded-tr-xl" />
            <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-4 border-l-4 border-brand-300 rounded-bl-xl" />
            <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-4 border-r-4 border-brand-300 rounded-br-xl" />
            {/* Linea animada */}
            <div className="absolute inset-x-4 top-1/2 h-0.5 bg-brand-400 shadow-[0_0_8px_rgba(0,184,224,0.8)] animate-pulse" />
          </div>
        </div>

        {starting && (
          <div className="absolute bottom-24 left-1/2 -translate-x-1/2 text-white text-sm bg-black/60 px-4 py-2 rounded-full">
            Iniciando cámara...
          </div>
        )}
        {lastDetected && (
          <div className="absolute bottom-24 left-1/2 -translate-x-1/2 text-white bg-green-600 px-4 py-2 rounded-full shadow-lg">
            ✓ <span className="font-mono ml-2">{lastDetected}</span>
          </div>
        )}
      </div>
      )}

      {/* Footer */}
      <div className="bg-surface-900 text-white px-4 py-3 space-y-2" onClick={(e) => e.stopPropagation()}>
        {error && <p className="text-red-400 text-sm">{error}</p>}
        <form onSubmit={handleManualSubmit} className="flex gap-2">
          <input
            value={manualCode}
            onChange={(e) => setManualCode(e.target.value)}
            placeholder="O ingresa el código manualmente..."
            className="flex-1 bg-surface-800 text-white border border-surface-700 rounded-lg px-4 py-2 text-sm placeholder:text-surface-500"
          />
          <button type="submit" disabled={!manualCode.trim()}
            className="px-4 py-2 bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white rounded-lg text-sm font-medium">
            Usar
          </button>
        </form>
        <p className="text-xs text-surface-500 text-center">
          Soporta QR · EAN-13 · UPC · Code 128 · Code 39 · Data Matrix · PDF-417
        </p>
      </div>
    </div>
  );
}
