// components/providers/SettingsProvider.tsx
// Port dari src-vue-original/composables/useSetting.js

"use client";

import React, { createContext, useContext, useState, useCallback, ReactNode } from "react";

interface ClampOptions {
  min?: number;
  max?: number;
  round?: boolean;
}

interface UseSettingOptions {
  clamp?: ClampOptions;
}

interface SettingsState {
  [key: string]: unknown;
}

interface LanguageOption {
  code: string;
  label: string;
}

interface SettingsForm {
  language: string;
  theme: "light" | "dark";
  attendanceSendWidth: number;
  attendanceJpegQuality: number;
  funSendWidth: number;
  funJpegQuality: number;
  baseInterval: number;
}

interface SettingsContextType {
  state: SettingsState;
  getSetting: (path: string) => unknown;
  setSetting: (path: string, value: unknown, options?: UseSettingOptions) => void;
  useSetting: (path: string, options?: UseSettingOptions) => {
    model: unknown;
    setModel: (value: unknown) => void;
    placeholder: string;
  };
  // Modal management
  modalOpen: boolean;
  openModal: () => void;
  closeModal: () => void;
  // Form management
  form: SettingsForm;
  setForm: (form: SettingsForm) => void;
  submit: () => void;
  reset: () => void;
  languageOptions: LanguageOption[];
}

const SettingsContext = createContext<SettingsContextType | null>(null);

/** Get nested value by path */
function getByPath(obj: Record<string, unknown>, path: string): unknown {
  return path.split(".").reduce((acc: any, k) => (acc ? acc[k] : undefined), obj);
}

/** Set nested value by path */
function setByPath(obj: Record<string, unknown>, path: string, val: unknown): void {
  const keys = path.split(".");
  const last = keys.pop();
  if (!last) return;
  
  const target = keys.reduce((acc: any, k) => {
    if (!acc[k] || typeof acc[k] !== 'object') {
      acc[k] = {};
    }
    return acc[k];
  }, obj);
  
  target[last] = val;
}

// Default settings structure
const DEFAULT_SETTINGS: SettingsState = {
  funMeter: {
    sendWidth: 640,
    jpegQuality: 0.8,
    funIntervalMs: 100,
    baseInterval: 1000,
  },
  attendance: {
    sendWidth: 640,
    jpegQuality: 0.8,
  },
  baseInterval: 1000,
};

interface SettingsProviderProps {
  children: ReactNode;
  initialSettings?: SettingsState;
}

// Language options
const LANGUAGE_OPTIONS: LanguageOption[] = [
  { code: "id", label: "Bahasa Indonesia" },
  { code: "en", label: "English" },
];

// Default form values
const DEFAULT_FORM: SettingsForm = {
  language: "en",
  theme: "light",
  attendanceSendWidth: 640,
  attendanceJpegQuality: 0.8,
  funSendWidth: 640,
  funJpegQuality: 0.8,
  baseInterval: 1000,
};

export function SettingsProvider({ children, initialSettings = DEFAULT_SETTINGS }: SettingsProviderProps) {
  const [state, setState] = useState<SettingsState>(initialSettings);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<SettingsForm>(DEFAULT_FORM);

  const getSetting = useCallback((path: string): unknown => {
    return getByPath(state, path);
  }, [state]);

  const setSetting = useCallback((path: string, value: unknown, options: UseSettingOptions = {}) => {
    setState(prevState => {
      const newState = { ...prevState };
      
      // Coerce number if target currently a number
      const current = getByPath(newState, path);
      let nextValue = value;

      if (typeof current === "number") {
        const n = typeof value === "string" ? Number(value) : value;
        if (!Number.isFinite(n)) return newState;
        nextValue = n as number;

        const { clamp } = options;
        if (clamp) {
          if (clamp.round) nextValue = Math.round(nextValue as number);
          if (typeof clamp.min === "number") nextValue = Math.max(clamp.min, nextValue as number);
          if (typeof clamp.max === "number") nextValue = Math.min(clamp.max, nextValue as number);
        }
      }

      setByPath(newState, path, nextValue);
      return newState;
    });
  }, []);

  const useSetting = useCallback((path: string, options: UseSettingOptions = {}) => {
    const model = getSetting(path);
    const setModel = (value: unknown) => setSetting(path, value, options);
    const placeholder = String(model ?? "");

    return { model, setModel, placeholder };
  }, [getSetting, setSetting]);

  // Modal management
  const openModal = useCallback(() => {
    // Load current settings into form
    setForm({
      language: (getSetting("language") as string) || "en",
      theme: (getSetting("theme") as "light" | "dark") || "light",
      attendanceSendWidth: (getSetting("attendance.sendWidth") as number) || 640,
      attendanceJpegQuality: (getSetting("attendance.jpegQuality") as number) || 0.8,
      funSendWidth: (getSetting("funMeter.sendWidth") as number) || 640,
      funJpegQuality: (getSetting("funMeter.jpegQuality") as number) || 0.8,
      baseInterval: (getSetting("baseInterval") as number) || 1000,
    });
    setModalOpen(true);
  }, [getSetting]);

  const closeModal = useCallback(() => {
    setModalOpen(false);
  }, []);

  // Form management
  const submit = useCallback(() => {
    // Save form values to settings
    setSetting("language", form.language);
    setSetting("theme", form.theme);
    setSetting("attendance.sendWidth", form.attendanceSendWidth);
    setSetting("attendance.jpegQuality", form.attendanceJpegQuality);
    setSetting("funMeter.sendWidth", form.funSendWidth);
    setSetting("funMeter.jpegQuality", form.funJpegQuality);
    setSetting("baseInterval", form.baseInterval);
    
    closeModal();
  }, [form, setSetting, closeModal]);

  const reset = useCallback(() => {
    setForm(DEFAULT_FORM);
  }, []);

  const value: SettingsContextType = {
    state,
    getSetting,
    setSetting,
    useSetting,
    modalOpen,
    openModal,
    closeModal,
    form,
    setForm,
    submit,
    reset,
    languageOptions: LANGUAGE_OPTIONS,
  };

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsContextType {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error("useSettings must be used within a SettingsProvider");
  }
  return context;
}

export function useSetting(path: string, options: UseSettingOptions = {}) {
  const { useSetting: useSettingFromContext } = useSettings();
  return useSettingFromContext(path, options);
}
