// app/register-face/page.tsx
// Register Face page with two-card layout: Camera & Preview (left) and Identity Information (right)

"use client";

import React, { useState, useRef, useEffect } from "react";
import { useI18n } from "@/components/providers/I18nProvider";
import { useSettings } from "@/components/providers/SettingsProvider";
import { useWs } from "@/components/providers/WsProvider";
import { toast } from "@/lib/toast";
import { request, postForm } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/common/Icon";

export default function RegisterFacePage() {
  const { t } = useI18n();
  const { useSetting } = useSettings();
  const videoRef = useRef<HTMLVideoElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const captureCanvasRef = useRef<HTMLCanvasElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  
  const [cameraActive, setCameraActive] = useState(false);
  const [statusText, setStatusText] = useState("");
  const [userName, setUserName] = useState("");
  const [isRegistering, setIsRegistering] = useState(false);
  const [faceDetected, setFaceDetected] = useState(false);
  const [facesCount, setFacesCount] = useState(0);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [previewSrc, setPreviewSrc] = useState<string>("");
  const [freeze, setFreeze] = useState(false);
  const [previewLoading] = useState(false);
  const [previewToken, setPreviewToken] = useState<string>("");
  const [previewFaces, setPreviewFaces] = useState<Array<{ bbox: [number, number, number, number] }>>([]);

  interface PreviewResponse {
    preview?: string;
    faces?: Array<{ bbox: [number, number, number, number] }>;
    faces_cropped?: Array<{ bbox: [number, number, number, number] }>;
    detected?: number;
    preview_is_cropped?: boolean;
    token?: string;
  }

  // Settings
  const { model: baseInterval } = useSetting("baseInterval", { clamp: { max: 5000, round: true } });
  const { model: attSendWidth } = useSetting("attendance.sendWidth", { 
    clamp: { min: 160, max: 1920, round: true } 
  });
  const { model: jpegQuality } = useSetting("attendance.jpegQuality", { clamp: { min: 0, max: 1 } });

  // WebSocket connection
  const socket = useWs({
    url: "",
    root: true,
    on: {
      connect() {
        setStatusText("WS connected");
        toast.success(t("registerFace.toast.wsConnected", "Terhubung ke server WebSocket"));
      },
      disconnect(reason: string) {
        setStatusText("WS disconnected");
        toast.warn(t("registerFace.toast.wsDisconnected", "Koneksi WebSocket terputus"));
      },
      face_detection(data: any) {
        const faces = Array.isArray(data?.faces) ? data.faces : [];
        setFaceDetected(faces.length > 0);
        setFacesCount(faces.length);
        setStatusText(faces.length > 0 ? `Face detected: ${faces.length}` : "No face detected");
      },
    },
  });

  // Camera functions
  const startCamera = async () => {
    if (!videoRef.current) return;
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: "user"
        }, 
        audio: false 
      });
      videoRef.current.srcObject = stream;
      setCameraActive(true);
      setStatusText("Camera active");
      
      await new Promise((resolve) => {
        if (videoRef.current?.readyState >= 2) resolve(undefined);
        else if (videoRef.current) videoRef.current.onloadedmetadata = () => resolve(undefined);
      });
      
    } catch (error) {
      setStatusText("Camera access denied");
      toast.error(t("registerFace.toast.cameraError", "Gagal mengakses kamera"));
    }
  };

  const stopCamera = () => {
    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
    setStatusText("Camera stopped");
  };

  // Adjust overlay canvas to image size
  const fitCanvasToElement = (canvas: HTMLCanvasElement | null, el: HTMLImageElement | HTMLVideoElement | null) => {
    if (!canvas || !el) return;
    const rect = el.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.round(rect.width * dpr));
    canvas.height = Math.max(1, Math.round(rect.height * dpr));
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;
    const ctx = canvas.getContext("2d");
    if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };

  const clearCanvas = (canvas: HTMLCanvasElement | null) => {
    const ctx = canvas?.getContext("2d");
    if (!ctx || !canvas) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  const drawOverlayBoxes = (
    el: HTMLImageElement,
    canvas: HTMLCanvasElement,
    faces: Array<{ bbox: [number, number, number, number] }>
  ) => {
    fitCanvasToElement(canvas, el);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    clearCanvas(canvas);
    ctx.lineWidth = 3;
    ctx.strokeStyle = "#38bdf8";
    for (const f of faces) {
      const [x, y, w, h] = f.bbox || [0, 0, 0, 0];
      ctx.strokeRect(x, y, w, h);
    }
  };

  // Capture current video frame into preview image
  const capturePhoto = async () => {
    try {
      if (!videoRef.current) return;
      const canvas = captureCanvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      canvas.width = videoRef.current.videoWidth || 640;
      canvas.height = videoRef.current.videoHeight || 480;
      ctx.drawImage(videoRef.current, 0, 0);
      // Freeze video for UX snapshot, will be stopped after success
      try { videoRef.current.pause(); } catch {}
      setFreeze(true);
      await new Promise<void>((resolve) => setTimeout(() => resolve(), 0));
      const blob: Blob | null = await new Promise((resolve) => canvas.toBlob((b) => resolve(b), "image/jpeg", 0.92));
      if (!blob) {
        setFreeze(false);
        try { await videoRef.current.play(); } catch {}
        return;
      }
      // Send to preview endpoint for detection results
      try {
        const fd = new FormData();
        fd.append("file", blob, "capture.jpg");
        setStatusText(t("registerFace.status.processing", "Memproses..."));
        const resp = await postForm<PreviewResponse>("/register-face/preview", fd);
        const facesRaw = Array.isArray(resp?.faces) ? resp.faces : [];
        const facesCroppedRaw = Array.isArray(resp?.faces_cropped) ? resp.faces_cropped : [];
        const faces = resp?.preview_is_cropped ? facesCroppedRaw : facesRaw;
        const detected = Number(resp?.detected ?? faces.length ?? 0);

        setFacesCount(detected);
        setPreviewFaces(faces);
        setPreviewToken(String(resp?.token || ""));

        // Set preview image from server if provided, fallback to local blob
        const nextUrl = String(resp?.preview || "") || URL.createObjectURL(blob);
        try {
          const prev = previewSrc;
          if (prev && prev.startsWith("blob:")) URL.revokeObjectURL(prev);
        } catch {}
        setPreviewSrc(nextUrl);
        setStatusText(
          detected > 0
            ? t("registerFace.status.faces", "Jumlah wajah: {count}", { count: detected })
            : t("registerFace.status.noImage", "Tidak ada gambar.")
        );

        // Draw overlay boxes once image element is ready
        requestAnimationFrame(() => {
          const img = document.getElementById("preview-img") as HTMLImageElement | null;
          if (img && overlayRef.current) drawOverlayBoxes(img, overlayRef.current, faces);
        });
      } catch (err) {
        setPreviewToken("");
        setPreviewFaces([]);
        setFacesCount(0);
      }

      // Stop camera after capture to match Vue behavior and focus name input
      stopCamera();
      requestAnimationFrame(() => nameInputRef.current?.focus());
    } catch {
      setFreeze(false);
      try { await videoRef.current?.play(); } catch {}
    } finally {
      setFreeze(false);
    }
  };

  const resetPreview = () => {
    try {
      if (previewSrc && previewSrc.startsWith("blob:")) URL.revokeObjectURL(previewSrc);
    } catch {}
    setPreviewSrc("");
    setPreviewToken("");
    setPreviewFaces([]);
    clearCanvas(overlayRef.current);
    setStatusText(t("registerFace.status.noImage", "Tidak ada gambar."));
    // If camera is not active (e.g., after capture), reopen it
    if (!cameraActive) {
      startCamera();
    } else {
      try { videoRef.current?.play(); } catch {}
    }
  };

  // Build one image (prefer captured preview, then upload, then live video)
  const buildImageData = async (): Promise<string | null> => {
    // 1) Captured preview from camera
    if (previewSrc) {
      try {
        const blob = await fetch(previewSrc).then((r) => r.blob());
        const dataUrl: string = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result || ""));
          reader.onerror = () => reject(new Error("read error"));
          reader.readAsDataURL(blob);
        });
        return dataUrl || null;
      } catch {
        // fallthrough to other sources
      }
    }
    // 2) Uploaded file
    if (uploadFile) {
      const file = uploadFile;
      const dataUrl: string = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ""));
        reader.onerror = () => reject(new Error("read error"));
        reader.readAsDataURL(file);
      });
      return dataUrl || null;
    }
    // 3) Live video frame
    if (!videoRef.current) return null;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    canvas.width = videoRef.current.videoWidth || 640;
    canvas.height = videoRef.current.videoHeight || 480;
    ctx.drawImage(videoRef.current, 0, 0);
    return canvas.toDataURL('image/jpeg', (jpegQuality.model as number) || 0.8);
  };

  // Start registration process (single image)
  const startRegistration = async () => {
    if (!userName.trim()) {
      toast.error(t("registerFace.toast.nameRequired", "Nama harus diisi"));
      return;
    }
    const imgData = await buildImageData();
    if (!imgData) {
      toast.error(t("registerFace.toast.noImage", "Tidak ada gambar dari kamera atau upload"));
      return;
    }
    setIsRegistering(true);
    try {
      const response = await request('/face/register', {
        method: 'POST',
        body: { name: userName.trim(), images: [imgData] },
      });
      if (response.success) {
        toast.success(t("registerFace.toast.registerSuccess", "Registrasi berhasil!"));
      } else {
        throw new Error(response.error || "Registration failed");
      }
    } catch (error) {
      toast.error(t("registerFace.toast.registerError", "Registrasi gagal: {error}", { 
        error: error instanceof Error ? error.message : "Unknown error" 
      }));
    } finally {
      setIsRegistering(false);
    }
  };

  // Reset registration
  const resetRegistration = () => {
    setUserName("");
    setUploadFile(null);
    setIsRegistering(false);
    setFaceDetected(false);
    setFacesCount(0);
  };

  // Auto-start camera on mount
  useEffect(() => {
    startCamera();
    
    return () => {
      stopCamera();
    };
  }, []);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* Left: Camera & Preview */}
        <div className="bg-card rounded-lg border p-6">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">
            {t("registerFace.camera.title", "Camera & Preview")}
          </p>
          <h3 className="text-lg font-semibold mb-3">{t("registerFace.camera.subtitle", "Capture face")}</h3>
          <p className="text-sm text-muted-foreground mb-4">
            {t("registerFace.camera.desc", "Capture from the camera or upload a photo to add a new identity to the database.")}
          </p>

          <div className="relative overflow-hidden rounded-2xl border bg-muted/30">
            {/* Image preview if captured */}
            {previewSrc ? (
              <img
                src={previewSrc}
                onLoad={() => fitCanvasToElement(overlayRef.current, (document.querySelector(`#preview-img`) as HTMLImageElement) || null)}
                id="preview-img"
                alt="preview"
                className="w-full"
              />
            ) : (
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full"
              />
            )}
            {/* Overlay for future detection results */}
            {previewSrc && (
              <canvas ref={overlayRef} className="absolute inset-0 h-full w-full" />
            )}

            {/* Floating HUD */}
            <div className="pointer-events-auto absolute bottom-4 right-4 flex flex-wrap items-center gap-2">
              {cameraActive && (
                <Button type="button" onClick={capturePhoto} disabled={isRegistering}>
                  <Icon name="Camera" className="mr-2 h-4 w-4" />
                  {t("registerFace.actions.capture", "Tangkap")}
                </Button>
              )}
              <Button
                type="button"
                variant="outline"
                onClick={resetPreview}
                disabled={cameraActive}
                className="backdrop-blur-md"
              >
                <Icon name="RotateCcw" className="mr-2 h-4 w-4" />
                {t("registerFace.actions.reset", "Reset")}
              </Button>
            </div>

            {/* Processing overlay */}
            {previewLoading && (
              <div className="pointer-events-none absolute inset-0 z-20 grid place-items-center bg-background/75 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Icon name="Loader2" className="h-4 w-4 animate-spin" />
                  {t("registerFace.status.processingCrop", "Memproses foto...")}
                </div>
              </div>
            )}
          </div>

          <div className="mt-4 flex items-center gap-2">
            <Button onClick={cameraActive ? stopCamera : startCamera}>
              <Icon name={cameraActive ? "CameraOff" : "Camera"} className="h-4 w-4 mr-2" />
              {cameraActive ? t("registerFace.actions.stopCamera", "Stop Camera") : t("registerFace.actions.useCamera", "Use Camera")}
            </Button>
            <div className="ml-auto flex items-center gap-3">
              <span className="text-sm text-muted-foreground">{statusText}</span>
              <span className="inline-flex items-center gap-1 rounded-full border bg-background/80 backdrop-blur px-2.5 py-0.5 text-xs font-medium">
                <Icon name="UserScan" className="h-3 w-3" />
                {t("registerFace.status.faceBadge", "{count} wajah", { count: facesCount })}
              </span>
            </div>
          </div>

          <canvas ref={captureCanvasRef} className="hidden" />
        </div>

        {/* Right: Identity Information */}
        <div className="bg-card rounded-lg border p-6">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">
            {t("registerFace.details.title", "Face Details")}
          </p>
          <h3 className="text-lg font-semibold mb-4 border-b">{t("registerFace.details.subtitle", "Identity Information")}</h3>
        <span className="border-b"></span>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">
                {t("registerFace.form.name", "Label / Name")}
              </label>
              <input
                type="text"
                ref={nameInputRef}
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                className="w-full px-3 py-2 border rounded-md"
                placeholder={t("registerFace.form.namePlaceholder", "Full name")}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                {t("registerFace.form.upload", "Upload Image")}
              </label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                className="w-full px-3 py-2 border rounded-md"
              />
            </div>

            <div className="pt-2">
              <Button onClick={startRegistration} disabled={isRegistering}>
                <Icon name="Send" className="h-4 w-4 mr-2" />
                {t("registerFace.actions.register", "Register")}
              </Button>
              <Button onClick={resetRegistration} variant="outline" className="ml-2" disabled={isRegistering}>
                {t("registerFace.actions.reset", "Reset")}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
