'use client';

import React, { useRef, useState, useCallback, useEffect } from 'react';
import { Camera, X, RefreshCw, Check, AlertTriangle } from 'lucide-react';
import { Button } from './Button';
import { Alert } from './Alert';

interface CameraCaptureProps {
  onCapture: (file: File) => void;
  onClear: () => void;
}

export function CameraCapture({ onCapture, onClear }: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);

  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  }, [stream]);

  const startCamera = async () => {
    setError(null);
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } }
      });
      setStream(mediaStream);
    } catch (err: unknown) {
      console.error('Camera access error:', err);
      // Fallback: try without any specific constraints
      try {
        const fallbackStream = await navigator.mediaDevices.getUserMedia({ video: true });
        setStream(fallbackStream);
      } catch (fallbackErr) {
        console.error('Camera fallback error:', fallbackErr);
        setError('Camera access denied or unavailable. Please check your browser permissions.');
      }
    }
  };

  // Fix for React race condition: Assign srcObject *after* video renders
  useEffect(() => {
    if (stream && videoRef.current) {
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch(e => {
        console.error('Video play error:', e);
        setError('Camera feed could not play automatically. Please check browser autoplay settings.');
      });
    }
  }, [stream]);

  useEffect(() => {
    // Cleanup on unmount
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    
    setError(null);
    setIsCapturing(true);
    
    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    // Ensure video has dimensions
    if (video.videoWidth === 0 || video.videoHeight === 0) {
      setError('Camera is not ready or has zero dimensions. Please wait or reload.');
      setIsCapturing(false);
      return;
    }
    
    // Set canvas dimensions to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      setError('Browser canvas context not supported.');
      setIsCapturing(false);
      return;
    }
    
    // Draw the current video frame to the canvas
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    // BLANK FRAME DETECTION
    const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    let isBlank = true;
    // Check every 40th pixel to be fast. If any pixel has R, G, or B > 5, it's not completely black.
    for (let i = 0; i < pixels.length; i += 40) {
      if (pixels[i] > 5 || pixels[i+1] > 5 || pixels[i+2] > 5) {
        isBlank = false;
        break;
      }
    }
    
    if (isBlank) {
      setError('Captured image is completely black. Your camera might be covered, or the browser is failing to render the video feed. Please try again.');
      setIsCapturing(false);
      return;
    }
    
    // Convert to Data URL for immediate preview
    const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
    setCapturedImage(dataUrl);
    
    // Convert to Blob for upload
    canvas.toBlob((blob) => {
      if (blob) {
        // Create a File object from the Blob
        const file = new File([blob], `harvest-${Date.now()}.jpg`, { type: 'image/jpeg' });
        onCapture(file);
      }
      setIsCapturing(false);
      stopCamera(); // Stop the live feed once captured
    }, 'image/jpeg', 0.8);
  };

  const retakePhoto = () => {
    setCapturedImage(null);
    onClear();
    startCamera();
  };

  return (
    <div className="w-full bg-black/5 rounded-lg border border-border p-4">
      {error && (
        <Alert variant="error" className="mb-4">
          <div className="flex items-start">
            <AlertTriangle className="h-5 w-5 mr-2 shrink-0" />
            <span>{error}</span>
          </div>
        </Alert>
      )}

      {!stream && !capturedImage && (
        <div className="text-center py-8">
          <Camera className="mx-auto h-12 w-12 text-foreground-muted mb-4 opacity-50" />
          <p className="mb-4 text-sm text-foreground-muted">Live camera capture is required for harvest authenticity.</p>
          <Button type="button" onClick={startCamera}>
            Open Camera
          </Button>
        </div>
      )}

      {/* Hidden Canvas for processing */}
      <canvas ref={canvasRef} className="hidden" />

      {stream && !capturedImage && (
        <div className="relative rounded-lg overflow-hidden bg-black aspect-video flex items-center justify-center">
          <video 
            ref={videoRef}
            autoPlay 
            playsInline 
            muted 
            className="w-full h-full object-cover min-h-[200px]"
          />
          
          <div className="absolute bottom-4 left-0 right-0 flex justify-center space-x-4">
            <Button 
              type="button" 
              variant="danger" 
              size="sm"
              onClick={stopCamera}
              className="rounded-full shadow-lg"
            >
              <X size={16} className="mr-2" /> Cancel
            </Button>
            <Button 
              type="button" 
              onClick={capturePhoto}
              disabled={isCapturing}
              className="rounded-full shadow-lg"
            >
              <Camera size={16} className="mr-2" /> 
              {isCapturing ? 'Capturing...' : 'Capture Photo'}
            </Button>
          </div>
        </div>
      )}

      {capturedImage && (
        <div className="relative rounded-lg overflow-hidden bg-black aspect-video flex items-center justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={capturedImage} alt="Captured harvest" className="w-full h-full object-cover" />
          
          <div className="absolute top-4 right-4 bg-green-500 text-white p-2 rounded-full shadow-lg">
            <Check size={20} />
          </div>
          
          <div className="absolute bottom-4 left-0 right-0 flex justify-center">
            <Button 
              type="button" 
              variant="secondary" 
              onClick={retakePhoto}
              className="rounded-full shadow-lg"
            >
              <RefreshCw size={16} className="mr-2" /> Retake Photo
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
