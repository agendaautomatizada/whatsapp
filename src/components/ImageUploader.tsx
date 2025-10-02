"use client";

import React, { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { showSuccess, showError, showLoading, dismissToast } from "@/utils/toast";

interface ImageUploaderProps {
  userId: string;
  folder?: string; // Carpeta opcional dentro del bucket
  onUpload?: (publicUrl: string) => void;
}

const BUCKET = "user-uploads";

const ImageUploader: React.FC<ImageUploaderProps> = ({ userId, folder = "", onUpload }) => {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Cargar imagen existente (si hay)
  React.useEffect(() => {
    if (!userId) return;
    const path = folder ? `${folder}/${userId}.jpg` : `${userId}.jpg`;
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
    if (data?.publicUrl) setImageUrl(data.publicUrl);
  }, [userId, folder]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const toastId = showLoading("Subiendo imagen...");
    const filePath = folder ? `${folder}/${userId}.jpg` : `${userId}.jpg`;

    // Subir archivo
    const { error } = await supabase.storage.from(BUCKET).upload(filePath, file, {
      cacheControl: "3600",
      upsert: true,
      contentType: file.type,
    });

    if (error) {
      showError("Error al subir imagen: " + error.message);
      setUploading(false);
      dismissToast(toastId);
      return;
    }

    // Obtener URL pública
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(filePath);
    if (data?.publicUrl) {
      setImageUrl(data.publicUrl);
      showSuccess("Imagen subida correctamente.");
      if (onUpload) onUpload(data.publicUrl);
    }
    setUploading(false);
    dismissToast(toastId);
  };

  return (
    <div className="flex flex-col items-center gap-2">
      {imageUrl && (
        <img
          src={imageUrl}
          alt="Imagen subida"
          className="w-32 h-32 object-cover rounded-full border"
        />
      )}
      <Input
        type="file"
        accept="image/*"
        ref={fileInputRef}
        onChange={handleFileChange}
        disabled={uploading}
      />
      <Button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        disabled={uploading}
      >
        {uploading ? "Subiendo..." : "Subir imagen"}
      </Button>
    </div>
  );
};

export default ImageUploader;