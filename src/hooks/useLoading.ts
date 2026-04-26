import { useEffect, useState } from "preact/hooks";
import { loadingService } from "@/services/loading";

/**
 * Hook to subscribe to the global loading state.
 */
export const useLoading = () => {
  const [isLoading, setIsLoading] = useState(loadingService.isLoading());

  useEffect(() => {
    return loadingService.subscribe(setIsLoading);
  }, []);

  return isLoading;
};
