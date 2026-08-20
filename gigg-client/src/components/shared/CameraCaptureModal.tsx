import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Camera, SwitchCamera, X, Check, MapPin, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '../../lib/api';

interface GeoTagData {
  lat: number;
  lng: number;
  address: string;
  timestamp: string;
}

interface CameraCaptureModalProps {
  open: boolean;
  onCapture: (dataUrl: string) => void;
  onClose: () => void;
  jobLocation?: string;
}

function cleanAddressString(raw: string, lat: number, lng: number): string {
  // Remove administrative noise like "CMWSSB Division \d+", "Ward \d+", "Zone \d+", "Chennai Corporation", postal codes
  const cleaned = raw
    .replace(/CMWSSB\s*Division\s*\d+,?/gi, '')
    .replace(/Ward\s*\d+,?/gi, '')
    .replace(/Zone\s*\d+[^,]+,?/gi, '')
    .replace(/Chennai\s*Corporation,?/gi, '')
    .replace(/\b\d{6}\b,?/g, '')
    .replace(/,\s*,/g, ',')
    .replace(/^,\s*|,\s*$/g, '')
    .trim();

  const parts = cleaned.split(',').map((s) => s.trim()).filter(Boolean);
  const filtered = parts.filter((p) => !/^(CMWSSB|Ward|Zone|Tamil Nadu|India|\d{6})/i.test(p));
  return (filtered.slice(0, 3).join(', ') || parts.slice(0, 3).join(', ') || `${lat.toFixed(5)}, ${lng.toFixed(5)}`);
}

async function reverseGeocode(lat: number, lng: number): Promise<string> {
  // 1. Try Google Maps reverse-geocoding via backend (with auth)
  try {
    const data = await api.get<{ formattedAddress?: string; area?: string; city?: string }>(
      '/api/maps/reverse-geocode',
      { lat: String(lat), lng: String(lng) }
    );
    if (data?.formattedAddress) {
      return cleanAddressString(data.formattedAddress, lat, lng);
    }
    if (data?.area) {
      const addr = [data.area, data.city].filter(Boolean).join(', ');
      return cleanAddressString(addr, lat, lng);
    }
  } catch {}

  // 2. Fallback to OpenStreetMap Nominatim with detailed address structure
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
      { headers: { 'Accept-Language': 'en' } }
    );
    if (res.ok) {
      const data = await res.json();
      const addr = data.address || {};
      
      const landmark = addr.university || addr.college || addr.school || addr.hospital || addr.amenity || addr.building || addr.office;
      const road = addr.road || addr.street;
      const neighborhood = addr.neighbourhood || addr.suburb || addr.city_district || addr.subdivision;
      const city = addr.city || addr.town || addr.county || '';

      const parts = [landmark, road, neighborhood, city].filter(Boolean);
      const combined = parts.join(', ') || data.display_name || '';
      return cleanAddressString(combined, lat, lng);
    }
  } catch {}

  return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
}

function getFormattedDateTime(): string {
  const now = new Date();
  return now.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });
}

function burnGeoTagOntoCanvas(
  videoEl: HTMLVideoElement,
  geoTag: GeoTagData | null,
  locationDenied: boolean,
  jobLocation?: string
): string {
  const canvas = document.createElement('canvas');
  canvas.width = videoEl.videoWidth || 1280;
  canvas.height = videoEl.videoHeight || 720;
  const ctx = canvas.getContext('2d')!;

  // Draw video frame
  ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);

  // Dynamic overlay parameters scaled to image width
  const fontSize = Math.max(16, Math.floor(canvas.width / 46));
  const lineHeight = Math.floor(fontSize * 1.45);
  const padding = Math.floor(fontSize * 0.85);

  const dateTime = geoTag ? geoTag.timestamp : getFormattedDateTime();
  const latLng = geoTag && geoTag.lat ? `GPS: ${geoTag.lat.toFixed(5)}, ${geoTag.lng.toFixed(5)}` : null;
  const address = geoTag?.address
    ? geoTag.address
    : jobLocation
    ? `Venue: ${jobLocation}`
    : locationDenied
    ? '⚠ Live GPS unavailable'
    : '⏳ Acquiring location...';

  // Build sequential lines: Line 0 = GIGGERS, Line 1 = dateTime, Line 2 = GPS (if available), Line 3+ = address
  const lines: { text: string; type: 'brand' | 'time' | 'gps' | 'address' }[] = [
    { text: 'GIGGERS PIPELINE VERIFIED', type: 'brand' },
    { text: dateTime, type: 'time' },
  ];
  if (latLng) {
    lines.push({ text: latLng, type: 'gps' });
  }

  if (address) {
    const words = address.split(' ');
    let current = '';
    for (const word of words) {
      if ((current + ' ' + word).trim().length > 50) {
        lines.push({ text: current.trim(), type: 'address' });
        current = word;
      } else {
        current = current ? current + ' ' + word : word;
      }
    }
    if (current) lines.push({ text: current.trim(), type: 'address' });
  }

  const boxHeight = lines.length * lineHeight + padding * 2;
  const boxY = canvas.height - boxHeight - 14;
  const boxWidth = canvas.width - 28;
  const boxX = 14;

  // Semi-transparent dark slate backdrop
  ctx.save();
  ctx.globalAlpha = 0.78;
  ctx.fillStyle = '#0f172a';
  ctx.beginPath();
  ctx.roundRect(boxX, boxY, boxWidth, boxHeight, 12);
  ctx.fill();
  ctx.restore();

  // Render each line with its own distinct typography and color
  ctx.save();
  lines.forEach((line, idx) => {
    const yPos = boxY + padding + (idx + 1) * lineHeight - Math.floor(fontSize * 0.3);

    if (line.type === 'brand') {
      ctx.fillStyle = '#34d399'; // Emerald 400
      ctx.font = `bold ${fontSize + 2}px 'Arial', sans-serif`;
    } else if (line.type === 'time') {
      ctx.fillStyle = '#ffffff'; // Crisp white
      ctx.font = `bold ${fontSize}px 'Arial', sans-serif`;
    } else {
      ctx.fillStyle = '#cbd5e1'; // Light slate
      ctx.font = `${fontSize - 1}px 'Arial', sans-serif`;
    }

    ctx.fillText(line.text, boxX + padding, yPos);
  });
  ctx.restore();

  return canvas.toDataURL('image/jpeg', 0.92);
}

export default function CameraCaptureModal({ open, onCapture, onClose, jobLocation }: CameraCaptureModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [geoTag, setGeoTag] = useState<GeoTagData | null>(null);
  const [locationDenied, setLocationDenied] = useState(false);
  const [locationLoading, setLocationLoading] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [capturing, setCapturing] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const startCamera = useCallback(async (facing: 'environment' | 'user') => {
    stopCamera();
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: facing },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } catch (err: any) {
      setCameraError(
        err.name === 'NotAllowedError'
          ? 'Camera permission denied. Please allow camera access in your browser settings.'
          : 'Could not open camera. Please try again.'
      );
    }
  }, [stopCamera]);

  const acquireLocation = useCallback(async () => {
    setLocationLoading(true);
    const getPos = (highAcc: boolean, timeoutMs: number) =>
      new Promise<GeolocationPosition>((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: highAcc,
          timeout: timeoutMs,
          maximumAge: 0, // Fresh real-time GPS coordinate
        })
      );

    try {
      let pos: GeolocationPosition;
      try {
        // High accuracy GPS fix (satellite/mobile GPS)
        pos = await getPos(true, 10000);
      } catch {
        // Fallback to quick cell/wifi triangulation
        pos = await getPos(false, 10000);
      }

      const { latitude, longitude } = pos.coords;
      const address = await reverseGeocode(latitude, longitude);
      setGeoTag({
        lat: latitude,
        lng: longitude,
        address,
        timestamp: getFormattedDateTime(),
      });
      setLocationDenied(false);
    } catch {
      // If browser geolocation fails/denied, fallback to jobLocation if provided
      if (jobLocation) {
        setGeoTag({
          lat: 0,
          lng: 0,
          address: `Venue: ${jobLocation}`,
          timestamp: getFormattedDateTime(),
        });
        setLocationDenied(false);
      } else {
        setLocationDenied(true);
      }
    } finally {
      setLocationLoading(false);
    }
  }, [jobLocation]);

  useEffect(() => {
    if (open) {
      setPreviewUrl(null);
      setGeoTag(null);
      setLocationDenied(false);
      startCamera(facingMode);
      acquireLocation();
    } else {
      stopCamera();
      setPreviewUrl(null);
    }
    return () => {
      if (!open) stopCamera();
    };
  }, [open, facingMode]);

  const handleSwitchCamera = () => {
    const next = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(next);
    startCamera(next);
  };

  const handleCapture = async () => {
    if (!videoRef.current || capturing) return;
    setCapturing(true);
    try {
      // Refresh timestamp at moment of capture
      const finalGeoTag = geoTag
        ? { ...geoTag, timestamp: getFormattedDateTime() }
        : null;
      const dataUrl = burnGeoTagOntoCanvas(videoRef.current, finalGeoTag, locationDenied, jobLocation);
      setPreviewUrl(dataUrl);
    } finally {
      setCapturing(false);
    }
  };

  const handleConfirm = () => {
    if (previewUrl) {
      stopCamera();
      onCapture(previewUrl);
    }
  };

  const handleRetake = () => {
    setPreviewUrl(null);
    startCamera(facingMode);
  };

  const handleClose = () => {
    stopCamera();
    setPreviewUrl(null);
    onClose();
  };

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] bg-black flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-safe-or-4 pb-3 bg-black/80 backdrop-blur-sm">
          <button
            onClick={handleClose}
            className="w-10 h-10 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20 transition-colors"
          >
            <X size={20} />
          </button>
          <span className="text-white font-extrabold text-sm tracking-wide">
            📷 Live Photo Capture
          </span>
          <button
            onClick={handleSwitchCamera}
            className="w-10 h-10 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20 transition-colors"
            title="Switch Camera"
          >
            <SwitchCamera size={18} />
          </button>
        </div>

        {/* Camera / Preview Area */}
        <div className="flex-1 relative bg-black overflow-hidden">
          {cameraError ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-6 text-center">
              <Camera size={48} className="text-white/30" />
              <p className="text-white font-semibold text-sm">{cameraError}</p>
              <button
                onClick={() => startCamera(facingMode)}
                className="px-5 py-2.5 bg-primary-600 text-white rounded-2xl font-bold text-sm"
              >
                Retry
              </button>
            </div>
          ) : previewUrl ? (
            <img
              src={previewUrl}
              alt="Captured geo-tagged photo"
              className="absolute inset-0 w-full h-full object-contain"
            />
          ) : (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="absolute inset-0 w-full h-full object-cover"
            />
          )}

          {/* Location Status Overlay (top-right) */}
          {!previewUrl && (
            <div className="absolute top-3 right-3 flex items-center gap-1.5 bg-black/60 backdrop-blur-sm px-2.5 py-1.5 rounded-full">
              {locationLoading ? (
                <>
                  <Loader2 size={12} className="text-amber-400 animate-spin" />
                  <span className="text-amber-300 text-[10px] font-bold">Locating...</span>
                </>
              ) : geoTag ? (
                <>
                  <MapPin size={12} className="text-emerald-400" />
                  <span className="text-emerald-300 text-[10px] font-bold">GPS Ready</span>
                </>
              ) : locationDenied ? (
                <>
                  <MapPin size={12} className="text-red-400" />
                  <span className="text-red-300 text-[10px] font-bold">No Location</span>
                </>
              ) : null}
            </div>
          )}

          {/* Preview confirmation label */}
          {previewUrl && (
            <div className="absolute top-3 left-3 bg-emerald-600/90 backdrop-blur-sm text-white text-xs font-extrabold px-3 py-1.5 rounded-full">
              ✓ Geo-tagged photo ready
            </div>
          )}
        </div>

        {/* Bottom Controls */}
        <div className="px-6 pb-safe-or-6 pt-4 bg-black/90 backdrop-blur-sm">
          {!previewUrl ? (
            <div className="flex flex-col items-center gap-3">
              <p className="text-white/50 text-[11px] font-medium text-center">
                Date, time & GPS location will be stamped onto your photo
              </p>
              <button
                onClick={handleCapture}
                disabled={!!cameraError || capturing}
                className="w-20 h-20 rounded-full bg-white border-4 border-white/30 flex items-center justify-center shadow-xl active:scale-95 transition-transform disabled:opacity-50"
              >
                <div className="w-16 h-16 rounded-full bg-white shadow-inner flex items-center justify-center">
                  {capturing ? (
                    <Loader2 size={28} className="text-slate-800 animate-spin" />
                  ) : (
                    <Camera size={28} className="text-slate-800" />
                  )}
                </div>
              </button>
              <p className="text-white/40 text-[10px] font-medium">Tap circle to capture</p>
            </div>
          ) : (
            <div className="flex gap-3">
              <button
                onClick={handleRetake}
                className="flex-1 py-3.5 rounded-2xl bg-white/10 text-white font-extrabold text-sm border border-white/20 flex items-center justify-center gap-2 hover:bg-white/20 transition-colors"
              >
                <SwitchCamera size={18} /> Retake
              </button>
              <button
                onClick={handleConfirm}
                className="flex-1 py-3.5 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white font-extrabold text-sm flex items-center justify-center gap-2 transition-colors shadow-lg shadow-emerald-900/40"
              >
                <Check size={18} /> Use Photo
              </button>
            </div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
