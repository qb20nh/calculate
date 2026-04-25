import { addBasePath } from "@/routes/routeUtils";

export default function NotFoundRoute() {
  return (
    <main className="h-screen w-full flex flex-col items-center justify-center bg-slate-50 p-6 text-center">
      <h1 className="text-4xl font-black text-slate-800 tracking-tight mb-3">Page not found</h1>
      <p className="text-slate-500 font-medium mb-8">This puzzle route does not exist.</p>
      <a
        href={addBasePath("/")}
        target="_top"
        className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-6 rounded-2xl shadow-xl transition active:scale-95"
      >
        Back to menu
      </a>
    </main>
  );
}
