// app/fun-meter/page.tsx
// Port dari src-vue-original/pages/default/FunMeterPage.vue

"use client";

import React, { useState, useRef, useEffect } from "react";
import { useI18n } from "@/components/providers/I18nProvider";
import { useSettings } from "@/components/providers/SettingsProvider";
import { useWs } from "@/components/providers/WsProvider";
import { toast } from "@/lib/toast";
import { request } from "@/lib/api";
import { Button } from "@/components/ui/button";

interface FunMeterResult {
  emotion: string;
  confidence: number;
  bbox?: [number, number, number, number];
}

export default function FunMeterPage() {
  const { t } = useI18n();
  const { useSetting } = useSettings();
  const videoRef = useRef<HTMLVideoElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  
  const [cameraActive, setCameraActive] = useState(false);
  const [statusText, setStatusText] = useState("");
  const [sendingFrame, setSendingFrame] = useState(false);
  const [results, setResults] = useState<FunMeterResult[]>([]);
  const [emotionStats, setEmotionStats] = useState<Record<string, number>>({});

  // Settings
  const { model: baseInterval } = useSetting("baseInterval", { clamp: { max: 5000, round: true } });
  const { model: funSendWidth } = useSetting("funMeter.sendWidth", { 
    clamp: { min: 160, max: 1920, round: true } 
  });
  const { model: jpegQuality } = useSetting("funMeter.jpegQuality", { clamp: { min: 0, max: 1 } });
  const funInterval = useSetting("funMeter.funIntervalMs", { clamp: { min: 100, max: 2000, round: true } });

  // WebSocket connection
  const socket = useWs({
    url: "",
    root: true,
    on: {
      connect() {
        setStatusText("WS connected");
        toast.success(t("funMeter.toast.wsConnected", "Terhubung ke server WebSocket"));
      },
      disconnect(..._args: unknown[]) {
        setStatusText("WS disconnected");
        toast.warn(t("funMeter.toast.wsDisconnected", "Koneksi WebSocket terputus"));
      },
      fun_result(data: any) {
        const funResults = Array.isArray(data?.results) ? data.results : [];
        setResults(funResults);
        
        // Update status
        setStatusText(`Emotions detected: ${funResults.length}`);
        
        // Update emotion statistics
        const stats: Record<string, number> = {};
        funResults.forEach((result: FunMeterResult) => {
          if (result.emotion) {
            stats[result.emotion] = (stats[result.emotion] || 0) + 1;
          }
        });
        setEmotionStats(stats);
      },
    },
  });

  // Camera functions
  const startCamera = async () => {
    if (!videoRef.current) return;
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: true, 
        audio: false 
      });
      if (!videoRef.current) return;
      const video = videoRef.current;
      video.srcObject = stream;
      setCameraActive(true);
      setStatusText("Camera active");
      
      await new Promise((resolve) => {
        if (video.readyState >= 2) resolve(undefined);
        else video.onloadedmetadata = () => resolve(undefined);
      });
      
    } catch (error) {
      setStatusText("Camera access denied");
      toast.error(t("funMeter.toast.cameraError", "Gagal mengakses kamera"));
    }
  };

  const toggleCamera = () => {
    if (cameraActive) {
      stopCamera();
    } else {
      void startCamera();
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

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  // Emotion color mapping
  const getEmotionColor = (emotion: string): string => {
    const colors: Record<string, string> = {
      happy: "bg-green-100 text-green-800",
      sad: "bg-blue-100 text-blue-800",
      angry: "bg-red-100 text-red-800",
      surprised: "bg-yellow-100 text-yellow-800",
      fear: "bg-purple-100 text-purple-800",
      disgust: "bg-orange-100 text-orange-800",
      neutral: "bg-gray-100 text-gray-800",
    };
    return colors[emotion] || "bg-gray-100 text-gray-800";
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Camera Card */}
        <div className="bg-card rounded-lg border p-6">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">
            {t("funMeter.camera.title", "Camera")}
          </p>
          <h3 className="text-lg font-semibold mb-4">{t("funMeter.camera.subtitle", "Fun Meter Streaming")}</h3>

          <div className="relative aspect-video rounded-lg border bg-muted/30 overflow-hidden mb-4">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              className="w-full h-full object-cover"
            />
            <canvas
              ref={overlayRef}
              className="absolute inset-0 w-full h-full pointer-events-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="text-sm font-medium block mb-1">
                {t("funMeter.form.interval", "Interval (ms)")}
              </label>
              <input
                type="number"
                value={funInterval.model as number}
                onChange={(e) => funInterval.setModel(Number(e.target.value))}
                className="w-full px-3 py-2 border rounded-md"
                min={100}
                max={2000}
              />
            </div>
            <div>
              <label className="text-sm font-medium block mb-1">
                {t("funMeter.form.model", "Model")}
              </label>
              <div className="h-10 flex items-center px-3 border rounded-md text-sm text-muted-foreground">
                {t("funMeter.model.waiting", "Waiting for metadata...")}
              </div>
            </div>
          </div>

          <div className="flex gap-2 mb-2">
            <Button onClick={toggleCamera}>
              {cameraActive
                ? t("funMeter.actions.stopCamera", "Stop Camera")
                : t("funMeter.actions.startCamera", "Start Camera")}
            </Button>
          </div>

          <p className="text-sm text-muted-foreground">
            {t("funMeter.camera.help", "Press start to send fun meter frames.")}
          </p>
        </div>

        {/* Right: Summary Card */}
        <div className="bg-card rounded-lg border p-6 self-start">
          <div className="flex items-center justify-between mb-2">
            <div>
              <p className="text-xs uppercase tracking-widest text-muted-foreground">
                {t("funMeter.summary.title", "Summary")}
              </p>
              <h3 className="text-lg font-semibold">{t("funMeter.summary.subtitle", "Labels & Last Results")}</h3>
            </div>
            <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold">
              {Object.keys(emotionStats).length} {t("funMeter.summary.labels", "labels")}
            </span>
          </div>

          <p className="text-sm text-muted-foreground mb-4">
            {t(
              "funMeter.summary.description",
              "Fun represents the probability of happiness (0–100%). The label list is fetched directly from the model on the server."
            )}
          </p>

          <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
            {results.length === 0
              ? t("funMeter.summary.empty", "No results from camera yet.")
              : t("funMeter.summary.nonEmpty", "Receiving results…")}
          </div>
        </div>
      </div>
    </div>
  );
}
