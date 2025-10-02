import { useCallback, useEffect, useRef, useState } from "react";
import { toggleLiveChat, getAppSettings, fetchLiveChatStatus } from "@/utils/toggleLiveChat";
import { showError, showSuccess } from "@/utils/toast";

export interface LiveChatState {
  sessionId: string;
  route: "bot" | "inbox";
  lockUntil: string | null;
  isLoading: boolean;
  error: string | null;
  remainingMs: number;
  onLock: () => Promise<void>;
  onUnlock: () => Promise<void>;
  onExtend: (hours?: number) => Promise<void>;
  refresh: () => void;
  isProgressBarActive: boolean;
  progressBarPercent: number;
}

const cache: Record<string, { route: "bot" | "inbox"; lockUntil: string | null }> = {};

export function useLiveChatState(sessionId: string | null): LiveChatState {
  const [route, setRoute] = useState<"bot" | "inbox">("bot");
  const [lockUntil, setLockUntil] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [remainingMs, setRemainingMs] = useState(0);

  // Barra de progreso
  const [isProgressBarActive, setIsProgressBarActive] = useState(false);
  const [progressBarPercent, setProgressBarPercent] = useState(0);
  const progressTimerRef = useRef<NodeJS.Timeout | null>(null);

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  // Cargar estado real al abrir conversación
  useEffect(() => {
    let cancelled = false;
    if (!sessionId) return;
    setIsLoading(true);
    fetchLiveChatStatus(sessionId).then(({ route, lockUntil }) => {
      if (cancelled) return;
      setRoute(route);
      setLockUntil(lockUntil);
      setIsLoading(false);
      setError(null);
    }).catch(() => {
      if (cancelled) return;
      setRoute("bot");
      setLockUntil(null);
      setIsLoading(false);
    });
    return () => { cancelled = true; };
  }, [sessionId]);

  // Guardar en cache local
  useEffect(() => {
    if (!sessionId) return;
    cache[sessionId] = { route, lockUntil };
  }, [sessionId, route, lockUntil]);

  // Countdown sincronizado
  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (route !== "inbox" || !lockUntil) {
      setRemainingMs(0);
      return;
    }
    function update() {
      const diff = new Date(lockUntil).getTime() - Date.now();
      setRemainingMs(Math.max(diff, 0));
      if (diff <= 0) {
        setRoute("bot");
        setLockUntil(null);
        setRemainingMs(0);
        clearInterval(intervalRef.current!);
      }
    }
    update();
    intervalRef.current = setInterval(update, 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [route, lockUntil]);

  // Polling cada 60s
  useEffect(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    if (!sessionId) return;
    pollRef.current = setInterval(async () => {
      const { route: serverRoute, lockUntil: serverLock } = await fetchLiveChatStatus(sessionId);
      // Reconciliación: confiar en servidor
      if (serverRoute !== route || serverLock !== lockUntil) {
        setRoute(serverRoute);
        setLockUntil(serverLock);
      } else if (
        serverRoute === "inbox" &&
        lockUntil &&
        serverLock &&
        Math.abs(new Date(serverLock).getTime() - new Date(lockUntil).getTime()) > 5000
      ) {
        setLockUntil(serverLock);
      }
    }, 60000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
    // eslint-disable-next-line
  }, [sessionId, route, lockUntil]);

  // Refrescar al volver el foco
  useEffect(() => {
    function onFocus() {
      if (!sessionId) return;
      fetchLiveChatStatus(sessionId).then(({ route: serverRoute, lockUntil: serverLock }) => {
        setRoute(serverRoute);
        setLockUntil(serverLock);
      });
    }
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [sessionId]);

  // Barra de progreso animada (10s)
  const startProgressBar = useCallback(async (action: () => Promise<void>) => {
    setIsProgressBarActive(true);
    setProgressBarPercent(0);
    let percent = 0;
    const duration = 10000; // 10 segundos
    const interval = 100; // ms
    const steps = duration / interval;
    let step = 0;

    if (progressTimerRef.current) clearInterval(progressTimerRef.current);

    progressTimerRef.current = setInterval(() => {
      step += 1;
      percent = Math.min(100, (step / steps) * 100);
      setProgressBarPercent(percent);
      if (percent >= 100) {
        clearInterval(progressTimerRef.current!);
      }
    }, interval);

    // Ejecutar la acción (lock/unlock) al inicio
    await action();

    // Esperar 10s
    await new Promise((resolve) => setTimeout(resolve, duration));

    // Al terminar, refrescar estado real
    if (sessionId) {
      const { route: realRoute, lockUntil: realLock } = await fetchLiveChatStatus(sessionId);
      setRoute(realRoute);
      setLockUntil(realLock);
    }
    setIsProgressBarActive(false);
    setProgressBarPercent(0);
  }, [sessionId]);

  // Handlers
  const onLock = useCallback(async () => {
    if (!sessionId) {
      showError("Falta sessionId");
      return;
    }
    setIsLoading(true);
    setError(null);
    const { liveChatTTL } = getAppSettings();
    const optimisticUntil = new Date(Date.now() + 3600e3 * liveChatTTL).toISOString();
    const prev = { route, lockUntil };
    setRoute("inbox");
    setLockUntil(optimisticUntil);

    await startProgressBar(async () => {
      try {
        const res = await toggleLiveChat({ sessionId, action: "lock", ttlHours: liveChatTTL });
        setRoute(res.route);
        setLockUntil(res.lock_until);
        showSuccess(`Chat en vivo hasta ${res.lock_until ? new Date(res.lock_until).toLocaleTimeString() : ""}`);
      } catch (e: any) {
        setRoute(prev.route);
        setLockUntil(prev.lockUntil);
        setError(e.message);
        showError(`No se pudo activar: ${e.message}`);
      } finally {
        setIsLoading(false);
      }
    });
  }, [sessionId, route, lockUntil, startProgressBar]);

  const onUnlock = useCallback(async () => {
    if (!sessionId) {
      showError("Falta sessionId");
      return;
    }
    setIsLoading(true);
    setError(null);
    const prev = { route, lockUntil };
    setRoute("bot");
    setLockUntil(null);

    await startProgressBar(async () => {
      try {
        const res = await toggleLiveChat({ sessionId, action: "unlock" });
        setRoute(res.route);
        setLockUntil(res.lock_until);
        showSuccess("Ruta: Bot");
      } catch (e: any) {
        setRoute(prev.route);
        setLockUntil(prev.lockUntil);
        setError(e.message);
        showError(`No se pudo desactivar: ${e.message}`);
      } finally {
        setIsLoading(false);
      }
    });
  }, [sessionId, route, lockUntil, startProgressBar]);

  const onExtend = useCallback(async (hours: number = 4) => {
    if (!sessionId) {
      showError("Falta sessionId");
      return;
    }
    setIsLoading(true);
    setError(null);
    const prev = { route, lockUntil };
    const base = lockUntil ? new Date(lockUntil).getTime() : Date.now();
    const optimistic = new Date(base + hours * 3600e3).toISOString();
    setLockUntil(optimistic);
    try {
      const res = await toggleLiveChat({ sessionId, action: "extend", ttlHours: hours });
      setLockUntil(res.lock_until);
      showSuccess(`Extendido hasta ${res.lock_until ? new Date(res.lock_until).toLocaleTimeString() : ""}`);
    } catch (e: any) {
      setLockUntil(prev.lockUntil);
      setError(e.message);
      showError(`No se pudo extender: ${e.message}`);
    } finally {
      setIsLoading(false);
    }
  }, [sessionId, lockUntil]);

  // Permite refrescar desde fuera (por si hay endpoint futuro)
  const refresh = useCallback(() => {
    if (!sessionId) return;
    fetchLiveChatStatus(sessionId).then(({ route, lockUntil }) => {
      setRoute(route);
      setLockUntil(lockUntil);
    });
  }, [sessionId]);

  // Limpiar timer al desmontar
  useEffect(() => {
    return () => {
      if (progressTimerRef.current) clearInterval(progressTimerRef.current);
    };
  }, []);

  return {
    sessionId: sessionId || "",
    route,
    lockUntil,
    isLoading,
    error,
    remainingMs,
    onLock,
    onUnlock,
    onExtend,
    refresh,
    isProgressBarActive,
    progressBarPercent,
  };
}