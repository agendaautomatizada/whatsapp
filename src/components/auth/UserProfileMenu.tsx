"use client";

import React, { useState } from "react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { UserCircle, LogOut, Mail, Key, User } from "lucide-react";
import { useSupabase } from "./SessionContextProvider";
import { showSuccess, showError, showLoading, dismissToast } from "@/utils/toast";

const UserProfileMenu = () => {
  const { supabase, session } = useSupabase();
  const user = session?.user;

  // Dialog state
  const [openDialog, setOpenDialog] = useState<null | "username" | "email" | "password">(null);

  // Form state
  const [username, setUsername] = useState(user?.user_metadata?.username || "");
  const [email, setEmail] = useState(user?.email || "");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [loading, setLoading] = useState(false);

  // Update username
  const handleUpdateUsername = async () => {
    setLoading(true);
    const toastId = showLoading("Actualizando nombre de usuario...");
    const { error } = await supabase.auth.updateUser({
      data: { username }
    });
    dismissToast(toastId);
    setLoading(false);
    if (error) {
      showError(error.message);
    } else {
      showSuccess("Nombre de usuario actualizado.");
      setOpenDialog(null);
    }
  };

  // Update email
  const handleUpdateEmail = async () => {
    setLoading(true);
    const toastId = showLoading("Actualizando correo...");
    const { error } = await supabase.auth.updateUser({
      email
    });
    dismissToast(toastId);
    setLoading(false);
    if (error) {
      showError(error.message);
    } else {
      showSuccess("Correo actualizado. Revisa tu email para confirmar el cambio.");
      setOpenDialog(null);
    }
  };

  // Update password
  const handleUpdatePassword = async () => {
    setLoading(true);
    const toastId = showLoading("Actualizando contraseña...");
    const { error } = await supabase.auth.updateUser({
      password: newPassword
    });
    dismissToast(toastId);
    setLoading(false);
    if (error) {
      showError(error.message);
    } else {
      showSuccess("Contraseña actualizada.");
      setOpenDialog(null);
      setPassword("");
      setNewPassword("");
    }
  };

  // Logout
  const handleLogout = async () => {
    setLoading(true);
    const toastId = showLoading("Cerrando sesión...");
    const { error } = await supabase.auth.signOut();
    dismissToast(toastId);
    setLoading(false);
    if (error) {
      showError(error.message);
    } else {
      showSuccess("Sesión cerrada.");
      // Redirige a login automáticamente por el SessionContextProvider
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            aria-label="Perfil"
          >
            <UserCircle className="h-5 w-5" />
            <span className="sr-only">Perfil</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => setOpenDialog("username")}>
            <User className="h-4 w-4 mr-2" /> Cambiar nombre de usuario
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setOpenDialog("email")}>
            <Mail className="h-4 w-4 mr-2" /> Cambiar correo
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setOpenDialog("password")}>
            <Key className="h-4 w-4 mr-2" /> Cambiar contraseña
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleLogout}>
            <LogOut className="h-4 w-4 mr-2" /> Cerrar sesión
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Dialogs */}
      <Dialog open={openDialog === "username"} onOpenChange={v => !v && setOpenDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cambiar nombre de usuario</DialogTitle>
          </DialogHeader>
          <Input
            value={username}
            onChange={e => setUsername(e.target.value)}
            placeholder="Nuevo nombre de usuario"
            disabled={loading}
          />
          <DialogFooter>
            <Button onClick={handleUpdateUsername} disabled={loading || !username}>
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={openDialog === "email"} onOpenChange={v => !v && setOpenDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cambiar correo</DialogTitle>
          </DialogHeader>
          <Input
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="Nuevo correo"
            type="email"
            disabled={loading}
          />
          <DialogFooter>
            <Button onClick={handleUpdateEmail} disabled={loading || !email}>
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={openDialog === "password"} onOpenChange={v => !v && setOpenDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cambiar contraseña</DialogTitle>
          </DialogHeader>
          <Input
            value={newPassword}
            onChange={e => setNewPassword(e.target.value)}
            placeholder="Nueva contraseña"
            type="password"
            disabled={loading}
          />
          <DialogFooter>
            <Button onClick={handleUpdatePassword} disabled={loading || !newPassword}>
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default UserProfileMenu;