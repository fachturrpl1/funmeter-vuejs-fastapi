// components/providers/WsProvider.tsx
// Port dari src-vue-original/main.js provide SockRoot

"use client";

import React, { createContext, useContext, useEffect, useRef, ReactNode } from "react";
import { ws, setWsBase } from "@/lib/ws";
import { CONFIG } from "@/lib/config";

interface WsWrapper {
  socket: any;
  on: (ev: string, fn: (...args: unknown[]) => void) => void;
  off: (ev: string, fn: (...args: unknown[]) => void) => void;
  once: (ev: string, fn: (...args: unknown[]) => void) => void;
  emit: (ev: string, payload?: unknown) => void;
  emitAck: (ev: string, payload?: unknown, timeoutMs?: number) => Promise<unknown>;
  release: () => void;
  close: () => void;
}

const WsContext = createContext<WsWrapper | null>(null);

interface WsProviderProps {
  children: ReactNode;
}

export function WsProvider({ children }: WsProviderProps) {
  const sockRootRef = useRef<WsWrapper | null>(null);

  useEffect(() => {
    // Configure WS base and create a persistent root socket
    setWsBase(CONFIG.WS_API);
    const SockRoot = ws("", { autoReconnect: true, autoRelease: false });
    sockRootRef.current = SockRoot;

    return () => {
      // Cleanup on unmount
      if (sockRootRef.current) {
        sockRootRef.current.close();
      }
    };
  }, []);

  return (
    <WsContext.Provider value={sockRootRef.current}>
      {children}
    </WsContext.Provider>
  );
}

export function useWsRoot(): WsWrapper | null {
  return useContext(WsContext);
}

// Hook untuk membuat koneksi WS baru atau menggunakan root
interface UseWsOptions {
  url?: string;
  on?: Record<string, (...args: unknown[]) => void>;
  opts?: Record<string, unknown>;
  root?: boolean;
}

export function useWs(options: UseWsOptions = {}): WsWrapper | null {
  const { url, on = {}, opts = {}, root = false } = options;
  const sockRoot = useWsRoot();
  const sockRef = useRef<WsWrapper | null>(null);

  useEffect(() => {
    const sock = root && sockRoot ? sockRoot : ws(url || "", { opts });
    sockRef.current = sock;

    // Bind events yang diminta komponen ini
    for (const [ev, fn] of Object.entries(on)) {
      sock?.on(ev, fn);
    }

    return () => {
      // Cleanup
      if (root && sockRoot) {
        // Kalau root: cukup lepas event yang halaman ini pasang
        for (const [ev, fn] of Object.entries(on)) {
          sock?.off(ev, fn);
        }
      } else {
        // Kalau halaman sendiri: release ref (pool akan nutup kalau ref=0)
        sock?.release();
      }
    };
  }, [url, root, sockRoot, on, opts]);

  return sockRef.current;
}
