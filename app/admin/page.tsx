"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Embers } from "../AsadoApp";
import { EVENT } from "@/lib/config";
import type { MyRsvp } from "@/lib/rsvp";

type Row = MyRsvp & { total: number; createdAt: string; updatedAt: string; items: string[] };
type Tab = "resumen" | "invitados" | "carros" | "llevar";
type Filter = "todos" | "van" | "no" | "porconfirmar" | "sinpagar" | "sincupo";

const KEY = "asado-admin-key";
const money = (n: number) => "$" + Math.round(n).toLocaleString("es-CO");
const AV = ["#ffb38a", "#c9d8a8", "#e8c97a", "#b9c9e0"];
const colorFor = (s: string) => AV[[...s].reduce((a, c) => a + c.charCodeAt(0), 0) % AV.length];
const initial = (s: string) => s.trim()[0]?.toUpperCase() || "?";
const store = {
  get: () => { try { return localStorage.getItem(KEY) || ""; } catch { return ""; } },
  set: (v: string) => {
    try {
      if (v) localStorage.setItem(KEY, v);
      else localStorage.removeItem(KEY);
    } catch { /* modo privado */ }
  },
};

function ago(ms: number) {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 10) return "ahora";
  if (s < 60) return `hace ${s} s`;
  const m = Math.round(s / 60);
  if (m < 60) return `hace ${m} min`;
  const h = Math.round(m / 60);
  return h < 24 ? `hace ${h} h` : `hace ${Math.round(h / 24)} d`;
}

/* ── Íconos (trazo, heredan el color) ── */
const I = {
  home: "M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z",
  users: "M16 19v-1a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v1M9 10a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7M22 19v-1a4 4 0 0 0-3-3.9M16 3.1a3.5 3.5 0 0 1 0 6.8",
  car: "M5 17h14M5 17a2 2 0 1 0 4 0M15 17a2 2 0 1 0 4 0M3 17v-4l2-5a2 2 0 0 1 2-1h10a2 2 0 0 1 2 1l2 5v4M3 12h18",
  list: "M9 6h11M9 12h11M9 18h11M4 6l1 1 2-2M4 12l1 1 2-2M4 18l1 1 2-2",
  refresh: "M20 11a8 8 0 0 0-14.9-3M4 4v4h4M4 13a8 8 0 0 0 14.9 3M20 20v-4h-4",
  more: "M12 6h.01M12 12h.01M12 18h.01",
  search: "M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM21 21l-4.3-4.3",
  check: "M5 12l5 5L20 7",
  trash: "M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3",
  download: "M12 4v12M7 11l5 5 5-5M5 20h14",
  copy: "M9 9h11v11H9zM5 15H4V4h11v1",
  eye: "M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6",
  eyeOff: "M3 3l18 18M10.6 5.1A10 10 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.2 4.1M6.6 6.6C3.8 8.4 2 12 2 12s3.5 7 10 7a9.7 9.7 0 0 0 5.4-1.6M9.9 9.9a3 3 0 0 0 4.2 4.2",
  out: "M15 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4M10 16l4-4-4-4M14 12H3",
  back: "M15 18l-6-6 6-6",
  chevron: "M6 9l6 6 6-6",
  lock: "M6 11h12v9H6zM8 11V8a4 4 0 1 1 8 0v3",
  alert: "M12 9v4M12 17h.01M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z",
  leaf: "M5 21c0-9 5-15 16-16-1 11-7 16-16 16zM5 21l7-7",
};
function Icon({ d, size = 20, sw = 1.8 }: { d: string; size?: number; sw?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={d} />
    </svg>
  );
}

export default function Admin() {
  const [key, setKey] = useState("");
  const [input, setInput] = useState("");
  const [show, setShow] = useState(false);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [booting, setBooting] = useState(true);
  const [loginError, setLoginError] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);
  const [tab, setTab] = useState<Tab>("resumen");
  const [filter, setFilter] = useState<Filter>("todos");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [menu, setMenu] = useState(false);
  const [toDelete, setToDelete] = useState<Row | null>(null);
  const [toast, setToast] = useState<{ msg: string; err?: boolean } | null>(null);
  const [lastSync, setLastSync] = useState(0);
  const [now, setNow] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const mainRef = useRef<HTMLDivElement>(null);

  const say = useCallback((msg: string, err = false) => {
    setToast({ msg, err });
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2800);
  }, []);

  const call = useCallback(async (k: string, init?: RequestInit) => {
    const res = await fetch("/api/admin", { ...init, headers: { "Content-Type": "application/json", "x-admin-key": k }, cache: "no-store" });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw Object.assign(new Error(json.error || "No pudimos conectar"), { status: res.status });
    setRows(json.rsvps);
    setLastSync(Date.now());
    return json.rsvps as Row[];
  }, []);

  // Sesión guardada
  useEffect(() => {
    const saved = store.get();
    setNow(Date.now());
    if (!saved) return setBooting(false);
    call(saved)
      .then(() => setKey(saved))
      .catch(() => store.set(""))
      .finally(() => setBooting(false));
  }, [call]);

  // En vivo: refresca cada 20 s con la pestaña visible
  const refresh = useCallback(async (manual = false) => {
    if (!key) return;
    setSyncing(true);
    try {
      await call(key);
      if (manual) say("Actualizado");
    } catch (e) {
      if ((e as { status?: number }).status === 401) logout("La clave cambió, vuelve a entrar");
      else if (manual) say("Sin conexión. Reintenta en un momento", true);
    } finally {
      setSyncing(false);
    }
  }, [key, call, say]);

  useEffect(() => {
    if (!key) return;
    const tick = () => document.visibilityState === "visible" && refresh();
    const t = setInterval(tick, 20000);
    const c = setInterval(() => setNow(Date.now()), 5000);
    document.addEventListener("visibilitychange", tick);
    return () => { clearInterval(t); clearInterval(c); document.removeEventListener("visibilitychange", tick); };
  }, [key, refresh]);

  useEffect(() => { mainRef.current?.scrollTo?.(0, 0); window.scrollTo(0, 0); }, [tab]);

  async function login(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || loggingIn) return;
    setLoggingIn(true);
    setLoginError("");
    try {
      await call(input.trim());
      setKey(input.trim());
      store.set(input.trim());
      setInput("");
    } catch (err) {
      setLoginError((err as { status?: number }).status === 401 ? "Esa no es la clave. Revisa mayúsculas y minúsculas." : (err as Error).message);
    } finally {
      setLoggingIn(false);
    }
  }

  function logout(msg?: string) {
    store.set("");
    setKey("");
    setRows(null);
    setMenu(false);
    if (msg) setLoginError(msg);
  }

  async function togglePaid(r: Row) {
    const next = !r.paidConfirmed;
    setRows((rs) => rs?.map((x) => (x.id === r.id ? { ...x, paidConfirmed: next } : x)) ?? rs);
    if (navigator.vibrate) navigator.vibrate(12);
    try {
      await call(key, { method: "PATCH", body: JSON.stringify({ id: r.id, paidConfirmed: next }) });
      say(next ? `Pago de ${r.name.split(" ")[0]} recibido ✓` : "Pago marcado como pendiente");
    } catch {
      setRows((rs) => rs?.map((x) => (x.id === r.id ? { ...x, paidConfirmed: !next } : x)) ?? rs);
      say("No se pudo guardar. Reintenta", true);
    }
  }

  async function remove(r: Row) {
    setToDelete(null);
    try {
      await call(key, { method: "DELETE", body: JSON.stringify({ id: r.id }) });
      setOpen(null);
      say(`Borramos la respuesta de ${r.name || "ese invitado"}`);
    } catch {
      say("No se pudo borrar", true);
    }
  }

  async function exportCsv() {
    setMenu(false);
    const res = await fetch("/api/admin/export", { headers: { "x-admin-key": key } });
    if (!res.ok) return say("No se pudo descargar", true);
    const url = URL.createObjectURL(await res.blob());
    Object.assign(document.createElement("a"), { href: url, download: "invitados-asado.csv" }).click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    say("Descargando Excel…");
  }

  /* ── Derivados ── */
  const d = useMemo(() => {
    const all = rows ?? [];
    const yes = all.filter((r) => r.attending === "si");
    const drivers = yes.filter((r) => r.ride === "driver");
    const driverIds = new Set(drivers.map((r) => r.id));
    const riders = (id: string) => yes.filter((r) => r.ride === "rider" && r.carId === id);
    const seekers = yes.filter((r) => r.ride === "rider" && (!r.carId || !driverIds.has(r.carId)));
    const pledged = yes.reduce((a, r) => a + r.total, 0);
    const received = yes.filter((r) => r.paidConfirmed).reduce((a, r) => a + r.total, 0);
    const toConfirm = yes.filter((r) => r.paid && !r.paidConfirmed);
    const unpaid = yes.filter((r) => !r.paid && !r.paidConfirmed);
    const diets: Record<string, string[]> = {};
    yes.forEach((r) => r.diet.filter((x) => x !== "Ninguna").forEach((x) => (diets[x] ||= []).push(r.name)));
    const claimed: Record<string, string> = {};
    all.forEach((r) => r.items.forEach((i) => (claimed[i] = r.name)));
    const driverName = new Map(drivers.map((r) => [r.id, r.name]));
    return {
      all, yes, drivers, riders, seekers, pledged, received, toConfirm, unpaid, diets, claimed, driverName,
      people: yes.reduce((a, r) => a + 1 + r.guests, 0),
      no: all.length - yes.length,
      freeSeats: drivers.reduce((a, r) => a + Math.max(0, r.seats - riders(r.id).length), 0),
    };
  }, [rows]);

  const counts: Record<Filter, number> = {
    todos: d.all.length,
    van: d.yes.length,
    no: d.no,
    porconfirmar: d.toConfirm.length,
    sinpagar: d.unpaid.length,
    sincupo: d.seekers.length,
  };
  const list = d.all
    .filter((r) => {
      if (filter === "van") return r.attending === "si";
      if (filter === "no") return r.attending === "no";
      if (filter === "porconfirmar") return d.toConfirm.includes(r);
      if (filter === "sinpagar") return d.unpaid.includes(r);
      if (filter === "sincupo") return d.seekers.includes(r);
      return true;
    })
    .filter((r) => !q.trim() || r.name.toLowerCase().includes(q.trim().toLowerCase()))
    .sort((a, b) => (a.attending === b.attending ? +new Date(b.updatedAt) - +new Date(a.updatedAt) : a.attending === "si" ? -1 : 1));

  const goList = (f: Filter) => { setFilter(f); setQ(""); setTab("invitados"); };

  async function copySummary() {
    const lines = [
      `🔥 ${EVENT.title} · ${EVENT.dateLabel}`,
      `👥 Van ${d.people} personas (${d.yes.length} respuestas) · ${d.no} no pueden`,
      `💰 Recibido ${money(d.received)} de ${money(d.pledged)} comprometidos`,
      d.unpaid.length ? `⏳ Falta que paguen: ${d.unpaid.map((r) => r.name.split(" ")[0]).join(", ")}` : "✅ Todos reportaron pago",
      `🚗 ${d.drivers.length} carros · ${d.freeSeats} cupos libres${d.seekers.length ? ` · Buscan cupo: ${d.seekers.map((r) => r.name.split(" ")[0]).join(", ")}` : ""}`,
      ...Object.entries(d.diets).map(([k, v]) => `🥗 ${k}: ${v.join(", ")}`),
      `📦 Falta quién lleve: ${EVENT.items.filter((i) => !d.claimed[i]).join(", ") || "nada, ¡todo apartado!"}`,
      `⚠️ Paguen antes del ${EVENT.payDeadline}`,
    ];
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      say("Resumen copiado. Pégalo en el grupo 📋");
    } catch {
      say("No se pudo copiar", true);
    }
  }

  /* ── Pantallas ── */
  if (booting) {
    return (
      <main className="ad-login">
        <div className="spinner" style={{ color: "#ff5a1f", width: 28, height: 28 }} />
      </main>
    );
  }

  if (!key || !rows) {
    return (
      <main className="ad-login">
        <Embers />
        <div className="glow" style={{ top: "auto", bottom: -140 }} />
        <form onSubmit={login} className="ad-login-card rise">
          <Link href="/" className="ad-ghost-link"><Icon d={I.back} size={18} /> Invitación</Link>
          <div className="ad-lock"><Icon d={I.lock} size={26} /></div>
          <div className="col" style={{ gap: 8 }}>
            <span className="kicker">Solo para quien organiza</span>
            <h1 className="h2" style={{ color: "#f5ede1" }}>Panel del <span className="ember">asado</span></h1>
            <p className="ad-login-sub">Mira quién va, confirma pagos y cuadra los carros.</p>
          </div>
          <label className="col" style={{ gap: 8 }}>
            <span className="label" style={{ color: "#a8988a" }}>Clave</span>
            <div className={"ad-pass" + (loginError ? " bad" : "")}>
              <input
                type={show ? "text" : "password"}
                value={input}
                onChange={(e) => { setInput(e.target.value); setLoginError(""); }}
                placeholder="••••••••••"
                autoComplete="current-password"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                enterKeyHint="go"
                autoFocus
              />
              <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? "Ocultar clave" : "Mostrar clave"}>
                <Icon d={show ? I.eyeOff : I.eye} size={20} />
              </button>
            </div>
            {loginError && <span className="ad-err" role="alert">{loginError}</span>}
          </label>
          <button className="btn btn-ember" disabled={!input.trim() || loggingIn}>
            {loggingIn ? <span className="spinner" /> : "Entrar"}
          </button>
        </form>
      </main>
    );
  }

  const goalPct = (n: number) => Math.min(100, (n / EVENT.fundGoal) * 100) + "%";

  return (
    <main className="ad" ref={mainRef}>
      {toast && <div className={"ad-toast" + (toast.err ? " err" : "")} role="status">{toast.msg}</div>}

      <header className="ad-head">
        <div className="col" style={{ gap: 2, minWidth: 0 }}>
          <span className="ad-live"><i />En vivo · {ago(now - lastSync)}</span>
          <h1 className="ad-title">{({ resumen: "Resumen", invitados: "Invitados", carros: "Carros", llevar: "Qué llevar" } as const)[tab]}</h1>
        </div>
        <div className="row" style={{ gap: 8 }}>
          <button className={"ad-icon-btn" + (syncing ? " spin" : "")} onClick={() => refresh(true)} aria-label="Actualizar"><Icon d={I.refresh} /></button>
          <button className="ad-icon-btn" onClick={() => setMenu(true)} aria-label="Más opciones"><Icon d={I.more} sw={3} /></button>
        </div>
      </header>

      <div className="ad-body">
        {tab === "resumen" && (
          <div className="col rise" style={{ gap: 14 }}>
            <section className="ad-hero">
              <span className="label" style={{ color: "#a8988a" }}>Recibido</span>
              <div className="row" style={{ alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
                <b className="ad-big">{money(d.received)}</b>
                <span style={{ color: "#a8988a", fontSize: 14 }}>de {money(d.pledged)} comprometido</span>
              </div>
              <div className="ad-bar">
                <div style={{ width: goalPct(d.received), background: "#ff5a1f" }} />
                <div style={{ width: goalPct(Math.max(0, d.pledged - d.received)), background: "rgba(245,237,225,.35)" }} />
              </div>
              <div className="row between" style={{ fontSize: 12, color: "#a8988a", gap: 10, flexWrap: "wrap" }}>
                <span><i className="ad-dot" style={{ background: "#ff5a1f" }} />Recibido</span>
                <span><i className="ad-dot" style={{ background: "rgba(245,237,225,.35)" }} />Por recibir</span>
                <span>Meta {money(EVENT.fundGoal)}</span>
              </div>
            </section>

            <div className="ad-grid">
              <button className="ad-stat" onClick={() => goList("van")}><b>{d.people}</b><span>personas van</span><small>{d.yes.length} respuestas</small></button>
              <button className="ad-stat" onClick={() => goList("no")}><b>{d.no}</b><span>no pueden ir</span><small>Ver quiénes</small></button>
              <button className="ad-stat" onClick={() => setTab("carros")}><b>{d.drivers.length}</b><span>carros</span><small>{d.freeSeats} cupos libres</small></button>
              <button className="ad-stat" onClick={() => setTab("llevar")}><b>{Object.keys(d.claimed).length}/{EVENT.items.length}</b><span>cosas apartadas</span><small>Qué llevar</small></button>
            </div>

            {(d.toConfirm.length > 0 || d.unpaid.length > 0 || d.seekers.length > 0) && <span className="label" style={{ paddingTop: 6 }}>Pendientes</span>}
            {d.toConfirm.length > 0 && (
              <button className="ad-alert hot" onClick={() => goList("porconfirmar")}>
                <span className="ad-alert-ic"><Icon d={I.check} /></span>
                <span className="col" style={{ flex: 1, gap: 2 }}><b>{d.toConfirm.length} dice{d.toConfirm.length === 1 ? "" : "n"} que ya pag{d.toConfirm.length === 1 ? "ó" : "aron"}</b><small>Revisa tu Bre-B y márcalos como recibidos</small></span>
                <Icon d={I.chevron} size={18} />
              </button>
            )}
            {d.unpaid.length > 0 && (
              <button className="ad-alert" onClick={() => goList("sinpagar")}>
                <span className="ad-alert-ic"><Icon d={I.alert} /></span>
                <span className="col" style={{ flex: 1, gap: 2 }}><b>{d.unpaid.length} sin pagar</b><small>{d.unpaid.slice(0, 4).map((r) => r.name.split(" ")[0]).join(", ")}{d.unpaid.length > 4 ? "…" : ""} · Límite {EVENT.payDeadline}</small></span>
                <Icon d={I.chevron} size={18} />
              </button>
            )}
            {d.seekers.length > 0 && (
              <button className="ad-alert" onClick={() => setTab("carros")}>
                <span className="ad-alert-ic"><Icon d={I.car} /></span>
                <span className="col" style={{ flex: 1, gap: 2 }}><b>{d.seekers.length} buscando cupo</b><small>{d.freeSeats ? `Hay ${d.freeSeats} puestos libres` : "No hay puestos libres todavía"}</small></span>
                <Icon d={I.chevron} size={18} />
              </button>
            )}

            {Object.keys(d.diets).length > 0 && (
              <>
                <span className="label" style={{ paddingTop: 6 }}>Ojo con la comida</span>
                <div className="ad-card col" style={{ gap: 12 }}>
                  {Object.entries(d.diets).map(([k, v]) => (
                    <div key={k} className="row" style={{ gap: 12, alignItems: "flex-start" }}>
                      <span className="ad-alert-ic" style={{ background: "#dde6cf", color: "#3f6b3a" }}><Icon d={I.leaf} size={18} /></span>
                      <span className="col" style={{ gap: 2 }}><b style={{ fontSize: 15 }}>{k} · {v.length}</b><small className="sub">{v.join(", ")}</small></span>
                    </div>
                  ))}
                </div>
              </>
            )}

            <span className="label" style={{ paddingTop: 6 }}>Compartir</span>
            <div className="ad-grid">
              <button className="ad-action" onClick={copySummary}><Icon d={I.copy} /> Copiar resumen</button>
              <button className="ad-action" onClick={exportCsv}><Icon d={I.download} /> Descargar Excel</button>
            </div>
          </div>
        )}

        {tab === "invitados" && (
          <div className="col rise" style={{ gap: 12 }}>
            <div className="ad-sticky">
              <label className="ad-search">
                <Icon d={I.search} size={18} />
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nombre" type="search" enterKeyHint="search" />
              </label>
              <div className="ad-chips" role="tablist">
                {([["todos", "Todos"], ["van", "Van"], ["porconfirmar", "Por confirmar"], ["sinpagar", "Sin pagar"], ["sincupo", "Sin cupo"], ["no", "No van"]] as const).map(([k, l]) => (
                  <button key={k} role="tab" aria-selected={filter === k} className={filter === k ? "on" : ""} onClick={() => setFilter(k)}>
                    {l} <span>{counts[k]}</span>
                  </button>
                ))}
              </div>
            </div>

            {list.length === 0 && (
              <div className="ad-empty">
                <b>{d.all.length === 0 ? "Todavía nadie ha respondido" : "Nadie por aquí"}</b>
                <span>{d.all.length === 0 ? "Manda el link por WhatsApp y aquí van a ir apareciendo." : "Prueba con otro filtro o nombre."}</span>
              </div>
            )}

            {list.map((r) => {
              const yes = r.attending === "si";
              const isOpen = open === r.id;
              const status = !yes ? null : r.paidConfirmed ? { t: "Recibido", c: "ok" } : r.paid ? { t: "Dice que pagó", c: "warn" } : { t: "Sin pagar", c: "" };
              const ride = !yes ? "" : r.ride === "driver" ? `Lleva carro · ${r.seats} cupos` : r.ride === "rider" ? (r.carId && d.driverName.get(r.carId) ? `Va con ${d.driverName.get(r.carId)}` : "Buscando cupo") : "Por su cuenta";
              return (
                <article key={r.id} className={"ad-guest" + (yes ? "" : " no") + (isOpen ? " open" : "")}>
                  <button className="ad-guest-top" onClick={() => setOpen(isOpen ? null : r.id)} aria-expanded={isOpen}>
                    <span className="ad-av" style={{ background: yes ? colorFor(r.name) : "#efe4d4" }}>{initial(r.name)}</span>
                    <span className="col" style={{ flex: 1, minWidth: 0, gap: 2 }}>
                      <b className="ad-name">{r.name || "(sin nombre)"}{yes && r.guests > 0 && <em> +{r.guests}</em>}</b>
                      <small className="sub ad-ellipsis">{yes ? ride : "No va"}</small>
                    </span>
                    {yes && (
                      <span className="col" style={{ alignItems: "flex-end", gap: 4 }}>
                        <b className="mono" style={{ fontSize: 14 }}>{money(r.total)}</b>
                        <span className={"ad-pill " + status!.c}>{status!.t}</span>
                      </span>
                    )}
                  </button>
                  {isOpen && (
                    <div className="ad-guest-more">
                      <dl>
                        {yes && <><dt>Personas</dt><dd>{1 + r.guests}{r.guests ? ` (${r.name.split(" ")[0]} + ${r.guests})` : ""}</dd></>}
                        {yes && <><dt>Comida</dt><dd>{r.diet.join(", ")}</dd></>}
                        {yes && <><dt>Transporte</dt><dd>{ride}{r.ride === "driver" && ` · sale de ${r.from}, ${r.time} a.m.${r.carModel ? ` · ${r.carModel}` : ""}`}</dd></>}
                        {yes && <><dt>Lleva</dt><dd>{r.items.length ? r.items.join(", ") : "—"}</dd></>}
                        {yes && <><dt>Aporte</dt><dd>{money(r.total)} · {r.method}{r.extra ? ` (incluye ${money(r.extra)} extra)` : ""}</dd></>}
                        <dt>Respondió</dt><dd>{ago(now - +new Date(r.createdAt))}{+new Date(r.updatedAt) - +new Date(r.createdAt) > 60000 ? ` · editó ${ago(now - +new Date(r.updatedAt))}` : ""}</dd>
                      </dl>
                      <div className="row" style={{ gap: 8 }}>
                        {yes && (
                          <button className={"ad-pay" + (r.paidConfirmed ? " done" : "")} onClick={() => togglePaid(r)}>
                            <Icon d={I.check} size={18} sw={2.4} /> {r.paidConfirmed ? "Pago recibido" : "Marcar recibido"}
                          </button>
                        )}
                        <button className="ad-del" onClick={() => setToDelete(r)} aria-label={`Borrar a ${r.name}`}><Icon d={I.trash} size={18} /></button>
                      </div>
                    </div>
                  )}
                  {!isOpen && yes && r.paid && !r.paidConfirmed && (
                    <button className="ad-quick" onClick={() => togglePaid(r)}><Icon d={I.check} size={16} sw={2.4} /> Confirmar pago</button>
                  )}
                </article>
              );
            })}
          </div>
        )}

        {tab === "carros" && (
          <div className="col rise" style={{ gap: 12 }}>
            <div className="ad-grid three">
              <div className="ad-mini dark"><b>{d.drivers.length}</b><span>carros</span></div>
              <div className="ad-mini hot"><b>{d.freeSeats}</b><span>cupos libres</span></div>
              <div className="ad-mini"><b>{d.seekers.length}</b><span>sin cupo</span></div>
            </div>
            {d.seekers.length > 0 && (
              <div className="ad-card hotline col" style={{ gap: 10 }}>
                <b>Buscando cupo</b>
                <div className="ad-tags">{d.seekers.map((r) => <span key={r.id} className="ad-tag">{r.name}{r.guests ? ` +${r.guests}` : ""}</span>)}</div>
                <small className="sub">{d.freeSeats ? "Hay puestos libres: diles que editen su respuesta y elijan carro." : "Nadie tiene puestos libres. Pregunta en el grupo quién puede llevar."}</small>
              </div>
            )}
            {d.drivers.length === 0 && <div className="ad-empty"><b>Nadie ha ofrecido carro</b><span>Cuando alguien diga &quot;Tengo carro&quot; aparece aquí.</span></div>}
            {d.drivers.map((c) => {
              const rs = d.riders(c.id);
              return (
                <div key={c.id} className="ad-card col" style={{ gap: 12 }}>
                  <div className="row" style={{ gap: 12 }}>
                    <span className="ad-av" style={{ background: colorFor(c.name) }}>{initial(c.name)}</span>
                    <span className="col" style={{ flex: 1, minWidth: 0 }}><b>{c.name}</b><small className="sub">{c.from} · {c.time} a.m.{c.carModel ? ` · ${c.carModel}` : ""}</small></span>
                    <span className={"ad-pill " + (rs.length >= c.seats ? "" : "ok")}>{rs.length >= c.seats ? "Lleno" : `${c.seats - rs.length} libre${c.seats - rs.length === 1 ? "" : "s"}`}</span>
                  </div>
                  <div className="ad-seats">{Array.from({ length: c.seats }, (_, i) => <i key={i} className={i < rs.length ? "on" : ""} />)}</div>
                  {rs.length > 0 && <div className="ad-tags">{rs.map((r) => <span key={r.id} className="ad-tag">{r.name}{r.guests ? ` +${r.guests}` : ""}</span>)}</div>}
                </div>
              );
            })}
          </div>
        )}

        {tab === "llevar" && (
          <div className="col rise" style={{ gap: 12 }}>
            <div className="ad-card col" style={{ gap: 10 }}>
              <div className="row between"><b>{Object.keys(d.claimed).length} de {EVENT.items.length} apartadas</b><span className="sub">{EVENT.items.length - Object.keys(d.claimed).length} libres</span></div>
              <div className="ad-bar light"><div style={{ width: (Object.keys(d.claimed).length / EVENT.items.length) * 100 + "%", background: "#1f1812" }} /></div>
            </div>
            <div className="ad-card" style={{ padding: "4px 16px" }}>
              {EVENT.items.map((it, i) => (
                <div key={it} className="row between ad-item" style={{ borderBottom: i < EVENT.items.length - 1 ? "1px solid rgba(31,24,18,.08)" : 0 }}>
                  <span className="row" style={{ gap: 12 }}>
                    <span className={"ad-check" + (d.claimed[it] ? " on" : "")}>{d.claimed[it] && <Icon d={I.check} size={14} sw={3} />}</span>
                    <b style={{ fontWeight: 600 }}>{it}</b>
                  </span>
                  <span className={d.claimed[it] ? "t15" : "ad-pill"} style={d.claimed[it] ? { fontWeight: 500, fontSize: 14 } : undefined}>{d.claimed[it] || "Libre"}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <nav className="ad-nav" aria-label="Secciones">
        {([["resumen", "Resumen", I.home, 0], ["invitados", "Invitados", I.users, d.toConfirm.length], ["carros", "Carros", I.car, d.seekers.length], ["llevar", "Llevar", I.list, 0]] as const).map(([k, l, ic, badge]) => (
          <button key={k} className={tab === k ? "on" : ""} onClick={() => setTab(k)} aria-current={tab === k ? "page" : undefined}>
            <span className="ad-nav-ic"><Icon d={ic} size={22} />{badge > 0 && <em>{badge}</em>}</span>
            {l}
          </button>
        ))}
      </nav>

      {(menu || toDelete) && <div className="ad-scrim" onClick={() => { setMenu(false); setToDelete(null); }} />}
      {menu && (
        <div className="ad-sheet" role="dialog" aria-label="Opciones">
          <i className="ad-grab" />
          <Link href="/" className="ad-sheet-row"><Icon d={I.back} /> Ver la invitación</Link>
          <button className="ad-sheet-row" onClick={exportCsv}><Icon d={I.download} /> Descargar Excel (CSV)</button>
          <button className="ad-sheet-row" onClick={() => { setMenu(false); copySummary(); }}><Icon d={I.copy} /> Copiar resumen para WhatsApp</button>
          <button className="ad-sheet-row danger" onClick={() => logout()}><Icon d={I.out} /> Cerrar sesión</button>
        </div>
      )}
      {toDelete && (
        <div className="ad-sheet" role="alertdialog" aria-label="Confirmar borrado">
          <i className="ad-grab" />
          <div className="col" style={{ gap: 6, padding: "4px 4px 8px" }}>
            <b style={{ font: "800 24px/1.1 var(--display)" }}>¿Borrar a {toDelete.name || "este invitado"}?</b>
            <span className="sub" style={{ fontSize: 14 }}>Se libera su cupo en el carro y lo que había apartado. No se puede deshacer.</span>
          </div>
          <button className="btn" style={{ background: "#b3261e", color: "#fff" }} onClick={() => remove(toDelete)}>Sí, borrar</button>
          <button className="btn btn-ghost light-ghost" onClick={() => setToDelete(null)}>Cancelar</button>
        </div>
      )}
    </main>
  );
}
