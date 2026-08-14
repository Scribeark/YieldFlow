'use client';

import React, { useState, useRef } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { Camera, Image as ImageIcon, X, Loader2, CheckCircle2, RefreshCw } from 'lucide-react';
import { uploadHarvestPhoto } from '@/lib/supabase/storage';
import { createClient } from '@/lib/supabase/client';

interface HarvestPhotoModalProps {
  isOpen: boolean;
  onClose: () => void;
  listingId: string;
  bidId?: string;
  cropType: string;
  sellerId: string;
  onUploadSuccess: (photoUrl: string) => void;
}

export function HarvestPhotoModal({
  isOpen,
  onClose,
  listingId,
  bidId,
  cropType,
  sellerId,
  onUploadSuccess,
}: HarvestPhotoModalProps) {
  const supabase = createClient();
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const liveInputRef = useRef<HTMLInputElement>(null);
  const deviceInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileChange = (selectedFile: File | null) => {
    setError(null);
    if (!selectedFile) return;

    if (!selectedFile.type.startsWith('image/')) {
      setError('Please select a valid image file (JPG, PNG, WebP).');
      return;
    }

    setFile(selectedFile);
    const objectUrl = URL.createObjectURL(selectedFile);
    setPreviewUrl(objectUrl);
  };

  const handleClear = () => {
    setFile(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setError(null);
    if (liveInputRef.current) liveInputRef.current.value = '';
    if (deviceInputRef.current) deviceInputRef.current.value = '';
  };

  const handleSubmit = async () => {
    if (!file) {
      setError('Please take a photo or select an image file first.');
      return;
    }

    setUploading(true);
    setError(null);
    setSuccess(null);

    try {
      // 1. Upload to Supabase Storage bucket 'harvest-photos'
      const { url: publicUrl, error: uploadError } = await uploadHarvestPhoto(supabase, file, sellerId);
      if (uploadError || !publicUrl) {
        throw new Error(uploadError?.message || 'Failed to upload photo to storage.');
      }

      // 2. Call RPC or update bulk_offtake_listings and harvest_bids
      let rpcSucceeded = false;

      // Try rpc_upload_harvest_evidence if available
      try {
        const { error: rpcErr } = await (supabase as any).rpc('rpc_upload_harvest_evidence', {
          p_listing_id: listingId,
          p_photo_url: publicUrl,
        });
        if (!rpcErr) rpcSucceeded = true;
      } catch (e) {
        console.warn('rpc_upload_harvest_evidence call error:', e);
      }

      // If RPC was not available or as fallback, update records directly
      if (!rpcSucceeded) {
        await (supabase as any)
          .from('bulk_offtake_listings')
          .update({
            harvest_photo_url: publicUrl,
            evidence_status: 'PROVIDED',
            updated_at: new Date().toISOString(),
          })
          .eq('id', listingId);

        if (bidId) {
          await (supabase as any)
            .from('harvest_bids')
            .update({
              buyer_evidence_status: 'PROVIDED',
              updated_at: new Date().toISOString(),
            })
            .eq('id', bidId);
        }
      }

      setSuccess('Harvest Confirmation Photo submitted successfully!');
      setTimeout(() => {
        onUploadSuccess(publicUrl);
        handleClear();
        onClose();
      }, 1200);
    } catch (err: any) {
      console.error('Harvest photo submission error:', err);
      setError(err.message || 'Failed to submit photo. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[9999] p-4 sm:p-6 backdrop-blur-sm">
      <Card className="w-full max-w-lg max-h-[90vh] overflow-y-auto bg-[#131722] border-white/20 shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-4">
          <div className="flex items-center gap-2">
            <Camera className="text-[var(--agri-primary)]" size={20} />
            <h2 className="text-lg font-bold">Harvest Confirmation Photo</h2>
          </div>
          <button
            onClick={onClose}
            disabled={uploading}
            className="p-1 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <p className="text-xs text-gray-300 mb-4">
          Provide a clear photo of your harvested <strong>{cropType}</strong>. The buyer will review this photo to confirm the quality and activate carrier matching.
        </p>

        {error && <Alert variant="error" className="mb-4">{error}</Alert>}
        {success && <Alert variant="success" className="mb-4">{success}</Alert>}

        {/* Hidden File Inputs */}
        <input
          ref={liveInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => handleFileChange(e.target.files?.[0] || null)}
        />
        <input
          ref={deviceInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => handleFileChange(e.target.files?.[0] || null)}
        />

        {/* Photo Selection / Preview Area */}
        {!previewUrl ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
            <button
              type="button"
              onClick={() => liveInputRef.current?.click()}
              className="flex flex-col items-center justify-center p-6 rounded-xl border-2 border-dashed border-white/20 hover:border-[var(--agri-primary)] hover:bg-white/5 transition-all group"
            >
              <div className="p-3 rounded-full bg-[var(--agri-primary)]/10 text-[var(--agri-primary)] mb-2 group-hover:scale-110 transition-transform">
                <Camera size={24} />
              </div>
              <span className="text-sm font-semibold">Take Photo Live</span>
              <span className="text-[11px] opacity-60 mt-1">Use device camera</span>
            </button>

            <button
              type="button"
              onClick={() => deviceInputRef.current?.click()}
              className="flex flex-col items-center justify-center p-6 rounded-xl border-2 border-dashed border-white/20 hover:border-blue-400 hover:bg-white/5 transition-all group"
            >
              <div className="p-3 rounded-full bg-blue-500/10 text-blue-400 mb-2 group-hover:scale-110 transition-transform">
                <ImageIcon size={24} />
              </div>
              <span className="text-sm font-semibold">Choose From Device</span>
              <span className="text-[11px] opacity-60 mt-1">Gallery or files</span>
            </button>
          </div>
        ) : (
          <div className="space-y-3 mb-5">
            <div className="relative rounded-xl overflow-hidden border border-white/20 bg-black/40 max-h-72 flex items-center justify-center">
              <img
                src={previewUrl}
                alt="Harvest Confirmation Preview"
                className="max-h-72 w-auto object-contain rounded-lg"
              />
              <button
                type="button"
                onClick={handleClear}
                disabled={uploading}
                className="absolute top-2 right-2 p-1.5 bg-black/70 hover:bg-black text-white rounded-full transition-colors"
                title="Remove photo"
              >
                <X size={16} />
              </button>
            </div>
            <div className="flex items-center justify-between text-xs opacity-70 px-1">
              <span>{file?.name}</span>
              <button
                type="button"
                onClick={handleClear}
                disabled={uploading}
                className="text-[var(--agri-primary)] hover:underline flex items-center gap-1"
              >
                <RefreshCw size={12} /> Replace photo
              </button>
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-3 border-t border-white/10">
          <Button variant="ghost" type="button" onClick={onClose} disabled={uploading}>
            Cancel
          </Button>
          <Button
            variant="primary"
            type="button"
            onClick={handleSubmit}
            disabled={uploading || !file}
          >
            {uploading ? (
              <>
                <Loader2 size={16} className="animate-spin mr-2" />
                Uploading…
              </>
            ) : (
              <>
                <CheckCircle2 size={16} className="mr-2" />
                Submit Photo
              </>
            )}
          </Button>
        </div>
      </Card>
    </div>
  );
}
