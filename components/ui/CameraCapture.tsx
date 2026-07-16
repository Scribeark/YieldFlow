'use client';

import { useState, useRef, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Camera, RefreshCw, Upload, ImageIcon, X, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';

interface CameraCaptureProps {
  bucketName: string; // e.g. 'harvest-photos' or 'vehicle-photos'
  onCapture: (publicUrl: string) => void;
  existingUrl?: string;
  label?: string;
}

type CaptureState = 'idle' | 'streaming' | 'captured' | 'uploading';

export default function CameraCapture({
  bucketName,
  onCapture,
  existingUrl = '',
  label = 'Capture Verification Photo',
}: CameraCaptureProps) {
  const [state, setState] = useState<CaptureState>(existingUrl ? 'captured' : 'idle');
  const [photoUrl, setPhotoUrl] = useState<string>(existingUrl);
  const [error, setError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<string>('');

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Stop camera stream on unmount or state change
  const stopStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  };

  useEffect(() => {
    return () => stopStream();
  }, []);

  // 1. Start live camera stream (prefer environment/rear camera for mobile PWA)
  const startCamera = async () => {
    setError(null);
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        // Fallback directly to file input capture if getUserMedia isn't supported
        fileInputRef.current?.click();
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      setState('streaming');
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } catch (err: any) {
      console.warn('Camera access error or denied, falling back to OS file/camera picker:', err);
      // If permission denied or device error, fallback cleanly to OS native picker (<input capture="environment">)
      fileInputRef.current?.click();
    }
  };

  // 2. Take photo snapshot from video element
  const takeSnapshot = async () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    stopStream();

    canvas.toBlob(async (blob) => {
      if (!blob) {
        setError('Failed to process image snapshot.');
        setState('idle');
        return;
      }
      await handleBlobUpload(blob);
    }, 'image/jpeg', 0.85);
  };

  // 3. Handle file selection from OS native picker fallback (<input type="file" capture="environment">)
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await handleBlobUpload(file);
  };

  // 4. Upload Blob/File directly to Supabase Storage
  const handleBlobUpload = async (blob: Blob | File) => {
    setState('uploading');
    setError(null);
    setUploadProgress('Compressing & preparing image...');

    try {
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}.jpg`;
      const filePath = `${fileName}`;

      setUploadProgress(`Uploading to Supabase bucket (${bucketName})...`);

      const { data, error: uploadError } = await supabase.storage
        .from(bucketName)
        .upload(filePath, blob, {
          cacheControl: '3600',
          upsert: false,
          contentType: blob.type || 'image/jpeg',
        });

      if (uploadError) {
        // If bucket doesn't exist yet or RLS blocks upload, throw clean message
        throw new Error(`Upload error: ${uploadError.message}. Ensure bucket "${bucketName}" is public.`);
      }

      const { data: publicUrlData } = supabase.storage.from(bucketName).getPublicUrl(filePath);
      const url = publicUrlData?.publicUrl || '';

      setPhotoUrl(url);
      setState('captured');
      onCapture(url);
    } catch (err: any) {
      console.error('Storage upload failed:', err);
      setError(err.message || 'Image upload failed. Please try again.');
      setState('idle');
    }
  };

  // 5. Retake / Clear
  const handleRetake = () => {
    stopStream();
    setPhotoUrl('');
    onCapture('');
    setState('idle');
  };

  return (
    <div className="space-y-3 rounded-xl border border-border bg-background-card p-4">
      {/* Header / Label */}
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold uppercase tracking-wider text-foreground-dim flex items-center gap-2">
          <Camera size={14} className="text-agri-primary-light" />
          <span>{label}</span>
        </label>
        {photoUrl && state === 'captured' && (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 size={10} /> Verified Capture
          </span>
        )}
      </div>

      {/* Hidden OS Native File/Camera Input Fallback */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileSelect}
        className="hidden"
      />

      {/* Error Banner */}
      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-2.5 text-xs text-red-400">
          <AlertCircle size={14} className="mt-0.5 shrink-0" />
          <div className="flex-1">
            <p className="font-semibold">Capture Failed</p>
            <p className="text-[11px] opacity-90">{error}</p>
          </div>
        </div>
      )}

      {/* STATE 1: Idle (Button to trigger live camera or OS picker) */}
      {state === 'idle' && (
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            type="button"
            onClick={startCamera}
            className="flex-1 flex items-center justify-center gap-2.5 rounded-xl border-2 border-dashed border-agri-primary/40 bg-agri-primary/5 py-6 text-sm font-semibold text-agri-primary-light transition-all hover:border-agri-primary hover:bg-agri-primary/10 active:scale-[0.99]"
          >
            <Camera size={20} className="animate-pulse" />
            <span>Launch Live PWA Camera</span>
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="sm:w-44 flex items-center justify-center gap-2 rounded-xl border border-border bg-background-elevated px-4 py-4 text-xs font-medium text-foreground-muted hover:bg-background/80 hover:text-foreground transition-all"
          >
            <Upload size={16} />
            <span>Upload File</span>
          </button>
        </div>
      )}

      {/* STATE 2: Streaming (Live Video Feed + Snapshot Canvas) */}
      {state === 'streaming' && (
        <div className="relative overflow-hidden rounded-xl bg-black border border-agri-primary/30">
          <video
            ref={videoRef}
            playsInline
            muted
            className="max-h-[360px] w-full object-cover mx-auto"
          />
          <canvas ref={canvasRef} className="hidden" />

          {/* Camera Controls Overlay */}
          <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-black/80 via-black/40 to-transparent p-4">
            <button
              type="button"
              onClick={() => { stopStream(); setState('idle'); }}
              className="rounded-lg bg-red-500/20 px-3 py-1.5 text-xs font-semibold text-red-300 backdrop-blur-md hover:bg-red-500/30 border border-red-500/30 flex items-center gap-1.5"
            >
              <X size={14} /> Cancel
            </button>
            <button
              type="button"
              onClick={takeSnapshot}
              className="flex items-center gap-2 rounded-full bg-agri-primary px-6 py-2.5 text-sm font-bold text-white shadow-lg shadow-agri-primary/40 hover:bg-agri-primary-light active:scale-95 transition-all"
            >
              <Camera size={18} /> Take Snapshot
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="rounded-lg bg-white/10 px-3 py-1.5 text-xs font-medium text-white backdrop-blur-md hover:bg-white/20 flex items-center gap-1.5"
            >
              <ImageIcon size={14} /> Gallery
            </button>
          </div>
        </div>
      )}

      {/* STATE 3: Uploading */}
      {state === 'uploading' && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-background-elevated p-8 text-center">
          <Loader2 size={28} className="animate-spin text-agri-primary-light mb-3" />
          <p className="text-sm font-semibold text-foreground">Processing Harvest Verification</p>
          <p className="text-xs text-foreground-dim mt-1">{uploadProgress}</p>
        </div>
      )}

      {/* STATE 4: Captured (Preview & Retake) */}
      {state === 'captured' && photoUrl && (
        <div className="relative overflow-hidden rounded-xl border border-border bg-background-elevated">
          <img
            src={photoUrl}
            alt="Verified Capture Preview"
            className="max-h-[280px] w-full object-cover"
          />
          <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-black/80 via-black/40 to-transparent p-3">
            <span className="text-[11px] font-medium text-white/80 truncate max-w-[200px]">
              {photoUrl.split('/').pop()}
            </span>
            <button
              type="button"
              onClick={handleRetake}
              className="flex items-center gap-1.5 rounded-lg bg-black/60 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur-md hover:bg-black/80 border border-white/20 transition-all"
            >
              <RefreshCw size={12} /> Retake Photo
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
