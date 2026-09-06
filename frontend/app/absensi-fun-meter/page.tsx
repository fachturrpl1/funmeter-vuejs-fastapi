// app/absensi-fun-meter/page.tsx
// Port dari src-vue-original/pages/default/AttendanceFunMeterPage.vue

"use client";

import React, { useState, useRef, useEffect } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useI18n } from "@/components/providers/I18nProvider";
import { useSettings } from "@/components/providers/SettingsProvider";
import { useWs } from "@/components/providers/WsProvider";
import { toast } from "@/lib/toast";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/common/Icon";
import * as Cam from "@/lib/cameraManager";

interface AttendanceFunResult {
  // Attendance data
  attendance?: {
    name: string;
    confidence: number;
    bbox?: [number, number, number, number];
  }[];
  marked?: string[];
  marked_info?: Array<{
    label: string;
    message: string;
  }>;
  
  // Fun meter data
  emotions?: Array<{
    emotion: string;
    confidence: number;
    bbox?: [number, number, number, number];
  }>;
}

export default function AttendanceFunMeterPage() {
  const { t } = useI18n();
  const { useSetting } = useSettings();
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  
  const [cameraActive, setCameraActive] = useState(false);
  const [statusText, setStatusText] = useState("");
  const [sendingFrame, setSendingFrame] = useState(false);
  const [attendanceResults, setAttendanceResults] = useState<any[]>([]);
  const [emotionResults, setEmotionResults] = useState<any[]>([]);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Settings
  const { model: baseInterval } = useSetting("baseInterval", { clamp: { max: 5000, round: true } });
  const { model: attSendWidth } = useSetting("attendance.sendWidth", { 
    clamp: { min: 160, max: 1920, round: true } 
  });
  const { model: funSendWidth } = useSetting("funMeter.sendWidth", { 
    clamp: { min: 160, max: 1920, round: true } 
  });
  const { model: jpegQuality } = useSetting("attendance.jpegQuality", { clamp: { min: 0, max: 1 } });
  const { model: funIntervalMs } = useSetting("funMeter.funIntervalMs", { clamp: { min: 100, max: 2000, round: true } });

  // WebSocket connection
  const socket = useWs({
    url: "",
    root: true,
    on: {
      connect() {
        setStatusText("WS connected");
        toast.success(t("attendanceFunMeter.toast.wsConnected", "Terhubung ke server WebSocket"));
      },
      disconnect(reason: string) {
        setStatusText("WS disconnected");
        toast.warn(t("attendanceFunMeter.toast.wsDisconnected", "Koneksi WebSocket terputus"));
      },
      att_result(data: any) {
        const results = Array.isArray(data?.results) ? data.results : [];
        setAttendanceResults(results);
        
        // Handle successful attendance
        const marked = Array.isArray(data?.marked) ? data.marked : [];
        const markedInfo = Array.isArray(data?.marked_info) ? data.marked_info : [];
        
        for (const info of markedInfo) {
          const label = info.label || "";
          const message = info.message || t("attendanceFunMeter.toast.attendanceSuccess", "Absen berhasil: {label}", { label });
          if (label) {
            toast.success(message, { duration: 5000 });
          }
        }
        
        if (!markedInfo.length) {
          for (const label of marked) {
            toast.success(t("attendanceFunMeter.toast.attendanceSuccess", "Absen berhasil: {label}", { label }), {
              duration: 5000,
            });
          }
        }
      },
      fun_result(data: any) {
        const results = Array.isArray(data?.results) ? data.results : [];
        setEmotionResults(results);
      },
    },
  });

  // Camera functions via shared manager
  const startCamera = async () => {
    if (!videoRef.current) return;
    try {
      await Cam.attach(videoRef.current);
      setCameraActive(true);
      setStatusText("Camera active");
    } catch (error) {
      setStatusText("Camera access denied");
      toast.error(t("attendanceFunMeter.toast.cameraError", "Gagal mengakses kamera"));
    }
  };

  const stopCamera = () => {
    Cam.detach(videoRef.current);
    setCameraActive(Cam.isActive());
    setStatusText("Camera stopped");
  };

  // Fullscreen functions
  const toggleFullscreen = async () => {
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      await document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  // Auto-start camera on mount (auto-stops on unmount when no other camera pages attach)
  useEffect(() => {
    startCamera();
    
    // Handle fullscreen change
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    
    return () => {
      stopCamera();
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

    useEffect(() => {
    const handleEsc = (event : KeyboardEvent) => {
      if (event.key === "Escape") {
        router.back(); // fungsi sama seperti klik tombol
      }
    };

    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [router]);

  // Emotion color mapping
  const getEmotionColor = (emotion: string): string => {
    const colors: Record<string, string> = {
      happy: "text-green-400",
      sad: "text-blue-400",
      angry: "text-red-400",
      surprised: "text-yellow-400",
      fear: "text-purple-400",
      disgust: "text-orange-400",
      neutral: "text-gray-400",
    };
    return colors[emotion] || "text-gray-400";
  };

  // rotating ad images
  const adImages = [
    "/images/upskilling.png",
    "/images/nobox.jpg",
    "/images/karyasmk.jpg",
    "/images/expo.jpg",
    "/images/eschool.png",
  ];
  const [adIndex, setAdIndex] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setAdIndex((i) => (i + 1) % adImages.length), 3000);
    return () => clearInterval(id);
  }, [adImages.length]);

  return (
    <div>
      {/* Header banner */}
      <div>
        <Image 
        src="/images/header.png"
        alt="Header"
        width={1920}
        height={400}
        priority
        className="w-full h-25 object-fill" />
        <div className="absolute top-3 left-3 flex gap-2 z-10">
          <Button size="sm" variant="outline" onClick={() => router.back()}>
            <Icon name="ArrowLeft" className="h-4 w-4" />
          </Button>
        </div>
        <div className="absolute top-3 right-3 flex gap-2 z-10">
          {/* <Button size="sm" variant="outline" onClick={toggleFullscreen}>
            <Icon name={isFullscreen ? "Minimize2" : "Maximize2"} className="h-4 w-4" />
          </Button> */}
          <Button
            size="sm"
            onClick={cameraActive ? stopCamera : startCamera}
            variant={cameraActive ? "destructive" : "default"}
          >
            <Icon
              name={cameraActive ? "CameraOff" : "Camera"}
              className="h-4 w-4 mr-2"
            />
            {cameraActive
              ? t("attendanceFunMeter.actions.stopCamera", "Stop")
              : t("attendanceFunMeter.actions.startCamera", "Start")}
          </Button>
        </div>
      </div>
      {/* Video Section (center) */}
      <div className="bg-card">
        <div className="relative aspect-video overflow-hidden w-full h-100 object-fill">   
          <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-fill" />
          <canvas ref={overlayRef} className="absolute inset-0 w-full h-full pointer-events-none" />
        </div>

      </div>

      {/* Advertisement */}
      <div>
        <Image key={adImages[adIndex]} src={adImages[adIndex]} alt="Iklan" width={1920} height={200} className="w-full h-35 object-fill" />
      </div>

      {/* Footer image */}
      <div>
        <Image src="/images/footer.png" alt="Footer" width={1920} height={220} priority className="w-full h-20
         object-fill" />
      </div>
    </div>
  );
}
