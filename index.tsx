import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  return (
    <div
      className="flex min-h-screen items-center justify-center"
      style={{ background: "linear-gradient(160deg,#1c0e05 0%,#2d1a08 50%,#1a0d03 100%)" }}
    >
      <div className="text-center space-y-6 px-6">
        <div className="w-20 h-20 mx-auto rounded-full flex items-center justify-center text-4xl shadow-2xl"
          style={{ background: "linear-gradient(135deg,#c8891a,#a06010)" }}>
          ☕
        </div>
        <div>
          <h1 className="text-4xl font-serif font-bold text-amber-50">Holly Cafe</h1>
          <p className="text-xs font-semibold tracking-[0.4em] text-amber-400/60 uppercase mt-1">Dire Dawa · Ethiopia</p>
        </div>
        <div className="flex flex-col gap-3 max-w-xs mx-auto">
          <Link to="/menu" search={{ table: "12" } as any} className="rounded-xl px-5 py-3 font-semibold text-amber-50"
            style={{ background: "linear-gradient(135deg,#c8891a,#a06010)" }}>
            Customer Menu (Table 12)
          </Link>
          <Link to="/staff" className="rounded-xl px-5 py-3 font-semibold text-amber-100 border border-amber-600/30 hover:bg-amber-900/20">
            Staff Terminal
          </Link>
        </div>
      </div>
    </div>
  );
}
