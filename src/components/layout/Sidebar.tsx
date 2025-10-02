"use client";

import React from "react";
import { Link, useLocation } from "react-router-dom";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Inbox, Send, LayoutTemplate, Settings, Users } from "lucide-react";
import UserProfileMenu from "@/components/auth/UserProfileMenu";
import { useUserRole } from "@/hooks/use-user-role";
import { useFeatureFlag } from "@/hooks/use-feature-flag";

interface NavLinkProps {
  to: string;
  icon: React.ElementType;
  label: string;
  isActive: boolean;
}

const NavLink = ({ to, icon: Icon, label, isActive }: NavLinkProps) => (
  <Tooltip>
    <TooltipTrigger asChild>
      <Button
        variant={isActive ? "secondary" : "ghost"}
        size="icon"
        className={`h-9 w-9 ${isActive ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"}`}
        asChild
      >
        <Link to={to}>
          <Icon className="h-5 w-5" />
          <span className="sr-only">{label}</span>
        </Link>
      </Button>
    </TooltipTrigger>
    <TooltipContent side="right">{label}</TooltipContent>
  </Tooltip>
);

const Sidebar = () => {
  const location = useLocation();
  const { role, isLoading } = useUserRole();
  const { enabled: assistantsSeeSettings, isLoading: loadingFlag } = useFeatureFlag("assistants_can_see_settings");

  // Mientras carga el rol, no mostrar nada (evita parpadeo)
  if (isLoading) {
    return (
      <aside className="flex h-screen flex-col items-center border-r bg-sidebar py-4 shadow-sm">
        <div className="flex-1 flex items-center justify-center">Cargando...</div>
      </aside>
    );
  }

  const showSettings =
    role === "admin" || role !== "asistente" || assistantsSeeSettings;

  return (
    <aside className="flex h-screen flex-col items-center border-r bg-sidebar py-4 shadow-sm">
      <nav className="flex flex-col items-center gap-4">
        <TooltipProvider>
          <NavLink to="/inbox" icon={Inbox} label="Inbox" isActive={location.pathname === "/inbox"} />

          {role !== "asistente" && (
            <NavLink to="/broadcasts" icon={Send} label="Envíos Masivos" isActive={location.pathname === "/broadcasts"} />
          )}

          {role !== "asistente" && (
            <NavLink to="/templates" icon={LayoutTemplate} label="Plantillas" isActive={location.pathname === "/templates"} />
          )}

          {role === "admin" && (
            <NavLink to="/users" icon={Users} label="Gestión de usuarios" isActive={location.pathname === "/users"} />
          )}

          {showSettings && (
            <NavLink to="/settings" icon={Settings} label="Configuración" isActive={location.pathname === "/settings"} />
          )}
        </TooltipProvider>
      </nav>
      <div className="mt-auto flex flex-col items-center gap-4">
        <TooltipProvider>
          <UserProfileMenu />
        </TooltipProvider>
      </div>
    </aside>
  );
};

export default Sidebar;