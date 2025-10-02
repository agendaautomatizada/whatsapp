"use client";

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useFeatureFlag(key: string) {
  const query = useQuery({
    queryKey: ["featureFlag", key],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("app_features")
        .select("value")
        .eq("key", key)
        .maybeSingle();

      if (error) throw error;

      const val = data?.value;
      if (val && typeof val === "object" && "enabled" in val) {
        return Boolean(val.enabled);
      }
      if (typeof val === "boolean") return val;
      return false;
    },
  });

  return { enabled: query.data ?? false, ...query };
}