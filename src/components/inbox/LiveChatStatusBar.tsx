"use client";

import React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useLiveChatState } from "@/hooks/use-live-chat-state";
import { getAppSettings } from "@/utils/toggleLiveChat";
import { Loader2, Clock } from "lucide-react";
import { extractPhone } from "@/utils/extractPhone";

function fmt(ms: number) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const ss = String(s % 60).padStart(2, "0");
  return `${m}:${ss}`;
}

interface LiveChatStatusBarProps {
  sessionId: string;
}

const ProgressBar = ({ percent }: { percent: number }) => (
  <div className="w-full h-2 bg-gray-200 rounded mt-2 overflow-hidden">
    <div
      className="h-2 bg-blue-500 transition-all duration-100"
      style={{ width: `${percent}%` }}
    />
  </div>
);

const LiveChatStatusBar: React.FC<LiveChatStatusBarProps> = ({ sessionId }) => {
  const phone = extractPhone(sessionId);

  React.useEffect(() => {
    console.log("[LiveChatStatusBar] sessionId prop:", sessionId, "→ phone:", phone);
  }, [sessionId, phone]);

  const {
    route,
    lockUntil,
    isLoading,
    error,
    remainingMs,
    onLock,
    onUnlock,
    isProgressBarActive,
    progressBarPercent,
  } = useLiveChatState(phone);

  const { liveChatTTL } = getAppSettings();

  const isButtonDisabled = !phone || isLoading || isProgressBarActive;

  return (
    <div className="flex flex-col md:flex-row md:items-center gap-2 p-2 border-b bg-muted" data-live-status-bar>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span>
              {route === "bot" ? (
                <Badge variant="outline" className="bg-green-100 text-green-700">
                  🟢 Bot
                </Badge>
              ) : (
                <Badge variant="outline" className="bg-red-100 text-red-700 flex items-center gap-1">
                  🔴 Chat en vivo
                  {lockUntil && (
                    <>
                      <Clock className="h-4 w-4 ml-1" />
                      <span>
                        hasta {new Date(lockUntil).toLocaleTimeString()}
                        {remainingMs > 0 && (
                          <> ({fmt(remainingMs)})</>
                        )}
                      </span>
                    </>
                  )}
                </Badge>
              )}
            </span>
          </TooltipTrigger>
          <TooltipContent>
            {lockUntil ? (
              <span>lock_until: {lockUntil}</span>
            ) : (
              <span>Sin bloqueo activo</span>
            )}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <div className="flex gap-2 flex-wrap">
        {route === "bot" ? (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <Button
                    size="sm"
                    onClick={onLock}
                    disabled={isButtonDisabled}
                    className="bg-red-600 text-white hover:bg-red-700"
                    data-live-action="lock"
                  >
                    {isLoading || isProgressBarActive ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : null}
                    Pasar a Chat en vivo ({liveChatTTL}h)
                  </Button>
                </span>
              </TooltipTrigger>
              {isButtonDisabled && (
                <TooltipContent>
                  Selecciona un contacto o espera el cambio
                </TooltipContent>
              )}
            </Tooltip>
          </TooltipProvider>
        ) : (
          <>
            <Button
              size="sm"
              onClick={onUnlock}
              disabled={isButtonDisabled}
              className="bg-green-600 text-white hover:bg-green-700"
            >
              {isLoading || isProgressBarActive ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : null}
              Volver a Bot
            </Button>
          </>
        )}
      </div>
      <div className="flex-1 min-w-[120px]">
        {isProgressBarActive && <ProgressBar percent={progressBarPercent} />}
      </div>
      {error && (
        <div className="text-xs text-red-600 mt-1">{error}</div>
      )}
    </div>
  );
};

export default LiveChatStatusBar;