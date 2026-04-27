import { useAppReadinessSignal } from "@/hooks/useAppReadinessSignal";
import { useAppSettings } from "@/lib/appSettings";
import { addBasePath } from "@/routes/routeUtils";

export default function NotFoundRoute() {
  const { copy } = useAppSettings();
  useAppReadinessSignal(true, "notfound");

  return (
    <main className="theme-page-bg h-dvh w-full flex flex-col items-center justify-center p-6 text-center">
      <h1 className="text-4xl font-black tracking-tight mb-3">{copy.notFound.title}</h1>
      <p className="theme-muted-text font-medium mb-8">{copy.notFound.description}</p>
      <a
        href={addBasePath("/")}
        target="_top"
        className="theme-primary-bg text-white font-bold py-3 px-6 rounded-2xl shadow-xl transition active:scale-95"
      >
        {copy.notFound.backToMenu}
      </a>
    </main>
  );
}
