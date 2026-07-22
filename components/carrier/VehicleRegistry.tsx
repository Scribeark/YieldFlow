'use client';

import React, { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/store/authStore';
import { Button } from '@/components/ui/Button';
import Tesseract from 'tesseract.js';
import heic2any from 'heic2any';

// --- OCR Helpers ---

const levenshtein = (a: string, b: string): number => {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  const matrix = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          Math.min(matrix[i][j - 1] + 1, matrix[i - 1][j] + 1)
        );
      }
    }
  }
  return matrix[b.length][a.length];
};

const normalizeOcrText = (text: string) => {
  return text.toUpperCase().replace(/[^A-Z0-9]/g, '')
    .replace(/[OQ]/g, '0')
    .replace(/[IL]/g, '1')
    .replace(/B/g, '8')
    .replace(/S/g, '5')
    .replace(/Z/g, '2');
};

const fuzzyMatchPlate = (ocrText: string, typedPlate: string): boolean => {
  const cleanTyped = typedPlate.replace(/[^A-Z0-9]/gi, '').toUpperCase();
  const cleanTypedNorm = normalizeOcrText(cleanTyped);
  
  const justAlnum = ocrText.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (justAlnum.includes(cleanTyped)) return true;

  const normOcr = normalizeOcrText(ocrText);
  if (normOcr.includes(cleanTypedNorm)) return true;

  if (normOcr.length >= cleanTypedNorm.length) {
    for (let i = 0; i <= normOcr.length - cleanTypedNorm.length; i++) {
      const window = normOcr.substring(i, i + cleanTypedNorm.length);
      if (levenshtein(window, cleanTypedNorm) <= 1) {
        return true;
      }
    }
  }
  return false;
};

const extractDateCandidates = (text: string): string[] => {
  const candidates: string[] = [];
  const cleanText = text.toUpperCase().replace(/\s*([/\-.])\s*/g, '$1');
  
  let match;
  const ymdRegex = /(\d{4})[/\-.](\d{1,2})[/\-.](\d{1,2})/g;
  while ((match = ymdRegex.exec(cleanText)) !== null) {
    candidates.push(`${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`);
  }

  const dmyRegex = /(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})/g;
  while ((match = dmyRegex.exec(cleanText)) !== null) {
    candidates.push(`${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`);
  }

  const monthMap: Record<string, string> = {
    'JANUARY': '01', 'JAN': '01', 'FEBRUARY': '02', 'FEB': '02',
    'MARCH': '03', 'MAR': '03', 'APRIL': '04', 'APR': '04',
    'MAY': '05', 'JUNE': '06', 'JUN': '06',
    'JULY': '07', 'JUL': '07', 'AUGUST': '08', 'AUG': '08',
    'SEPTEMBER': '09', 'SEP': '09', 'OCTOBER': '10', 'OCT': '10',
    'NOVEMBER': '11', 'NOV': '11', 'DECEMBER': '12', 'DEC': '12'
  };

  const textWithNormalizedSpaces = text.toUpperCase().replace(/\s+/g, ' ');
  
  const dMonYRegex = /(\d{1,2})\s*([A-Z]{3,9})\s*(\d{4})/g;
  while ((match = dMonYRegex.exec(textWithNormalizedSpaces)) !== null) {
    const mMatch = Object.keys(monthMap).find(k => match![2].startsWith(k));
    if (mMatch) candidates.push(`${match[3]}-${monthMap[mMatch]}-${match[1].padStart(2, '0')}`);
  }

  const monDYRegex = /([A-Z]{3,9})\s*(\d{1,2})[A-Z]{0,2}\s*[,]?\s*(\d{4})/g;
  while ((match = monDYRegex.exec(textWithNormalizedSpaces)) !== null) {
    const mMatch = Object.keys(monthMap).find(k => match![1].startsWith(k));
    if (mMatch) candidates.push(`${match[3]}-${monthMap[mMatch]}-${match[2].padStart(2, '0')}`);
  }

  return candidates;
};

const normalizePlateNumber = (plate: string) => {
  if (!plate) return '';
  let normalized = plate.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (normalized.length > 3 && !normalized.includes('-')) {
    normalized = normalized.slice(0, 3) + '-' + normalized.slice(3);
  }
  return normalized;
};

const extractLabelledData = (lines: string[]) => {
  let detectedPlate: string | null = null;
  let detectedExpiry: string | null = null;
  let detectedClass: 'Private' | 'Commercial' | 'Not detected' = 'Not detected';

  const plateLabelRegex = /(?:VEHICLE REG\.?\s*NO|REGISTRATION NO|REG\.?\s*NO)/i;
  const expiryLabelRegex = /(?:EXPIRY DATE|EXPIRY|DATE EXPIRES|VALID UNTIL)/i;
  const ignoreDateRegex = /(?:DATE ISSUED|ISSUED ON|ISSUE DATE)/i;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    if (detectedClass === 'Not detected') {
      if (/\bPRIVATE\b/i.test(line)) detectedClass = 'Private';
      else if (/\bCOMMERCIAL\b/i.test(line)) detectedClass = 'Commercial';
    }

    if (!detectedPlate) {
      const inlineMatch = line.match(/(?:VEHICLE REG\.?\s*NO\.?|REGISTRATION NO\.?|REG\.?\s*NO\.?)[\s:]*([A-Z0-9\-]{5,10})/i);
      if (inlineMatch && inlineMatch[1] && inlineMatch[1].replace(/[^A-Z0-9]/g, '').length >= 5) {
        detectedPlate = inlineMatch[1].replace(/\s+/g, '');
      } else if (plateLabelRegex.test(line)) {
        for (let j = 1; j <= 2; j++) {
          if (lines[i+j] && /^[A-Z0-9\-]{5,10}$/i.test(lines[i+j].replace(/\s+/g, ''))) {
            detectedPlate = lines[i+j].replace(/\s+/g, '');
            break;
          }
        }
      }
    }

    if (!detectedExpiry && !ignoreDateRegex.test(line)) {
      const inlineMatch = line.match(/(?:EXPIRY DATE|EXPIRY|DATE EXPIRES|VALID UNTIL)[\s:]*(.*)/i);
      if (inlineMatch && inlineMatch[1].trim()) {
        const candidates = extractDateCandidates(inlineMatch[1]);
        if (candidates.length > 0) detectedExpiry = candidates[0];
      } else if (expiryLabelRegex.test(line)) {
        for (let j = 1; j <= 2; j++) {
          if (lines[i+j] && !ignoreDateRegex.test(lines[i+j])) {
            const candidates = extractDateCandidates(lines[i+j]);
            if (candidates.length > 0) {
              detectedExpiry = candidates[0];
              break;
            }
          }
        }
      }
    }
  }

  return { detectedPlate, detectedExpiry, detectedClass };
};

const generateImageVariant = (file: File, rotation: number, applyContrast: boolean): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject('No canvas context');

      const MAX_DIM = 1800;
      let width = img.width;
      let height = img.height;
      
      if (width > MAX_DIM || height > MAX_DIM) {
        if (width > height) {
          height = Math.round((height * MAX_DIM) / width);
          width = MAX_DIM;
        } else {
          width = Math.round((width * MAX_DIM) / height);
          height = MAX_DIM;
        }
      }

      if (rotation === 90 || rotation === 270) {
        canvas.width = height;
        canvas.height = width;
      } else {
        canvas.width = width;
        canvas.height = height;
      }

      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate((rotation * Math.PI) / 180);
      ctx.drawImage(img, -width / 2, -height / 2, width, height);

      if (applyContrast) {
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        const contrast = 1.5; 
        const intercept = 128 * (1 - contrast);
        for (let i = 0; i < data.length; i += 4) {
          const avg = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
          let val = avg * contrast + intercept;
          val = val > 255 ? 255 : val < 0 ? 0 : val;
          val = val > 128 ? 255 : 0; // threshold
          data[i] = val;
          data[i + 1] = val;
          data[i + 2] = val;
        }
        ctx.putImageData(imageData, 0, 0);
      }

      resolve(canvas.toDataURL('image/jpeg', 0.9));
    };
    img.onerror = reject;
    img.src = url;
  });
};

const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = error => reject(error);
  });
};

export default function VehicleRegistry({ onRegistered }: { onRegistered?: () => void }) {
  const { profile } = useAuthStore();
  const supabase = createClient();
  
  const [ocrStage, setOcrStage] = useState<'IDLE' | 'PROCESSING' | 'REVIEW' | 'REVIEW_FAILED'>('IDLE');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ocrStatus, setOcrStatus] = useState<string>('');
  
  const [vehicleType, setVehicleType] = useState<string>('Motorcycle');
  const [plateNumber, setPlateNumber] = useState('');
  const [nickname, setNickname] = useState('');
  const [capacity, setCapacity] = useState<number>(50);
  const [expiryDate, setExpiryDate] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [documentFiles, setDocumentFiles] = useState<File[]>([]);

  const [processedFileState, setProcessedFileState] = useState<File | null>(null);
  const [processedDocsState, setProcessedDocsState] = useState<File[]>([]);
  
  const [detectedPlate, setDetectedPlate] = useState<string | null>(null);
  const [detectedExpiry, setDetectedExpiry] = useState<string | null>(null);
  const [detectedClass, setDetectedClass] = useState<'Private' | 'Commercial' | 'Not detected'>('Not detected');

  const handleDocumentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setDocumentFiles(Array.from(e.target.files));
      setOcrStage('IDLE');
    }
  };

  const processImageFile = async (f: File): Promise<File> => {
    const isHeic = f.type === 'image/heic' || f.type === 'image/heif' || 
                   f.name.toLowerCase().endsWith('.heic') || f.name.toLowerCase().endsWith('.heif');
    if (!isHeic) return f;
    try {
      const convertedBlob = await heic2any({ blob: f, toType: 'image/jpeg', quality: 0.8 });
      const blobToUse = Array.isArray(convertedBlob) ? convertedBlob[0] : convertedBlob;
      return new File([blobToUse], f.name.replace(/\.heic$|\.heif$/i, '.jpeg'), { type: 'image/jpeg' });
    } catch (err) {
      console.error("HEIC conversion error", err);
      throw new Error('Could not process this HEIC/HEIF image. Please upload a JPG, PNG, or clearer image.');
    }
  };

  const runOcrPipeline = async () => {
    if (!file) throw new Error('Please upload a vehicle photo.');
    if (documentFiles.length === 0) throw new Error('Please upload vehicle particulars/licence document images.');
    if (documentFiles.length > 4) throw new Error('Upload a maximum of 4 vehicle document images.');
    if (!expiryDate) throw new Error('Please provide the vehicle license expiry date.');
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const enteredDate = new Date(expiryDate);
    if (enteredDate < today) {
      throw new Error('The vehicle license is expired. Registration requires a valid, unexpired license.');
    }

    const plateRegex = /^[A-Z]{3}-?\d{3}[A-Z]{2}$/i;
    if (!plateRegex.test(plateNumber.trim())) {
      throw new Error('Enter a valid Nigerian plate number in the format ABC-123DE.');
    }

    const normalizedEnteredPlate = normalizePlateNumber(plateNumber);
    setOcrStatus('Processing vehicle document...');

    const pFile = await processImageFile(file);
    const pDocs: File[] = [];
    for (const doc of documentFiles) {
      pDocs.push(await processImageFile(doc));
    }
    setProcessedFileState(pFile);
    setProcessedDocsState(pDocs);

    setOcrStatus('Reading document details...');
    
    let foundMatchingPlate = false;
    let foundMatchingExpiry = false;
    let finalDetectedPlate: string | null = null;
    let finalDetectedExpiry: string | null = null;
    let finalDetectedClass: 'Private' | 'Commercial' | 'Not detected' = 'Not detected';

    // 1. Try Google Cloud Vision API
    try {
      const base64Docs = await Promise.all(pDocs.map(f => fileToBase64(f)));
      const response = await fetch('/api/vehicle-document-ocr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ images: base64Docs })
      });
      const data = await response.json();

      if (!data.fallback && data.results) {
        for (const res of data.results) {
          if (!res.lines || res.lines.length === 0) continue;
          
          const extraction = extractLabelledData(res.lines);
          if (extraction.detectedClass !== 'Not detected') finalDetectedClass = extraction.detectedClass;
          
          if (extraction.detectedPlate) {
            const normFound = normalizePlateNumber(extraction.detectedPlate);
            finalDetectedPlate = normFound;
            if (normFound === normalizedEnteredPlate || fuzzyMatchPlate(normFound, normalizedEnteredPlate)) {
              foundMatchingPlate = true;
            }
          }

          if (extraction.detectedExpiry) {
            finalDetectedExpiry = extraction.detectedExpiry;
            if (extraction.detectedExpiry === expiryDate) {
              foundMatchingExpiry = true;
            }
          }
          
          // Fallback to fuzzy text search if label search failed
          if (!foundMatchingPlate) {
            if (fuzzyMatchPlate(res.fullText, normalizedEnteredPlate)) {
              foundMatchingPlate = true;
              finalDetectedPlate = normalizedEnteredPlate; // Override for display
            } else if (/[A-Z]{3}-?\d{3}[A-Z]{2}/gi.test(res.fullText.replace(/\s+/g, ''))) {
              // Plate format found but not matching, keeping for structure completeness
            }
          }

          if (!foundMatchingExpiry) {
            const candidates = extractDateCandidates(res.fullText);
            if (candidates.length > 0) {
              if (candidates.includes(expiryDate)) {
                foundMatchingExpiry = true;
                finalDetectedExpiry = expiryDate; // Override for display
              } else if (!finalDetectedExpiry) {
                finalDetectedExpiry = candidates[0];
              }
            }
          }
        }

        // If Cloud Vision succeeded in returning results, we skip Tesseract
        finalizeOcrResults(
          normalizedEnteredPlate, expiryDate,
          foundMatchingPlate, foundMatchingExpiry,
          finalDetectedPlate, finalDetectedExpiry, finalDetectedClass
        );
        return;
      }
    } catch (err) {
      console.warn('Cloud Vision failed, falling back to Tesseract', err);
    }

    // 2. Fallback to Tesseract.js if Cloud Vision failed or returned fallback
    setOcrStatus('Checking plate number and expiry date...');
    const variants = [
      { r: 0, c: false },
      { r: 0, c: true },
      { r: 90, c: false },
      { r: 180, c: false },
      { r: 270, c: false }
    ];

    for (let i = 0; i < pDocs.length; i++) {
      const docFile = pDocs[i];
      for (const variant of variants) {
        if (foundMatchingPlate && foundMatchingExpiry && finalDetectedClass !== 'Not detected') break;
        
        const dataUrl = await generateImageVariant(docFile, variant.r, variant.c);
        const result = await Tesseract.recognize(dataUrl, 'eng');
        const text = result.data.text;
        const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

        const extraction = extractLabelledData(lines);
        if (extraction.detectedClass !== 'Not detected') finalDetectedClass = extraction.detectedClass;

        if (!foundMatchingPlate) {
          if (extraction.detectedPlate) {
            const normFound = normalizePlateNumber(extraction.detectedPlate);
            finalDetectedPlate = normFound;
            if (normFound === normalizedEnteredPlate || fuzzyMatchPlate(normFound, normalizedEnteredPlate)) {
              foundMatchingPlate = true;
            }
          }
          if (!foundMatchingPlate) {
            if (fuzzyMatchPlate(text, normalizedEnteredPlate)) {
              foundMatchingPlate = true;
              finalDetectedPlate = normalizedEnteredPlate;
            } else if (/[A-Z]{3}-?\d{3}[A-Z]{2}/gi.test(text.replace(/\s+/g, ''))) {
              // Plate format found but not matching
            }
          }
        }

        if (!foundMatchingExpiry) {
          if (extraction.detectedExpiry) {
            finalDetectedExpiry = extraction.detectedExpiry;
            if (extraction.detectedExpiry === expiryDate) {
              foundMatchingExpiry = true;
            }
          }
          if (!foundMatchingExpiry) {
            const candidates = extractDateCandidates(text);
            if (candidates.length > 0) {
              if (candidates.includes(expiryDate)) {
                foundMatchingExpiry = true;
                finalDetectedExpiry = expiryDate;
              } else if (!finalDetectedExpiry) {
                finalDetectedExpiry = candidates[0];
              }
            }
          }
        }
      }
      if (foundMatchingPlate && foundMatchingExpiry && finalDetectedClass !== 'Not detected') break;
    }

    finalizeOcrResults(
      normalizedEnteredPlate, expiryDate,
      foundMatchingPlate, foundMatchingExpiry,
      finalDetectedPlate, finalDetectedExpiry, finalDetectedClass
    );
  };

  const finalizeOcrResults = (
    normalizedEnteredPlate: string, 
    enteredExpiryDate: string,
    foundMatchingPlate: boolean, 
    foundMatchingExpiry: boolean,
    finalDetectedPlate: string | null,
    finalDetectedExpiry: string | null,
    finalDetectedClass: 'Private' | 'Commercial' | 'Not detected'
  ) => {
    setDetectedPlate(finalDetectedPlate || 'Not found');
    setDetectedExpiry(finalDetectedExpiry || 'Not found');
    setDetectedClass(finalDetectedClass);
    setOcrStatus('');

    if (foundMatchingPlate && foundMatchingExpiry) {
      // Force display the perfectly matched values for safety
      setDetectedPlate(normalizedEnteredPlate);
      setDetectedExpiry(enteredExpiryDate);
      setOcrStage('REVIEW');
    } else {
      setOcrStage('REVIEW_FAILED');
      throw new Error('The entered plate number or expiry date does not match what was detected on the uploaded document.');
    }
  };

  const proceedWithRegistration = async () => {
    if (!profile) return;
    if (!detectedPlate || !detectedExpiry) return;
    
    setOcrStatus('Uploading securely to platform...');
    
    // 1. Get Geolocation
    let currentLat = 0;
    let currentLon = 0;
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 10000 });
      });
      currentLat = position.coords.latitude;
      currentLon = position.coords.longitude;
    } catch (geoErr) {
      console.warn('Geolocation fallback failed, using 0', geoErr);
    }

    // 2. Upload Photo
    if (!processedFileState) throw new Error('Vehicle photo missing.');
    const fileExt = processedFileState.name.split('.').pop();
    const fileName = `${profile.id}-${Date.now()}.${fileExt}`;
    const { error: uploadError } = await supabase.storage.from('vehicle-photos').upload(fileName, processedFileState);
    if (uploadError) throw uploadError;
    const { data: publicUrlData } = supabase.storage.from('vehicle-photos').getPublicUrl(fileName);

    // 3. Upload All Documents
    const docUrls: string[] = [];
    for (const pDoc of processedDocsState) {
      const docExt = pDoc.name.split('.').pop();
      const docFileName = `documents/${profile.id}-${Date.now()}-${Math.floor(Math.random()*1000)}.${docExt}`;
      const { error: docUploadError } = await supabase.storage.from('vehicle-photos').upload(docFileName, pDoc);
      if (docUploadError) throw docUploadError;
      const { data: docUrlData } = supabase.storage.from('vehicle-photos').getPublicUrl(docFileName);
      docUrls.push(docUrlData.publicUrl);
    }

    const serializedDocUrls = JSON.stringify(docUrls);

    // 4. Insert Vehicle State
    const { error: insertError } = await supabase
      .from('vehicle_states')
      .insert({
        carrier_id: profile.id,
        vehicle_type: vehicleType as 'Motorcycle' | 'Tricycle' | 'Van' | 'Pickup Truck' | 'Truck',
        plate_number: detectedPlate,
        vehicle_nickname: nickname,
        payload_capacity_baskets: capacity,
        current_latitude: currentLat,
        current_longitude: currentLon,
        carrier_status: 'available',
        vehicle_photo_url: publicUrlData.publicUrl,
        vehicle_document_url: serializedDocUrls,
        vehicle_license_expires_at: detectedExpiry,
        vehicle_verification_status: 'pending'
      });

    if (insertError) throw insertError;
    if (onRegistered) onRegistered();

    setPlateNumber('');
    setNickname('');
    setCapacity(50);
    setExpiryDate('');
    setFile(null);
    setDocumentFiles([]);
    setOcrStage('IDLE');
    alert('Vehicle successfully registered!');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    
    setIsSubmitting(true);
    setError(null);
    setOcrStatus('');

    try {
      if (ocrStage === 'IDLE' || ocrStage === 'REVIEW_FAILED') {
        setOcrStage('PROCESSING');
        await runOcrPipeline();
      } else if (ocrStage === 'REVIEW') {
        await proceedWithRegistration();
      }
    } catch (err: unknown) {
      const e = err as Error;
      console.error(e);
      setError(e.message || 'An error occurred during registration.');
    } finally {
      setIsSubmitting(false);
      setOcrStatus(prev => ocrStage === 'REVIEW' && !error ? '' : prev);
    }
  };

  return (
    <div className="bg-[var(--card-bg)] rounded-lg p-6 shadow-sm border border-[var(--border-color)]">
      <h2 className="text-xl font-semibold mb-4">Register New Vehicle</h2>
      
      {error && (
        <div className="bg-red-500/10 border border-red-500 text-red-500 p-3 rounded mb-4">
          {error}
        </div>
      )}

      {ocrStatus && ocrStage === 'PROCESSING' && (
        <div className="bg-blue-500/10 border border-blue-500 text-blue-500 p-3 rounded mb-4 animate-pulse">
          {ocrStatus}
        </div>
      )}

      {(ocrStage === 'REVIEW' || ocrStage === 'REVIEW_FAILED') && (
        <div className={`${ocrStage === 'REVIEW' ? 'bg-green-500/10 border-green-500 text-green-700' : 'bg-red-500/10 border-red-500 text-red-700'} border p-5 rounded mb-4`}>
          <h3 className={`font-bold mb-3 text-lg border-b ${ocrStage === 'REVIEW' ? 'border-green-500/20' : 'border-red-500/20'} pb-2`}>
            {ocrStage === 'REVIEW' ? 'OCR Verification Passed' : 'OCR Verification Failed'}
          </h3>
          <div className="grid grid-cols-2 gap-4 text-sm mb-4">
            <div>
              <span className="opacity-75 block text-xs uppercase tracking-wider">Entered Plate</span>
              <strong>{normalizePlateNumber(plateNumber)}</strong>
            </div>
            <div>
              <span className="opacity-75 block text-xs uppercase tracking-wider">Detected Plate</span>
              <strong>{detectedPlate}</strong>
            </div>
            <div>
              <span className="opacity-75 block text-xs uppercase tracking-wider">Entered Expiry</span>
              <strong>{expiryDate}</strong>
            </div>
            <div>
              <span className="opacity-75 block text-xs uppercase tracking-wider">Detected Expiry</span>
              <strong>{detectedExpiry}</strong>
            </div>
            <div className="col-span-2">
              <span className="opacity-75 block text-xs uppercase tracking-wider">Detected Document Class</span>
              <strong>{detectedClass}</strong>
            </div>
          </div>
          
          {detectedClass === 'Private' && (
            <div className="bg-yellow-500/10 border border-yellow-500 text-yellow-700 p-3 rounded text-sm mb-3">
              This document appears to be for a private vehicle. Agro-Data Hub allows private and commercial vehicles in this MVP, but commercial documentation may be required for regulated haulage operations.
            </div>
          )}

          {ocrStage === 'REVIEW' ? (
            <p className="mt-2 text-sm font-medium">Document details matched. Vehicle can be submitted for platform review.</p>
          ) : (
            <p className="mt-2 text-sm font-medium">Please correct your inputs or upload clearer images.</p>
          )}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Vehicle Type</label>
          <select 
            className="w-full p-2 rounded bg-[var(--input-bg)] border border-[var(--border-color)] disabled:opacity-50"
            value={vehicleType}
            onChange={(e) => setVehicleType(e.target.value)}
            disabled={ocrStage === 'REVIEW'}
          >
            <option value="Motorcycle">Motorcycle</option>
            <option value="Tricycle">Tricycle</option>
            <option value="Van">Van</option>
            <option value="Pickup Truck">Pickup Truck</option>
            <option value="Truck">Truck</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Plate Number</label>
          <input 
            type="text" 
            required
            className="w-full p-2 rounded bg-[var(--input-bg)] border border-[var(--border-color)] uppercase disabled:opacity-50"
            value={plateNumber}
            onChange={(e) => { setPlateNumber(e.target.value); setOcrStage('IDLE'); }}
            placeholder="e.g. ABC-123DE"
            disabled={ocrStage === 'REVIEW'}
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Vehicle Nickname</label>
          <input 
            type="text" 
            required
            className="w-full p-2 rounded bg-[var(--input-bg)] border border-[var(--border-color)] disabled:opacity-50"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            placeholder="e.g. Blue Thunder"
            disabled={ocrStage === 'REVIEW'}
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Payload Capacity (Baskets)</label>
          <input 
            type="number" 
            required
            min="1"
            className="w-full p-2 rounded bg-[var(--input-bg)] border border-[var(--border-color)] disabled:opacity-50"
            value={capacity}
            onChange={(e) => setCapacity(parseInt(e.target.value))}
            disabled={ocrStage === 'REVIEW'}
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Vehicle Photo</label>
          <p className="text-xs opacity-70 mb-2">Commercial plates in Nigeria use red lettering. Make sure the plate is visible in the vehicle photo.</p>
          <input 
            type="file" 
            accept="image/png,image/jpeg,image/jpg,image/webp,image/heic,image/heif"
            required={!file}
            className="w-full p-2 rounded bg-[var(--input-bg)] border border-[var(--border-color)] disabled:opacity-50"
            onChange={(e) => { setFile(e.target.files?.[0] || null); setOcrStage('IDLE'); }}
            disabled={ocrStage === 'REVIEW'}
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Vehicle particulars/licence document images (Max 4)</label>
          <p className="text-xs opacity-70 mb-2">Upload all pages or sides needed to show the plate number, vehicle class, chassis number, and expiry date.</p>
          <input 
            type="file" 
            accept="image/png,image/jpeg,image/jpg,image/webp,image/heic,image/heif"
            multiple
            required={documentFiles.length === 0}
            className="w-full p-2 rounded bg-[var(--input-bg)] border border-[var(--border-color)] disabled:opacity-50"
            onChange={handleDocumentChange}
            disabled={ocrStage === 'REVIEW'}
          />
          {documentFiles.length > 0 && (
            <p className="text-xs mt-1 text-green-600 dark:text-green-400">{documentFiles.length} file(s) selected.</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Vehicle License Expiry Date</label>
          <input 
            type="date" 
            required
            className="w-full p-2 rounded bg-[var(--input-bg)] border border-[var(--border-color)] disabled:opacity-50"
            value={expiryDate}
            onChange={(e) => { setExpiryDate(e.target.value); setOcrStage('IDLE'); }}
            disabled={ocrStage === 'REVIEW'}
          />
        </div>

        <Button type="submit" disabled={isSubmitting || ocrStage === 'PROCESSING'} className="w-full">
          {ocrStage === 'REVIEW' 
            ? (isSubmitting ? 'Submitting...' : 'Confirm & Submit Registration') 
            : (isSubmitting ? 'Verifying...' : (ocrStage === 'REVIEW_FAILED' ? 'Retry Verification' : 'Verify Document & Register'))}
        </Button>
        
        {ocrStage === 'REVIEW' && (
          <Button 
            type="button" 
            variant="secondary" 
            className="w-full mt-2" 
            disabled={isSubmitting} 
            onClick={() => setOcrStage('IDLE')}
          >
            Cancel / Edit Details
          </Button>
        )}
      </form>
    </div>
  );
}
