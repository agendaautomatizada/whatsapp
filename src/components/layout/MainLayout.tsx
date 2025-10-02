"use client";

import React, { useEffect } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import Sidebar from "./Sidebar";
import { ThemeProvider } from "next-themes";
import { useSupabase } from "../auth/SessionContextProvider"; // Importar useSupabase

const MainLayout = () => {
  const { session, isLoading } = useSupabase();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading && !session) {
      // Si no está cargando y no hay sesión, redirigir a la página de login
      navigate("/login");
    }
  }, [session, isLoading, navigate]);

  if (isLoading) {
    // Mostrar un spinner o mensaje de carga mientras se verifica la sesión
    return (
      <div className="flex items-center justify-center h-screen bg-background text-foreground">
        Cargando...
      </div>
    );
  }

  if (!session) {
    // Si no hay sesión y ya no está cargando, no renderizar el layout principal
    // La redirección ya se manejó en el useEffect
    return null;
  }

  return (
    // Forzamos tema claro: defaultTheme="light" y deshabilitamos enableSystem
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
      <div className="flex h-screen">
        <Sidebar />
        <main className="flex-1 overflow-hidden">
          <Outlet />
        </main>
      </div>
    </ThemeProvider>
  );
};

export default MainLayout;