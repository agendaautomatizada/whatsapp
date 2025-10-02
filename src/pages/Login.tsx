"use client";

import React, { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { MadeWithDyad } from "@/components/made-with-dyad";
import { useSupabase } from "@/components/auth/SessionContextProvider";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Eye, EyeOff } from "lucide-react";
import { showError, showSuccess, showLoading, dismissToast } from "@/utils/toast";

const Login = () => {
  const { session, isLoading } = useSupabase();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isLoading && session) {
      navigate("/inbox"); // Redirigir a /inbox después de iniciar sesión
    }
  }, [session, isLoading, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const toastId = showLoading("Iniciando sesión...");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    dismissToast(toastId);
    setLoading(false);
    if (error) {
      showError(error.message);
    } else {
      showSuccess("¡Bienvenido!");
      // Redirección automática por el useEffect
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background text-foreground p-4">
      <div className="w-full max-w-md p-8 space-y-6 bg-card rounded-lg shadow-lg">
        <h1 className="text-3xl font-bold text-center text-primary">Bienvenido</h1>
        <p className="text-center text-muted-foreground">Inicia sesión para continuar.</p>
        <form className="space-y-4" onSubmit={handleLogin}>
          <div>
            <label htmlFor="email" className="block text-sm font-medium mb-1">
              Correo electrónico
            </label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full"
              disabled={loading}
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium mb-1">
              Contraseña
            </label>
            <div className="relative">
              <Input
                id="password"
                type={showPass ? "text" : "password"}
                autoComplete="current-password"
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full pr-10"
                disabled={loading}
                style={{
                  color: "inherit",
                }}
              />
              <button
                type="button"
                tabIndex={-1}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-primary"
                onClick={() => setShowPass(v => !v)}
                aria-label={showPass ? "Ocultar contraseña" : "Mostrar contraseña"}
              >
                {showPass ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
          </div>
          <Button
            type="submit"
            className="w-full bg-primary text-white hover:bg-primary/90"
            disabled={loading}
          >
            {loading ? "Entrando..." : "Entrar"}
          </Button>
        </form>
      </div>
      <MadeWithDyad />
    </div>
  );
};

export default Login;