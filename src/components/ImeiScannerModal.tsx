import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { X, Flashlight, Camera, AlertCircle, Sparkles, RefreshCw } from 'lucide-react';
import { playBeep } from '../lib/audio';

interface ImeiScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScanSuccess: (scannedValue: string) => void;
  title?: string;
  subtitle?: string;
}

export const ImeiScannerModal: React.FC<ImeiScannerModalProps> = ({
  isOpen,
  onClose,
  onScanSuccess,
  title = 'Barcode / IMEI Scanner',
  subtitle = 'Align barcode or QR code in frame'
}) => {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [hasTorch, setHasTorch] = useState<boolean>(false);
  const [torchOn, setTorchOn] = useState<boolean>(false);
  const [cameras, setCameras] = useState<{ id: string; label: string }[]>([]);
  const [activeCameraId, setActiveCameraId] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState<boolean>(true);

  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const isScannerRunningRef = useRef<boolean>(false);

  // Stop scanner utility
  const stopScanner = async () => {
    if (html5QrCodeRef.current && isScannerRunningRef.current) {
      try {
        await html5QrCodeRef.current.stop();
        isScannerRunningRef.current = false;
      } catch {
        // Ignored if already stopping
      }
    }
  };

  useEffect(() => {
    if (!isOpen) {
      stopScanner();
      return;
    }

    let isMounted = true;
    setIsStarting(true);
    setErrorMessage(null);

    const initScanner = async () => {
      try {
        const scannerElementId = 'html5-qr-reader';
        const html5QrCode = new Html5Qrcode(scannerElementId, {
          formatsToSupport: [
            Html5QrcodeSupportedFormats.CODE_128,
            Html5QrcodeSupportedFormats.CODE_39,
            Html5QrcodeSupportedFormats.EAN_13,
            Html5QrcodeSupportedFormats.UPC_A,
            Html5QrcodeSupportedFormats.QR_CODE,
            Html5QrcodeSupportedFormats.DATA_MATRIX
          ],
          verbose: false
        });

        html5QrCodeRef.current = html5QrCode;

        // Discover cameras
        const devices = await Html5Qrcode.getCameras();
        if (!isMounted) return;

        if (devices && devices.length > 0) {
          setCameras(devices.map((d) => ({ id: d.id, label: d.label || `Camera ${d.id}` })));
          // Prefer back / environment camera
          const backCam = devices.find((d) =>
            d.label.toLowerCase().includes('back') ||
            d.label.toLowerCase().includes('rear') ||
            d.label.toLowerCase().includes('environment')
          );
          const chosenCamId = backCam ? backCam.id : devices[0].id;
          setActiveCameraId(chosenCamId);

          await startScanning(html5QrCode, chosenCamId);
        } else {
          // Fallback to direct environment facing mode
          await startScanningWithFacingMode(html5QrCode);
        }
      } catch (err: unknown) {
        if (!isMounted) return;
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes('Permission denied') || msg.includes('NotAllowedError')) {
          setErrorMessage('Camera access was denied. Please allow camera permissions in your browser settings.');
        } else {
          setErrorMessage('Camera could not be started: ' + msg);
        }
        setIsStarting(false);
      }
    };

    const startScanning = async (scanner: Html5Qrcode, cameraId: string) => {
      try {
        await scanner.start(
          cameraId,
          {
            fps: 15,
            qrbox: { width: 280, height: 160 },
            aspectRatio: 1.3333
          },
          (decodedText) => {
            handleSuccessfulScan(decodedText);
          },
          () => {
            // Frame error - normal while scanning
          }
        );
        isScannerRunningRef.current = true;
        setIsStarting(false);
        checkTorchSupport();
      } catch {
        // Try fallback facing mode
        await startScanningWithFacingMode(scanner);
      }
    };

    const startScanningWithFacingMode = async (scanner: Html5Qrcode) => {
      try {
        await scanner.start(
          { facingMode: 'environment' },
          {
            fps: 15,
            qrbox: { width: 280, height: 160 },
            aspectRatio: 1.3333
          },
          (decodedText) => {
            handleSuccessfulScan(decodedText);
          },
          () => {}
        );
        isScannerRunningRef.current = true;
        setIsStarting(false);
        checkTorchSupport();
      } catch (err: unknown) {
        if (!isMounted) return;
        const msg = err instanceof Error ? err.message : String(err);
        setErrorMessage('Unable to start camera stream. ' + msg);
        setIsStarting(false);
      }
    };

    const checkTorchSupport = () => {
      try {
        const videoElement = document.querySelector('#html5-qr-reader video') as HTMLVideoElement | null;
        if (videoElement && videoElement.srcObject) {
          const track = (videoElement.srcObject as MediaStream).getVideoTracks()[0];
          const capabilities = track.getCapabilities?.() as unknown as { torch?: boolean };
          if (capabilities && capabilities.torch) {
            setHasTorch(true);
          }
        }
      } catch {
        // Torch capability check not supported
      }
    };

    initScanner();

    return () => {
      isMounted = false;
      stopScanner();
    };
  }, [isOpen]);

  const handleSuccessfulScan = async (rawCode: string) => {
    // Clean string: remove extra spaces or carriage returns
    const cleaned = rawCode.trim().replace(/[\r\n\t]/g, '');
    playBeep('scan');
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(80);
      } catch {
        // Ignore
      }
    }
    await stopScanner();
    onScanSuccess(cleaned);
    onClose();
  };

  const toggleTorch = async () => {
    try {
      const videoElement = document.querySelector('#html5-qr-reader video') as HTMLVideoElement | null;
      if (videoElement && videoElement.srcObject) {
        const track = (videoElement.srcObject as MediaStream).getVideoTracks()[0];
        const nextTorch = !torchOn;
        await track.applyConstraints({
          advanced: [{ torch: nextTorch } as MediaTrackConstraintSet]
        });
        setTorchOn(nextTorch);
      }
    } catch {
      // Failed to toggle torch
    }
  };

  const switchCamera = async () => {
    if (cameras.length <= 1 || !html5QrCodeRef.current) return;
    const currentIndex = cameras.findIndex((c) => c.id === activeCameraId);
    const nextIndex = (currentIndex + 1) % cameras.length;
    const nextCamera = cameras[nextIndex];

    await stopScanner();
    setActiveCameraId(nextCamera.id);
    setIsStarting(true);

    try {
      await html5QrCodeRef.current.start(
        nextCamera.id,
        {
          fps: 15,
          qrbox: { width: 280, height: 160 },
          aspectRatio: 1.3333
        },
        (decodedText) => {
          handleSuccessfulScan(decodedText);
        },
        () => {}
      );
      isScannerRunningRef.current = true;
      setIsStarting(false);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to switch camera');
      setIsStarting(false);
    }
  };

  // Quick simulated scan for desktop/demo testing
  const handleSimulateScan = (sampleImei: string) => {
    handleSuccessfulScan(sampleImei);
  };

  if (!isOpen) return null;

  return (
    <div
      id="imei-scanner-modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 sm:p-6"
    >
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3.5 bg-slate-950/60">
          <div className="flex items-center space-x-2.5">
            <div className="p-1.5 rounded-lg bg-blue-500/20 text-blue-400">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white leading-tight">{title}</h3>
              <p className="text-xs text-slate-400">{subtitle}</p>
            </div>
          </div>
          <button
            id="close-scanner-button"
            type="button"
            onClick={async () => {
              await stopScanner();
              onClose();
            }}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Viewfinder Canvas Area */}
        <div className="relative flex-1 bg-black flex items-center justify-center min-h-[300px] overflow-hidden">
          {/* Reader Target Element for html5-qrcode */}
          <div id="html5-qr-reader" className="w-full h-full min-h-[280px]" />

          {/* Scanner Overlay Graphics */}
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="relative w-[280px] h-[160px] rounded-lg border-2 border-dashed border-blue-400/70 shadow-[0_0_20px_rgba(59,130,246,0.3)]">
              {/* Corner brackets */}
              <div className="absolute -top-1 -left-1 w-5 h-5 border-t-4 border-l-4 border-blue-500 rounded-tl" />
              <div className="absolute -top-1 -right-1 w-5 h-5 border-t-4 border-r-4 border-blue-500 rounded-tr" />
              <div className="absolute -bottom-1 -left-1 w-5 h-5 border-b-4 border-l-4 border-blue-500 rounded-bl" />
              <div className="absolute -bottom-1 -right-1 w-5 h-5 border-b-4 border-r-4 border-blue-500 rounded-br" />

              {/* Red/Cyan Laser Scan line */}
              <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-0.5 bg-gradient-to-r from-transparent via-red-500 to-transparent shadow-[0_0_12px_#ef4444] animate-pulse" />
            </div>
          </div>

          {/* Loading Spinner */}
          {isStarting && !errorMessage && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/80 backdrop-blur-xs text-slate-300">
              <RefreshCw className="w-8 h-8 animate-spin text-blue-400 mb-2" />
              <p className="text-sm font-medium">Initializing camera...</p>
            </div>
          )}

          {/* Error Banner */}
          {errorMessage && (
            <div className="absolute inset-4 flex flex-col items-center justify-center text-center p-6 bg-slate-900/95 border border-red-500/30 rounded-xl text-red-300">
              <AlertCircle className="w-10 h-10 text-red-400 mb-3" />
              <p className="text-sm font-medium text-slate-200 mb-2">Camera Unavailable</p>
              <p className="text-xs text-slate-400 max-w-xs mb-4">{errorMessage}</p>
              <p className="text-xs text-amber-400 font-medium">You can still type the IMEI manually or use demo test samples below.</p>
            </div>
          )}
        </div>

        {/* Action Controls Bar */}
        <div className="p-3 bg-slate-950/90 border-t border-slate-800 space-y-2.5">
          <div className="flex items-center justify-between text-xs text-slate-400 px-1">
            <span>Supports 1D Barcodes & QR Codes</span>
            <div className="flex items-center space-x-2">
              {cameras.length > 1 && (
                <button
                  type="button"
                  onClick={switchCamera}
                  className="flex items-center space-x-1 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Switch</span>
                </button>
              )}
              {hasTorch && (
                <button
                  type="button"
                  onClick={toggleTorch}
                  className={`flex items-center space-x-1 px-2.5 py-1 rounded ${
                    torchOn ? 'bg-amber-500 text-slate-950 font-medium' : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                  }`}
                >
                  <Flashlight className="w-3.5 h-3.5" />
                  <span>{torchOn ? 'Torch On' : 'Torch'}</span>
                </button>
              )}
            </div>
          </div>

          {/* Demo/Fallback Scanner Simulator Pills for fast testing */}
          <div className="bg-slate-900/80 p-2 rounded-xl border border-slate-800/80">
            <div className="flex items-center space-x-1.5 text-[11px] text-slate-400 mb-1.5">
              <Sparkles className="w-3.5 h-3.5 text-blue-400" />
              <span>Simulate Scan (or scan physical barcode):</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => handleSimulateScan('860472051239841')}
                className="px-2 py-1 rounded text-[11px] font-mono bg-blue-950/60 hover:bg-blue-900 border border-blue-800/60 text-blue-300 transition-colors"
              >
                860472051239841
              </button>
              <button
                type="button"
                onClick={() => handleSimulateScan('358941094821035')}
                className="px-2 py-1 rounded text-[11px] font-mono bg-blue-950/60 hover:bg-blue-900 border border-blue-800/60 text-blue-300 transition-colors"
              >
                358941094821035
              </button>
              <button
                type="button"
                onClick={() => handleSimulateScan('990000862471902')}
                className="px-2 py-1 rounded text-[11px] font-mono bg-blue-950/60 hover:bg-blue-900 border border-blue-800/60 text-blue-300 transition-colors"
              >
                990000862471902
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
