"use client";

import React, { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, RefreshCw, ImageOff } from "lucide-react";
import { useSupabase } from "@/components/auth/SessionContextProvider";

const BUCKET = "user-uploads";

const ImageGallery: React.FC = () => {
  const { session } = useSupabase();
  const [images, setImages] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchImages = async () => {
    setLoading(true);
    setError(null);
    setImages([]);
    try {
      // Listar archivos del bucket (solo en la raíz)
      const { data, error } = await supabase.storage.from(BUCKET).list("", { limit: 100, offset: 0 });
      if (error) throw error;
      if (!data || data.length === 0) {
        setImages([]);
        setLoading(false);
        return;
      }
      // Obtener URLs públicas
      const urls = data
        .filter((file) => file.name.match(/\.(jpg|jpeg|png|gif|webp)$/i))
        .map((file) => {
          const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(file.name);
          return urlData?.publicUrl;
        })
        .filter(Boolean) as string[];
      setImages(urls);
    } catch (err: any) {
      setError(err.message || "Error al cargar imágenes");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (session) fetchImages();
    // eslint-disable-next-line
  }, [session]);

  if (!session) {
    return (
      <Card className="my-8">
        <CardContent className="p-6 text-center text-muted-foreground">
          Debes iniciar sesión para ver la galería de imágenes.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="my-8">
      <CardContent>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Galería de imágenes (user-uploads)</h2>
          <Button variant="outline" size="sm" onClick={fetchImages} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Recargar
          </Button>
        </div>
        {loading ? (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin mb-2" />
            <span className="text-muted-foreground">Cargando imágenes...</span>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-12 text-red-500">
            <ImageOff className="h-8 w-8 mb-2" />
            <span>{error}</span>
          </div>
        ) : images.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <ImageOff className="h-8 w-8 mb-2" />
            <span>No hay imágenes en el bucket.</span>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {images.map((url, idx) => (
              <div key={idx} className="aspect-square bg-muted rounded-lg overflow-hidden flex items-center justify-center">
                <img
                  src={url}
                  alt={`Imagen ${idx + 1}`}
                  className="object-cover w-full h-full transition-transform duration-200 hover:scale-105"
                  loading="lazy"
                />
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ImageGallery;