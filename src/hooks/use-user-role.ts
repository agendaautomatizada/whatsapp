import { useQuery } from "@tanstack/react-query";
import { useSupabase } from "@/components/auth/SessionContextProvider";
import { supabase } from "@/integrations/supabase/client";

export function useUserRole() {
  const { session } = useSupabase();
  const userId = session?.user?.id;

  const { data, isLoading, error } = useQuery({
    queryKey: ["userRole", userId],
    queryFn: async () => {
      if (!userId) {
        console.log("useUserRole: No userId, returning null role.");
        return null;
      }
      // Buscar perfil
      let { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("role, first_name, last_name") // También seleccionamos nombre para el caso de creación
        .eq("id", userId)
        .single();
      
      // Si no existe, lo crea como asistente
      if (profileError && profileError.code === "PGRST116") { // PGRST116 = No rows found
        console.log("useUserRole: Profile not found, creating as 'asistente'.");
        const { error: insertError } = await supabase.from("profiles").insert({
          id: userId,
          email: session?.user?.email,
          first_name: session?.user?.user_metadata?.first_name || "",
          last_name: session?.user?.user_metadata?.last_name || "",
          role: "asistente", // Rol por defecto para nuevos perfiles
        });
        if (insertError) {
          console.error("useUserRole: Error al crear perfil por defecto:", insertError);
          throw insertError;
        }
        profileData = { role: "asistente", first_name: session?.user?.user_metadata?.first_name || "", last_name: session?.user?.user_metadata?.last_name || "" };
      } else if (profileError) {
        console.error("useUserRole: Error al obtener perfil:", profileError);
        throw profileError;
      }
      console.log(`useUserRole: Fetched role for user ${userId}: ${profileData?.role}`);
      return profileData?.role || null;
    },
    enabled: !!userId,
    staleTime: 0, // Forzar refetch en cada montaje para depuración
  });

  return {
    role: data,
    isLoading,
    error,
  };
}