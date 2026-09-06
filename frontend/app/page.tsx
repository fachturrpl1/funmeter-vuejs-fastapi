// app/page.tsx
// Root route "/" - Halaman beranda hanya dengan mode kamera

"use client";
import { useRouter } from "next/navigation";
import React, { useState, useRef, useEffect, useCallback } from "react";
import { useI18n } from "@/components/providers/I18nProvider";
// No HTTP posting on homepage
import { useSettings } from "@/components/providers/SettingsProvider";
import { formatScore } from "@/lib/format";
import Image from "next/image";
// (no buttons on homepage)

interface RecognitionResult {
  label: string;
  score: number;
  bbox: [number, number, number, number];
}

// Rotating ad images (from public/images). Exclude footer.png which is used as footer.
const adImages = [
  "/images/upskilling.png",
  "/images/nobox.jpg",
  "/images/karyasmk.jpg",
  "/images/expo.jpg",
  "/images/eschool.png",
];

export default function HomePage() {
  const { t } = useI18n();
  const { useSetting } = useSettings();
  const router = useRouter();
  // Settings that affect camera and capture
  const { model: attSendWidth } = useSetting("attendance.sendWidth", { clamp: { min: 160, max: 1920, round: true } });

  // Camera states
  const [cameraStatus, setCameraStatus] = useState("");
  const [capturePreview] = useState("");
  const [captureResults] = useState<RecognitionResult[]>([]);

  // Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const captureImageRef = useRef<HTMLImageElement>(null);
  const captureOverlayRef = useRef<HTMLCanvasElement>(null);
  const snapCanvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Ads rotation every 3 seconds
  const [adIndex, setAdIndex] = useState(0);
  useEffect(() => {
    const id = setInterval(() => {
      setAdIndex((i) => (i + 1) % adImages.length);
    }, 3000);
    return () => clearInterval(id);
  }, []);

  // Start camera
  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: (attSendWidth as number) || 1280 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraStatus(t("home.camera.status.started", "Kamera aktif"));
    } catch (err) {
      const msg = (err as { message?: string })?.message || "-";
      setCameraStatus(t("home.camera.status.error", "Kesalahan: {message}", { message: msg }));
    }
  }, [t, attSendWidth]);

  // Stop camera
  const stopCamera = useCallback(() => {
    const s = streamRef.current;
    if (s) {
      s.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraStatus(t("home.camera.status.stopped", "Kamera dihentikan"));
  }, [t]);


  // Cleanup on unmount
  useEffect(() => {
    // Auto start camera when page mounts
    startCamera();
    return () => {
      stopCamera();
    };
  }, [stopCamera, startCamera]);


  return (
    <div className="space-y-8">
      <div className="grid gap-6 items-start">
          <div>          {/* Camera Results Section */}
            <div>
              {/* Banner (top) */}
              <div>
                <Image
                  src="/images/header.png"
                  alt="Header"
                  width={1920}
                  height={400}
                  priority
                  className="w-full h-20 object-fill"
                />
              </div>

              {/* Video */}
              <div className="overflow-hidden">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                className={`w-full h-100 object-fill ${capturePreview ? "hidden" : ""}`}
                />
                {capturePreview && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    ref={captureImageRef}
                    src={capturePreview}
                    alt="Capture"
                    className="w-full h-auto rounded-2xl"
                  />
                )}
                <canvas ref={captureOverlayRef} className="hidden" />
              </div>

              {/* Hidden canvas for capture */}
              <canvas ref={snapCanvasRef} className="hidden" />

              {/* Advertisement (below video) */}
              <div className="overflow-hidden">
                <Image
                  key={adImages[adIndex]}
                  src={adImages[adIndex]}
                  alt="Iklan"
                  width={1920}
                  height={200}
                  className="w-full h-20 object-fill"
                />
              </div>

              {/* Footer (bottom) */}
              <div>
                <Image
                  src="/images/footer.png"
                  alt="Footer"
                  width={1920}
                  height={220}
                  priority
                  className="w-full h-15 object-fill"
                />
              </div>

              {/* Results Table */}
             {captureResults.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-2">#</th>
                        <th className="text-left p-2">{t("home.table.label", "Label")}</th>
                        <th className="text-left p-2">{t("home.table.score", "Skor")}</th>
                        <th className="text-left p-2">{t("home.table.bbox", "Kotak Pembatas")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {captureResults.map((row, idx) => (
                        <tr key={idx} className="border-b">
                          <td className="p-2">{idx + 1}</td>
                          <td className="p-2">{row.label}</td>
                          <td className="p-2">{formatScore(row.score)}</td>
                          <td className="p-2">[{row.bbox.join(", ")}]</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
               </div>
             ) : null}
            </div>
          </div>
      </div>
    </div>
  );
}
