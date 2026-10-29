"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { EventConfig } from "@/lib/config";
import type { MyRsvp, PublicState, Ride } from "@/lib/rsvp";

type Screen = "intro" | "invite" | "rsvp" | "ride" | "pay" | "done" | "hub";
type Tab = "carros" | "fondo" | "llevar" | "dia";

interface Draft {
  name: string;
  attending: "si" | "no" | null;
  guests: number;
  diet: string[];
  ride: Ride | null;
  from: string;
  time: string;
  seats: number;
  carModel: string;
  carId: string | null;
  extra: number;
  method: string;
}

const FLOW: Screen[] = ["rsvp", "ride", "pay"];
const AV = ["#ffb38a", "#c9d8a8", "#e8c97a", "#b9c9e0", "#f5ede1"];
const money = (n: number) => "$" + Math.round(n).toLocaleString("es-CO");
const pad = (n: number) => String(n).padStart(2, "0");
const firstName = (n: string) => n.trim().split(" ")[0] || "parcero";
const colorFor = (s: string) => AV[[...s].reduce((a, c) => a + c.charCodeAt(0), 0) % 4];

const TOKEN_KEY = "asado-token";
const DRAFT_KEY = "asado-draft";
const store = {
  get(k: string) {
    try { return localStorage.getItem(k); } catch { return null; }
  },
  set(k: string, v: string) {
    try { localStorage.setItem(k, v); } catch { /* modo privado */ }
  },
};

function guestToken() {
  let t = store.get(TOKEN_KEY);
  if (!t || !/^[A-Za-z0-9-]{16,64}$/.test(t)) {
    t = typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, "0")).join("");
    store.set(TOKEN_KEY, t);
  }
  return t;
}

const draftFrom = (me: MyRsvp | null, cfg: EventConfig): Draft => ({
  name: me?.name ?? "",
  attending: me?.attending ?? null,
  guests: me?.guests ?? 0,
  diet: me?.diet?.length ? me.diet : ["Ninguna"],
  ride: me?.ride ?? null,
  from: me?.from ?? cfg.fromOptions[0],
  time: me?.time ?? cfg.timeOptions[2] ?? cfg.timeOptions[0],
  seats: me?.seats ?? 3,
  carModel: me?.carModel ?? "",
  carId: me?.carId ?? null,
  extra: me?.extra ?? cfg.extraOptions[1] ?? 0,
  method: me?.method ?? Object.keys(cfg.payments)[0],
});

const Embers = memo(function Embers() {
  return (
    <div className="embers" aria-hidden>
      {Array.from({ length: 22 }, (_, i) => (
        <span
          key={i}
          style={{
            left: `${(i * 37) % 100}%`,
            width: 2 + (i % 3),
            height: 2 + (i % 3),
            background: i % 4 ? "#ff7a3d" : "#ffd0a8",
            animation: `ember ${6 + (i % 5) * 1.6}s linear ${(i * 0.7) % 8}s infinite`,
          }}
        />
      ))}
    </div>
  );
});

export default function AsadoApp({ cfg }: { cfg: EventConfig }) {
  const [token, setToken] = useState<string | null>(null);
  const [data, setData] = useState<PublicState | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [screen, setScreen] = useState<Screen>("intro");
  const [tab, setTab] = useState<Tab>("carros");
  const [d, setD] = useState<Draft>(() => draftFrom(null, cfg));
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ msg: string; err?: boolean } | null>(null);
  const [copied, setCopied] = useState(false);
  const [now, setNow] = useState<number | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const me = data?.me ?? null;
  const set = (patch: Partial<Draft>) => setD((p) => ({ ...p, ...patch }));

  const say = useCallback((msg: string, err = false) => {
    setToast({ msg, err });
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), err ? 6000 : 3000);
  }, []);

  const api = useCallback(
    async (path: string, init?: RequestInit): Promise<PublicState> => {
      const res = await fetch(path, {
        ...init,
        headers: { "Content-Type": "application/json", "x-guest-token": token ?? guestToken(), ...init?.headers },
        cache: "no-store",
      });
      const json = await res.json().catch(() => ({ error: "Respuesta inválida del servidor" }));
      if (!res.ok) throw new Error(json.error || "Algo salió mal");
      return json;
    },
    [token],
  );

  const refresh = useCallback(async () => {
    try {
      setData(await api("/api/state"));
      setLoadError(false);
    } catch {
      setLoadError(true);
    }
  }, [api]);

  // Arranque: token del celular, datos del servidor y borrador guardado.
  useEffect(() => {
    const t = guestToken();
    setToken(t);
    setNow(Date.now());
    (async () => {
      try {
        const res = await fetch("/api/state", { headers: { "x-guest-token": t }, cache: "no-store" });
        if (!res.ok) throw new Error();
        const s: PublicState = await res.json();
        setData(s);
        const saved = store.get(DRAFT_KEY);
        if (s.me) {
          setD(draftFrom(s.me, cfg));
          setScreen("done");
        } else if (saved) {
          try { setD({ ...draftFrom(null, cfg), ...JSON.parse(saved) }); } catch { /* borrador dañado */ }
        }
      } catch {
        setLoadError(true);
      }
    })();
  }, [cfg]);

  // Guarda el borrador mientras llena el formulario (por si se cierra el navegador).
  useEffect(() => {
    if (token && !me) store.set(DRAFT_KEY, JSON.stringify(d));
  }, [d, token, me]);

  // Cuenta regresiva
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // Datos en vivo: refresca cada 15 s mientras la pestaña está visible, y al volver a ella.
  useEffect(() => {
    if (!token) return;
    const tick = () => document.visibilityState === "visible" && refresh();
    const t = setInterval(tick, 15000);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [token, refresh]);

  // Vuelve arriba al cambiar de pantalla
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    scrollRef.current?.scrollTo(0, 0);
  }, [screen]);

  /* ── Derivados ── */
  const target = new Date(cfg.startISO).getTime();
  const diff = now === null ? 0 : Math.max(0, target - now);
  const cd = { d: Math.floor(diff / 864e5), h: Math.floor(diff / 36e5) % 24, m: Math.floor(diff / 6e4) % 60, s: Math.floor(diff / 1e3) % 60 };
  const yes = d.attending === "si";
  const people = 1 + d.guests;
  const base = people * cfg.fee;
  const myTotal = base + d.extra;
  const idx = FLOW.indexOf(screen);
  const meSavedTotal = me?.attending === "si" ? (1 + me.guests) * cfg.fee + me.extra : 0;

  // Carros que puede elegir el pasajero (sin contarse a sí mismo y sin su propio carro).
  const rideCars = useMemo(
    () =>
      (data?.cars ?? [])
        .filter((c) => !c.mine)
        .map((c) => ({ ...c, others: c.riders.filter((r) => !r.mine).map((r) => r.n) })),
    [data],
  );
  const freeSeats = rideCars.reduce((a, c) => a + Math.max(0, c.seats - c.others.length), 0);
  const myRiders = data?.cars.find((c) => c.mine)?.riders.length ?? 0;
  const myCar = rideCars.find((c) => c.id === d.carId);

  let nextDisabled = busy;
  if (screen === "rsvp") nextDisabled ||= !d.attending || (yes && !d.name.trim());
  // Si necesita cupo puede seguir sin elegir carro: queda en "Buscando cupo".
  if (screen === "ride") nextDisabled ||= !d.ride;
  const seeking = d.ride === "rider" && !myCar;

  const rideLine = (r: Pick<Draft, "ride" | "seats" | "from" | "time" | "carId">) => {
    if (r.ride === "driver") return `Llevas ${r.seats} desde ${r.from}, ${r.time} a.m.`;
    if (r.ride === "rider") {
      const c = data?.cars.find((x) => x.id === r.carId);
      return c ? `Con ${c.driver} · ${c.from}, ${c.time} a.m.` : "Buscando cupo";
    }
    return "Llegas por tu cuenta";
  };

  /* ── Acciones ── */
  async function submit() {
    setBusy(true);
    try {
      const s = await api("/api/rsvp", { method: "PUT", body: JSON.stringify({ ...d, carId: d.ride === "rider" ? d.carId : null }) });
      setData(s);
      if (s.me) setD(draftFrom(s.me, cfg));
      store.set(DRAFT_KEY, "");
      setScreen("done");
      say(d.attending === "si" ? "¡Listo! Quedaste confirmado 🔥" : "Respuesta enviada");
    } catch (e) {
      const msg = (e as Error).message;
      say(msg, true);
      if (/carro|cupo|llen/i.test(msg)) {
        await refresh();
        set({ carId: null });
        setScreen("ride");
      }
    } finally {
      setBusy(false);
    }
  }

  function next() {
    if (nextDisabled) return;
    if (screen === "rsvp") {
      if (yes) setScreen("ride");
      else submit();
    } else if (screen === "ride") setScreen("pay");
    else submit();
  }

  async function togglePaid() {
    if (!me) return;
    try {
      setData(await api("/api/rsvp/paid", { method: "PATCH", body: JSON.stringify({ paid: !me.paid }) }));
    } catch (e) {
      say((e as Error).message, true);
    }
  }

  async function claim(item: string) {
    if (me?.attending !== "si") return say("Confirma tu asistencia para apartar cosas", true);
    try {
      setData(await api("/api/claims", { method: "POST", body: JSON.stringify({ item }) }));
    } catch (e) {
      say((e as Error).message, true);
      refresh();
    }
  }

  async function cancelRsvp() {
    if (!confirm("¿Seguro que quieres borrar tu respuesta? Liberas tu cupo y lo que habías apartado.")) return;
    setBusy(true);
    try {
      setData(await api("/api/rsvp", { method: "DELETE" }));
      setD(draftFrom(null, cfg));
      setScreen("invite");
      say("Borramos tu respuesta");
    } catch (e) {
      say((e as Error).message, true);
    } finally {
      setBusy(false);
    }
  }

  async function copyAccount(value: string) {
    const digits = cfg.paymentsCopyAsIs.includes(d.method) ? value.trim() : value.replace(/[^\d]/g, "");
    try {
      await navigator.clipboard.writeText(digits);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = digits;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const shareUrl = typeof window !== "undefined" ? window.location.origin : "";
  const shareText = `¡${cfg.title} el ${cfg.dateLabel.toLowerCase()}! 🔥 Confirma aquí: ${shareUrl}`;
  const isIOS = typeof navigator !== "undefined" && /iPad|iPhone|iPod/.test(navigator.userAgent);
  const gcal = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const calUrl = isIOS
    ? "/api/calendar"
    : `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(cfg.title)}&dates=${gcal(cfg.startISO)}/${gcal(cfg.endISO)}&location=${encodeURIComponent(cfg.place + ", " + cfg.location)}`;

  // "Asado en Zipa" → "Asado" / "en" + "Zipa" en naranja
  const words = cfg.title.split(" ");
  const titleLast = words.length > 1 ? words[words.length - 1] : "";
  const titleHead = words[0];
  const titleMid = words.slice(1, -1).join(" ");

  const dark = screen === "intro" || screen === "invite" || screen === "done";
  const statusColor = dark ? "#f5ede1" : "#1f1812";
  const pctOf = (n: number) => Math.min(100, (n / cfg.fundGoal) * 100).toFixed(1) + "%";

  /* ── Render ── */
  return (
    <div className="stage">
      <div className="device">
        <div className="device-inner">
          <div className="statusbar" style={{ color: statusColor }}>
            <span>9:41</span>
            <div className="notch" />
            <span className="mono" style={{ fontSize: 12, fontWeight: 500 }}>5G ▮▮▮</span>
          </div>

          {toast && (
            <div className={"toast" + (toast.err ? " err" : "")} role="status" aria-live="polite">
              <span>{toast.msg}</span>
              <button onClick={() => setToast(null)} aria-label="Cerrar">×</button>
            </div>
          )}

          {!data && (
            <div className="loading">
              {loadError ? (
                <>
                  <p className="t16" style={{ margin: 0, textAlign: "center", padding: "0 32px" }}>No pudimos cargar la invitación. Revisa tu conexión.</p>
                  <button className="btn btn-ember" style={{ width: 200 }} onClick={() => location.reload()}>Reintentar</button>
                </>
              ) : (
                <>
                  <div className="spinner" style={{ color: "#ff5a1f", width: 28, height: 28 }} />
                  <span className="label" style={{ color: "#a8988a" }}>Prendiendo el carbón…</span>
                </>
              )}
            </div>
          )}

          {data && screen === "intro" && (
            <div className="scr dark scroll">
              <Embers />
              <div style={{ position: "absolute", left: -60, right: -60, bottom: -120, height: 460, background: "radial-gradient(ellipse at 50% 70%,rgba(255,90,31,.38),transparent 62%)", animation: "glow 4s ease-in-out infinite", pointerEvents: "none" }} />
              <div className="col between intro-body" style={{ position: "relative", minHeight: "100%", gap: 40, padding: "96px 28px calc(44px + var(--safe-b))", animation: "rise .7s ease" }}>
                <span className="kicker">{cfg.intro.kicker}</span>
                <div className="col" style={{ gap: 28 }}>
                  <div className="col" style={{ gap: 16 }}>
                    <p className="intro-lead" style={{ margin: 0, letterSpacing: "-.025em", textWrap: "pretty" }}>
                      {cfg.intro.lead} <span className="ember">{cfg.intro.highlight}</span>
                    </p>
                    <p className="lead" style={{ margin: 0 }}>{cfg.intro.text}</p>
                  </div>
                  <div style={{ height: 1, background: "rgba(245,237,225,.16)" }} />
                  <span className="mono" style={{ fontSize: 12, fontWeight: 500, letterSpacing: ".1em", color: "#a8988a" }}>{cfg.intro.meta}</span>
                </div>
                <button className="btn" style={{ background: "#f5ede1", color: "#18120e" }} onClick={() => setScreen("invite")}>{cfg.intro.button}</button>
              </div>
            </div>
          )}

          {data && screen === "invite" && (
            <div className="scr dark scroll" ref={scrollRef}>
              <Embers />
              <div className="glow" />
              <div className="col pad-top" style={{ position: "relative", padding: "72px 24px 40px", gap: 28, animation: "rise .5s ease" }}>
                <div className="row between">
                  <span className="kicker">Estás invitado</span>
                  <span className="mono muted" style={{ fontSize: 11, letterSpacing: ".1em" }}>{cfg.dateShort}</span>
                </div>
                <div className="col" style={{ gap: 6 }}>
                  <h1 className="h1">{titleHead}<br />{titleMid && titleMid + " "}<span className="ember">{titleLast}</span></h1>
                  <p className="lead">{cfg.tagline}</p>
                </div>
                <div className="countdown" aria-label="Cuenta regresiva">
                  {[[cd.d, "días"], [pad(cd.h), "horas"], [pad(cd.m), "min"], [pad(cd.s), "seg"]].map(([v, l]) => (
                    <div key={l}><b suppressHydrationWarning>{v}</b><span>{l}</span></div>
                  ))}
                </div>
                <div className="col facts">
                  <div className="fact">
                    <span className="label">Cuándo</span>
                    <div className="col" style={{ gap: 2 }}><span className="t17">{cfg.dateLabel}</span><span className="muted" style={{ fontSize: 14 }}>{cfg.timeLabel}</span></div>
                  </div>
                  <div className="fact">
                    <span className="label">Dónde</span>
                    <div className="col" style={{ gap: 2, flex: 1 }}><span className="t17">{cfg.place}</span><span className="muted" style={{ fontSize: 14 }}>{cfg.placeSub}</span></div>
                    <a className="pill-link" href={cfg.mapsUrl} target="_blank" rel="noopener noreferrer">Mapa</a>
                  </div>
                  <div className="fact">
                    <span className="label">Aporte</span>
                    <div className="col" style={{ gap: 2 }}><span className="t17">{money(cfg.fee)} por persona</span><span className="muted" style={{ fontSize: 14 }}>Donaciones extra, bienvenidas</span></div>
                  </div>
                </div>
                <div className="row" style={{ gap: 12 }}>
                  {data.avatars.length > 0 && (
                    <div className="avatars">
                      {data.avatars.map((a, k) => <div key={k} style={{ background: AV[k % AV.length] }}>{a}</div>)}
                    </div>
                  )}
                  <span style={{ font: "400 14px var(--body)", color: "#d9ccbd" }}>
                    {data.confirmed ? (
                      <><b style={{ color: "#f5ede1" }}>{data.confirmed} confirmado{data.confirmed === 1 ? "" : "s"}</b> · {data.cars.length} carro{data.cars.length === 1 ? "" : "s"}</>
                    ) : (
                      <b style={{ color: "#f5ede1" }}>Sé el primero en confirmar</b>
                    )}
                  </span>
                </div>
              </div>
              <div className="cta-wrap">
                <button className="btn btn-ember" onClick={() => setScreen(me ? "done" : "rsvp")}>{me ? "Ver mi respuesta" : "Confirmar asistencia"}</button>
              </div>
            </div>
          )}

          {data && idx >= 0 && (
            <div className="scr light col">
              <div className="col pad-top" style={{ padding: "58px 20px 0", gap: 16, flex: "none" }}>
                <div className="row between">
                  <button className="round" aria-label="Atrás" onClick={() => setScreen(idx <= 0 ? (me ? "done" : "invite") : FLOW[idx - 1])}>←</button>
                  <span className="label" style={{ letterSpacing: ".12em" }}>Paso {idx + 1} de {yes || d.attending === null ? 3 : 1}</span>
                  <div style={{ width: 44 }} />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 6 }}>
                  {["Asistencia", "Transporte", "Aporte"].map((label, i) => (
                    <div key={label} className="col" style={{ gap: 6 }}>
                      <div style={{ height: 4, borderRadius: 4, background: i <= idx ? "#ff5a1f" : "rgba(31,24,18,.12)", transition: "background .3s" }} />
                      <span style={{ font: "500 11px var(--body)", color: i <= idx ? "#1f1812" : "#a8988a" }}>{label}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="scroll" ref={scrollRef} style={{ flex: 1, padding: "22px 20px 140px" }}>
                {screen === "rsvp" && (
                  <div className="col rise" style={{ gap: 26 }}>
                    <h2 className="h2">¿Te le mides<br />al asado?</h2>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                      {([["si", "✓", "¡Claro que voy!", "Guárdame puesto"], ["no", "×", "Esta vez no", "Me lo pierdo"]] as const).map(([k, mark, label, sub]) => {
                        const sel = d.attending === k;
                        return (
                          <button key={k} aria-pressed={sel} className={"opt col" + (sel ? (k === "si" ? " hot" : " on") : "")} style={{ padding: "18px 16px", borderRadius: 22, gap: 22 }} onClick={() => set({ attending: k })}>
                            <span style={{ font: "800 30px/1 var(--display)" }}>{mark}</span>
                            <span className="col" style={{ gap: 2 }}><span className="t16">{label}</span><span style={{ font: "400 13px var(--body)", opacity: .7 }}>{sub}</span></span>
                          </button>
                        );
                      })}
                    </div>
                    <label className="col" style={{ gap: 8 }}>
                      <span className="label">Tu nombre</span>
                      <input className="field" value={d.name} maxLength={40} autoComplete="given-name" enterKeyHint="next" placeholder="Como te conocen en el parche" onChange={(e) => set({ name: e.target.value })} onKeyDown={(e) => e.key === "Enter" && next()} />
                    </label>
                    {yes && (
                      <div className="col" style={{ gap: 26 }}>
                        <div className="card row between" style={{ borderRadius: 20, padding: "14px 14px 14px 18px" }}>
                          <div className="col" style={{ gap: 2 }}><span className="t16">Acompañantes</span><span className="sub">Cada uno aporta {money(cfg.fee)}</span></div>
                          <div className="stepper">
                            <button className="minus" aria-label="Quitar acompañante" disabled={d.guests <= 0} onClick={() => set({ guests: Math.max(0, d.guests - 1) })}>−</button>
                            <b>{d.guests}</b>
                            <button className="plus" aria-label="Agregar acompañante" disabled={d.guests >= cfg.maxGuests} onClick={() => set({ guests: Math.min(cfg.maxGuests, d.guests + 1) })}>+</button>
                          </div>
                        </div>
                        <div className="col" style={{ gap: 10 }}>
                          <span className="label">¿Algo que debamos saber de la comida?</span>
                          <div className="chips">
                            {cfg.diets.map((label) => {
                              const sel = d.diet.includes(label);
                              const toggle = () => {
                                if (label === "Ninguna") return set({ diet: ["Ninguna"] });
                                const rest = d.diet.filter((x) => x !== label && x !== "Ninguna");
                                set({ diet: sel ? (rest.length ? rest : ["Ninguna"]) : [...rest, label] });
                              };
                              return <button key={label} aria-pressed={sel} className={"opt chip" + (sel ? " on" : "")} onClick={toggle}>{label}</button>;
                            })}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {screen === "ride" && (
                  <div className="col rise" style={{ gap: 22 }}>
                    <div className="col" style={{ gap: 8 }}>
                      <h2 className="h2">¿Cómo llegas<br />a Zipa?</h2>
                      <p className="sub" style={{ margin: 0, fontSize: 15 }}>
                        {rideCars.length ? `Hay ${freeSeats} cupo${freeSeats === 1 ? "" : "s"} libre${freeSeats === 1 ? "" : "s"} en ${rideCars.length} carro${rideCars.length === 1 ? "" : "s"}. Nadie se queda.` : "Todavía nadie ha ofrecido carro. Si tienes, ¡ofrece cupos!"}
                      </p>
                    </div>
                    <div className="col" style={{ gap: 8 }}>
                      {([["driver", "CAR", "Tengo carro", "Ofrezco cupos"], ["rider", "SEAT", "Necesito cupo", freeSeats ? `${freeSeats} puesto${freeSeats === 1 ? "" : "s"} disponible${freeSeats === 1 ? "" : "s"}` : "Te anotamos en la lista"], ["own", "OWN", "Llego por mi cuenta", "Bus, moto o ya estoy allá"]] as const).map(([k, tag, label, sub]) => {
                        const sel = d.ride === k;
                        return (
                          <button key={k} aria-pressed={sel} className={"opt row" + (sel ? " on" : "")} style={{ gap: 14, padding: 16, borderRadius: 20 }} onClick={() => set({ ride: k })}>
                            <span style={{ width: 44, height: 44, flex: "none", borderRadius: 14, background: sel ? "#ff5a1f" : "#efe4d4", color: "#1f1812", display: "flex", alignItems: "center", justifyContent: "center", font: "600 13px var(--mono)" }}>{tag}</span>
                            <span className="col" style={{ gap: 2, flex: 1 }}><span className="t16">{label}</span><span style={{ font: "400 13px var(--body)", opacity: .7 }}>{sub}</span></span>
                            <span style={{ width: 22, height: 22, borderRadius: "50%", border: `1.5px solid ${sel ? "#1f1812" : "rgba(31,24,18,.12)"}`, background: sel ? "#ff5a1f" : "transparent", flex: "none" }} />
                          </button>
                        );
                      })}
                    </div>

                    {d.ride === "driver" && (
                      <div className="card col rise" style={{ gap: 20, borderRadius: 24, padding: 20 }}>
                        <div className="col" style={{ gap: 10 }}>
                          <span className="label">Sales desde</span>
                          <div className="chips">
                            {cfg.fromOptions.map((f) => <button key={f} aria-pressed={d.from === f} className={"opt chip sm" + (d.from === f ? " on" : "")} onClick={() => set({ from: f })}>{f}</button>)}
                          </div>
                        </div>
                        <div className="col" style={{ gap: 10 }}>
                          <span className="label">Hora de salida</span>
                          <div className="chips">
                            {cfg.timeOptions.map((t) => <button key={t} aria-pressed={d.time === t} className={"opt chip sm mono" + (d.time === t ? " on" : "")} onClick={() => set({ time: t })}>{t} a.m.</button>)}
                          </div>
                        </div>
                        <label className="col" style={{ gap: 10 }}>
                          <span className="label">Tu carro (opcional)</span>
                          <input className="field sm" value={d.carModel} maxLength={40} placeholder="Ej: Mazda 3 gris" onChange={(e) => set({ carModel: e.target.value })} />
                        </label>
                        <div className="col" style={{ gap: 12 }}>
                          <div className="row between">
                            <span className="label">Cupos que ofreces</span>
                            <div className="stepper" style={{ gap: 12 }}>
                              <button className="minus" style={{ width: 36, height: 36, fontSize: 18 }} aria-label="Menos cupos" disabled={d.seats <= Math.max(1, myRiders)} onClick={() => set({ seats: Math.max(1, myRiders, d.seats - 1) })}>−</button>
                              <b style={{ fontSize: 22 }}>{d.seats}</b>
                              <button className="plus" style={{ width: 36, height: 36, fontSize: 18 }} aria-label="Más cupos" disabled={d.seats >= cfg.maxSeats} onClick={() => set({ seats: Math.min(cfg.maxSeats, d.seats + 1) })}>+</button>
                            </div>
                          </div>
                          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, padding: 14, borderRadius: 18, background: "#efe4d4" }}>
                            <div className="seat" style={{ background: "#1f1812", color: "#f5ede1" }}>TÚ</div>
                            {Array.from({ length: Math.max(5, cfg.maxSeats - 1) }, (_, i) => (
                              <div key={i} className="seat" style={i < d.seats ? { background: "#ff5a1f", border: "1.5px dashed #ff5a1f", color: "#18120e" } : { border: "1.5px dashed rgba(31,24,18,.18)" }}>
                                {i < myRiders ? "OCUPADO" : i < d.seats ? "LIBRE" : ""}
                              </div>
                            ))}
                          </div>
                          {myRiders > 0 && <span className="sub">Ya llevas {myRiders} pasajero{myRiders === 1 ? "" : "s"}.</span>}
                          {data.seekers.length > 0 && (
                            <span className="sub" style={{ color: "#1f1812" }}>🙋 <b>{data.seekers.length} buscando cupo:</b> {data.seekers.join(", ")}. Cuando confirmes, pueden subirse a tu carro.</span>
                          )}
                        </div>
                      </div>
                    )}

                    {d.ride === "rider" && (
                      <div className="col rise" style={{ gap: 10 }}>
                        {freeSeats === 0 ? (
                          <div className="empty" style={{ borderColor: "#ff5a1f", background: "#fff3e8" }}>
                            <span className="t15">{rideCars.length ? "Los carros están llenos por ahora" : "Aún no hay carros disponibles"}</span>
                            <span className="sub">Tranqui, sigue igual: quedas en la lista de <b>Buscando cupo</b> y los conductores te ven. Cuando alguien ofrezca puesto, edita tu respuesta y elige el carro.</span>
                          </div>
                        ) : seeking && (
                          <span className="sub">Elige un carro, o sigue sin elegir y quedas en la lista de <b>Buscando cupo</b>.</span>
                        )}
                        {rideCars.length > 0 && <span className="label" style={{ paddingTop: 4 }}>Elige tu carro</span>}
                        {rideCars.map((c) => {
                          const sel = d.carId === c.id;
                          const full = c.others.length >= c.seats && !sel;
                          const left = c.seats - c.others.length - (sel ? 1 : 0);
                          return (
                            <button key={c.id} disabled={full} aria-pressed={sel} className={"opt col" + (sel ? " picked" : "")} style={{ gap: 14, padding: 16, borderRadius: 22 }} onClick={() => set({ carId: sel ? null : c.id })}>
                              <div className="row" style={{ gap: 12, width: "100%" }}>
                                <div style={{ width: 42, height: 42, borderRadius: "50%", background: colorFor(c.driver), display: "flex", alignItems: "center", justifyContent: "center", font: "600 16px var(--display)", flex: "none" }}>{c.driver[0]?.toUpperCase()}</div>
                                <div className="col" style={{ gap: 1, flex: 1, minWidth: 0 }}><span className="t16">{c.driver}</span><span className="sub">{c.model || "Carro"}</span></div>
                                <div className="col" style={{ alignItems: "flex-end", gap: 1 }}><span className="mono" style={{ fontSize: 14, fontWeight: 500 }}>{c.time} a.m.</span><span className="sub" style={{ fontSize: 12 }}>{c.from}</span></div>
                              </div>
                              <div className="row between" style={{ width: "100%" }}>
                                <div className="row" style={{ gap: 5, flexWrap: "wrap" }}>
                                  {Array.from({ length: c.seats }, (_, i) => {
                                    const st = i < c.others.length
                                      ? { background: "#1f1812", border: "1.5px solid #1f1812", color: "#f5ede1", l: c.others[i][0]?.toUpperCase() }
                                      : sel && i === c.others.length
                                        ? { background: "#ff5a1f", border: "1.5px solid #ff5a1f", color: "#18120e", l: "TÚ" }
                                        : { background: "transparent", border: "1.5px solid rgba(31,24,18,.25)", color: "#7a6a5c", l: "" };
                                    return <span key={i} className="dot" style={{ background: st.background, border: st.border, color: st.color }}>{st.l}</span>;
                                  })}
                                </div>
                                <span style={{ font: "500 13px var(--body)", color: sel ? "#ff5a1f" : full ? "#a8988a" : "#3f6b3a" }}>
                                  {full ? "Lleno" : sel ? "Tu puesto ✓" : `${left} ${left === 1 ? "libre" : "libres"}`}
                                </span>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {screen === "pay" && (() => {
                  const account = cfg.payments[d.method];
                  const pledgedOthers = (data.fund.pledged ?? 0) - meSavedTotal;
                  return (
                    <div className="col rise" style={{ gap: 24 }}>
                      <h2 className="h2">Tu aporte<br />a la parrilla</h2>
                      <div className="dark col" style={{ borderRadius: 26, padding: 22, gap: 18, position: "relative", overflow: "hidden" }}>
                        <div style={{ position: "absolute", right: -60, bottom: -80, width: 220, height: 220, borderRadius: "50%", background: "radial-gradient(circle,rgba(255,90,31,.45),transparent 65%)" }} />
                        <div className="row between" style={{ font: "400 14px var(--body)", color: "#d9ccbd", position: "relative" }}><span>Cuota · {people} {people === 1 ? "persona" : "personas"}</span><span className="mono">{money(base)}</span></div>
                        <div className="row between" style={{ font: "400 14px var(--body)", color: "#d9ccbd", position: "relative" }}><span>Donación extra</span><span className="mono" style={{ color: "#ffb38a" }}>{d.extra ? "+" + money(d.extra) : "$0"}</span></div>
                        <div style={{ height: 1, background: "rgba(245,237,225,.14)", position: "relative" }} />
                        <div className="row between" style={{ alignItems: "baseline", position: "relative" }}><span className="label">Total</span><span style={{ font: "800 44px/1 var(--display)", letterSpacing: "-.03em" }}>{money(myTotal)}</span></div>
                      </div>
                      <div className="col" style={{ gap: 10 }}>
                        <span className="label">¿Quieres sumar algo más?</span>
                        <div style={{ display: "grid", gridTemplateColumns: `repeat(${cfg.extraOptions.length},1fr)`, gap: 8 }}>
                          {cfg.extraOptions.map((v) => (
                            <button key={v} aria-pressed={d.extra === v} className={"opt mono" + (d.extra === v ? " hot" : "")} style={{ height: 52, borderRadius: 16, fontWeight: 600, fontSize: 14, textAlign: "center" }} onClick={() => set({ extra: v })}>
                              {v ? "+" + v / 1000 + "k" : "Solo cuota"}
                            </button>
                          ))}
                        </div>
                        <span className="sub">
                          {d.extra === 0 ? "Con la cuota ya estás. Todo suma." : d.extra >= 50000 ? "Leyenda. Esto paga la ronda de postres para todos." : d.extra >= 20000 ? "Con esto cubres el carbón de una parrilla entera." : "Esto alcanza para el hielo de la tarde."}
                        </span>
                      </div>
                      <div className="card col" style={{ gap: 12, padding: 18 }}>
                        <div className="row between" style={{ alignItems: "baseline" }}><span className="t15">Fondo del asado</span><span className="mono muted" style={{ fontSize: 13 }}>{money(pledgedOthers + myTotal)} / {money(cfg.fundGoal)}</span></div>
                        <div className="progress">
                          <div style={{ width: pctOf(pledgedOthers), background: "#1f1812" }} />
                          <div style={{ width: pctOf(myTotal), background: "#ff5a1f" }} />
                        </div>
                        <span className="sub">Carne, carbón, bebidas y hielo. Lo naranja es tu parte.</span>
                      </div>
                      <div className="col" style={{ gap: 10 }}>
                        <span className="label">Cómo pagas</span>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                          {Object.keys(cfg.payments).map((m, i, all) => (
                            <button key={m} aria-pressed={d.method === m} className={"opt" + (d.method === m ? " on" : "")} style={{ height: 52, borderRadius: 16, font: "600 15px var(--body)", textAlign: "center", gridColumn: all.length % 2 && i === all.length - 1 ? "span 2" : undefined }} onClick={() => { set({ method: m }); setCopied(false); }}>{m}</button>
                          ))}
                        </div>
                        {account ? (
                          <div className="row between" style={{ padding: "14px 16px", borderRadius: 16, border: "1.5px dashed rgba(31,24,18,.2)", gap: 12 }}>
                            <div className="col" style={{ gap: 2, minWidth: 0 }}><span className="sub" style={{ fontSize: 12 }}>{cfg.paymentLabels[d.method] ?? d.method} de {cfg.paymentOwners[d.method] ?? cfg.organizer.name}</span><span className="mono" style={{ fontSize: 17, fontWeight: 500, overflowWrap: "anywhere" }}>{account}</span></div>
                            <button className="small-btn btn-ink" onClick={() => copyAccount(account)}>{copied ? "Copiado ✓" : "Copiar"}</button>
                          </div>
                        ) : (
                          <span className="sub">Entrégale el efectivo a {cfg.organizer.name} <b>antes del asado</b>, para alcanzar a comprar la carne, el carbón y todo lo demás.</span>
                        )}
                      </div>
                    </div>
                  );
                })()}
              </div>

              <div className="cta-wrap abs">
                <button className="btn btn-ink" disabled={nextDisabled} onClick={next}>
                  {busy && <span className="spinner" />}
                  {screen === "rsvp" ? (d.attending === "no" ? "Enviar respuesta" : "Continuar") : screen === "ride" ? (seeking ? "Continuar · buscando cupo" : "Continuar") : `${me ? "Guardar cambios" : "Confirmar"} · ${money(myTotal)}`}
                </button>
              </div>
            </div>
          )}

          {data && screen === "done" && (
            <div className="scr dark scroll" ref={scrollRef}>
              <Embers />
              <div className="col pad-top" style={{ position: "relative", padding: "70px 20px calc(40px + var(--safe-b))", gap: 22, animation: "rise .5s ease" }}>
                {me?.attending === "si" && (
                  <div className="col" style={{ gap: 22 }}>
                    <div className="col" style={{ gap: 6 }}>
                      <span className="kicker">Confirmado</span>
                      <h2 className="h2 big">Nos vemos<br />el {cfg.dayNumber}, {firstName(me.name)}</h2>
                    </div>
                    <div className="ticket">
                      <div className="ticket-head">
                        <span style={{ font: "800 24px var(--display)", letterSpacing: "-.02em" }}>{cfg.title}</span>
                        <span className="mono" style={{ fontSize: 12, fontWeight: 500 }}>{cfg.ticketDate}</span>
                      </div>
                      <div className="ticket-grid">
                        <div className="col" style={{ gap: 3 }}><span className="label">Invitado</span><span className="t15">{firstName(me.name)}{me.guests ? ` +${me.guests}` : ""}</span></div>
                        <div className="col" style={{ gap: 3 }}><span className="label">Llegada</span><span className="t15">{cfg.arrival}</span></div>
                        <div className="col" style={{ gap: 3, gridColumn: "span 2" }}><span className="label">Transporte</span><span className="t15">{rideLine(me)}</span></div>
                      </div>
                      <div className="perf"><i /><hr /><i /></div>
                      <div className="row between" style={{ padding: "16px 22px 20px", gap: 12 }}>
                        <div className="col" style={{ gap: 3 }}><span className="label">Aporte · {me.method}</span><span style={{ font: "800 26px var(--display)" }}>{money(meSavedTotal)}</span></div>
                        <button className="small-btn" onClick={togglePaid} style={{ height: 44, border: `1.5px solid ${me.paid ? "#3f6b3a" : "rgba(31,24,18,.2)"}`, background: me.paid ? "#3f6b3a" : "transparent", color: me.paid ? "#f5ede1" : "#1f1812", transition: "all .2s" }}>
                          {me.paidConfirmed ? "Pago recibido ✓" : me.paid ? "Pagado ✓" : "Ya pagué"}
                        </button>
                      </div>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                      <a className="btn btn-ghost" href={calUrl} target={isIOS ? undefined : "_blank"} rel="noopener noreferrer">Al calendario</a>
                      <a className="btn btn-ghost" href={`https://wa.me/?text=${encodeURIComponent(shareText)}`} target="_blank" rel="noopener noreferrer">Invitar a alguien</a>
                    </div>
                    {me.ride === "rider" && !me.carId && (
                      <div className="col" style={{ gap: 12, padding: 18, borderRadius: 22, border: "1.5px dashed rgba(255,90,31,.6)", background: "rgba(255,90,31,.08)" }}>
                        <span className="t15">Estás en la lista de &quot;Buscando cupo&quot;</span>
                        <span style={{ font: "400 14px/1.4 var(--body)", color: "#d9ccbd" }}>
                          {freeSeats > 0 ? `¡Ya hay ${freeSeats} puesto${freeSeats === 1 ? "" : "s"} libre${freeSeats === 1 ? "" : "s"}! Aparta el tuyo antes de que se llene.` : "Todavía no hay puestos libres. Vuelve a mirar en unos días o avísale a " + cfg.organizer.name + "."}
                        </span>
                        {freeSeats > 0 && <button className="btn btn-ember" style={{ height: 48, fontSize: 16 }} onClick={() => { setD(draftFrom(me, cfg)); setScreen("ride"); }}>Elegir carro</button>}
                      </div>
                    )}
                    <button className="btn btn-ember" onClick={() => setScreen("hub")}>Ver la logística del día</button>
                    <div className="row" style={{ justifyContent: "center", gap: 8 }}>
                      <button className="link-btn" onClick={() => { setD(draftFrom(me, cfg)); setScreen("rsvp"); }}>Editar mi respuesta</button>
                      <span className="muted">·</span>
                      <button className="link-btn" onClick={cancelRsvp} disabled={busy}>Borrar respuesta</button>
                    </div>
                  </div>
                )}
                {me?.attending === "no" && (
                  <div className="col" style={{ gap: 20, paddingTop: 120 }}>
                    <h2 className="h2 big">Te vamos<br />a extrañar</h2>
                    <p className="lead" style={{ margin: 0 }}>Gracias por avisar{me.name ? `, ${firstName(me.name)}` : ""}. Si cambias de plan, aquí sigue la invitación.</p>
                    <button className="btn btn-ghost" style={{ height: 56, fontSize: 16 }} onClick={() => { set({ attending: "si" }); setScreen("rsvp"); }}>Cambiar respuesta</button>
                  </div>
                )}
                {!me && (
                  <div className="col" style={{ gap: 20, paddingTop: 120 }}>
                    <h2 className="h2 big">Aún no<br />respondes</h2>
                    <button className="btn btn-ember" onClick={() => setScreen("rsvp")}>Confirmar asistencia</button>
                  </div>
                )}
              </div>
            </div>
          )}

          {data && screen === "hub" && (
            <div className="scr light col">
              <div className="col pad-top" style={{ padding: "58px 20px 14px", gap: 16, flex: "none" }}>
                <div className="row between" style={{ alignItems: "flex-end" }}>
                  <div className="col" style={{ gap: 2 }}>
                    <span className="label" style={{ letterSpacing: ".12em" }} suppressHydrationWarning>{cd.d > 0 ? `Faltan ${cd.d} día${cd.d === 1 ? "" : "s"}` : diff > 0 ? "¡Es hoy!" : "¡Ya fue!"}</span>
                    <h2 className="h2" style={{ fontSize: 34 }}>Logística</h2>
                  </div>
                  <button className="small-btn btn-ember" style={{ boxShadow: "none" }} onClick={() => setScreen("done")}>Mi pase</button>
                </div>
                <div className="tabs" role="tablist">
                  {([["carros", "Carros"], ["fondo", "Fondo"], ["llevar", "Llevar"], ["dia", "El día"]] as const).map(([k, l]) => (
                    <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? "on" : ""} onClick={() => setTab(k)}>{l}</button>
                  ))}
                </div>
              </div>
              <div className="scroll" ref={scrollRef} style={{ flex: 1, padding: "6px 20px calc(40px + var(--safe-b))" }}>
                {tab === "carros" && (
                  <div className="col rise" style={{ gap: 10 }}>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>
                      {[
                        { v: data.cars.length, l: "carros", bg: "#1f1812", fg: "#f5ede1" },
                        { v: data.cars.reduce((a, c) => a + Math.max(0, c.seats - c.riders.length), 0), l: "cupos libres", bg: "#ff5a1f", fg: "#18120e" },
                        { v: data.seekers.length, l: "sin cupo", bg: "#fffaf2", fg: "#1f1812" },
                      ].map((st) => (
                        <div key={st.l} className="col" style={{ background: st.bg, color: st.fg, borderRadius: 18, padding: 14, gap: 4 }}>
                          <span style={{ font: "800 28px/1 var(--display)" }}>{st.v}</span>
                          <span style={{ font: "400 12px var(--body)", opacity: .75 }}>{st.l}</span>
                        </div>
                      ))}
                    </div>
                    {data.cars.length === 0 && (
                      <div className="empty"><span className="t15">Nadie ha ofrecido carro todavía</span><span className="sub">Si tienes carro, edita tu respuesta y ofrece cupos.</span></div>
                    )}
                    {data.cars.map((c) => {
                      const left = c.seats - c.riders.length;
                      const mineCar = c.mine || c.riders.some((r) => r.mine);
                      return (
                        <div key={c.id} className="col" style={{ background: "#fffaf2", borderRadius: 20, padding: 16, gap: 12, border: `1.5px solid ${mineCar ? "#ff5a1f" : "transparent"}` }}>
                          <div className="row" style={{ gap: 12 }}>
                            <div style={{ width: 38, height: 38, borderRadius: "50%", background: c.mine ? "#ff5a1f" : colorFor(c.driver), display: "flex", alignItems: "center", justifyContent: "center", font: "600 15px var(--display)", flex: "none" }}>{c.driver[0]?.toUpperCase()}</div>
                            <div className="col" style={{ flex: 1, minWidth: 0 }}><span className="t15">{c.driver}{c.mine ? " (tú)" : ""}</span><span className="sub" style={{ fontSize: 12 }}>{c.from} · {c.time} a.m.{c.model ? ` · ${c.model}` : ""}</span></div>
                            <span className="mono" style={{ fontSize: 12, fontWeight: 500, color: left > 0 ? "#3f6b3a" : "#a8988a" }}>{left > 0 ? `${left} libre${left > 1 ? "s" : ""}` : "Lleno"}</span>
                          </div>
                          <div className="chips" style={{ gap: 6 }}>
                            {c.riders.map((r, i) => <span key={i} className="row" style={{ height: 28, padding: "0 10px", borderRadius: 999, background: r.mine ? "#ff5a1f" : "#efe4d4", font: "500 12px var(--body)" }}>{r.n}{r.mine ? " (tú)" : ""}</span>)}
                            {Array.from({ length: Math.max(0, left) }, (_, i) => <span key={"l" + i} className="row" style={{ height: 28, padding: "0 10px", borderRadius: 999, color: "#a8988a", font: "500 12px var(--body)", border: "1px dashed rgba(31,24,18,.18)" }}>Libre</span>)}
                          </div>
                        </div>
                      );
                    })}
                    {data.seekers.length > 0 && (
                      <div className="empty">
                        <span className="t15">Buscando cupo</span>
                        <span className="sub">{data.seekers.join(", ")}. Si tienes carro, ofréceles puesto.</span>
                      </div>
                    )}
                  </div>
                )}

                {tab === "fondo" && (
                  <div className="col rise" style={{ gap: 14 }}>
                    <div className="dark col" style={{ borderRadius: 26, padding: 22, gap: 14 }}>
                      <span className="label">Comprometido</span>
                      <div className="row" style={{ alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
                        <span style={{ font: "800 44px/1 var(--display)", letterSpacing: "-.03em" }}>{money(data.fund.pledged)}</span>
                        <span className="muted" style={{ fontSize: 14 }}>de {money(cfg.fundGoal)}</span>
                      </div>
                      <div className="progress" style={{ height: 10, background: "rgba(245,237,225,.12)" }}>
                        <div style={{ width: pctOf(data.fund.pledged - meSavedTotal), background: "#f5ede1" }} />
                        <div style={{ width: pctOf(meSavedTotal), background: "#ff5a1f" }} />
                      </div>
                      <span className="muted" style={{ fontSize: 13 }}>Ya pagado: {money(data.fund.paid)}</span>
                    </div>
                    <span className="label" style={{ paddingTop: 6 }}>En qué se va</span>
                    {cfg.budget.map(([l, v]) => (
                      <div key={l} className="col" style={{ gap: 8 }}>
                        <div className="row between" style={{ font: "500 14px var(--body)" }}><span>{l}</span><span className="mono muted">{money(v)}</span></div>
                        <div style={{ height: 6, borderRadius: 6, background: "#efe4d4" }}><div style={{ height: "100%", width: (v / Math.max(...cfg.budget.map((b) => b[1]))) * 100 + "%", borderRadius: 6, background: "#1f1812" }} /></div>
                      </div>
                    ))}
                    <span className="label" style={{ paddingTop: 10 }}>Últimos aportes</span>
                    <div style={{ background: "#fffaf2", borderRadius: 20, padding: "4px 16px" }}>
                      {data.contribs.length === 0 && <p className="sub" style={{ padding: "12px 0", margin: 0 }}>Todavía no hay aportes.</p>}
                      {data.contribs.map((c, i) => (
                        <div key={i} className="row between" style={{ padding: "12px 0", borderBottom: i < data.contribs.length - 1 ? "1px solid rgba(31,24,18,.08)" : 0, gap: 8 }}>
                          <span style={{ font: "500 15px var(--body)", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.n}{c.mine ? " (tú)" : ""}</span>
                          <div className="row" style={{ gap: 8, flex: "none" }}>
                            <span className="tag" style={{ background: c.paid ? "#dde6cf" : "#efe4d4", color: c.paid ? "#3f6b3a" : "#7a6a5c" }}>{c.paid ? (c.extra ? "pagó + extra" : "pagó") : "pendiente"}</span>
                            <span className="mono" style={{ fontSize: 14, fontWeight: 500 }}>{money(c.v)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {tab === "llevar" && (
                  <div className="col rise" style={{ gap: 12 }}>
                    <p className="sub" style={{ margin: 0, fontSize: 14 }}>La cuota cubre lo grueso. Para lo demás, apártalo aquí y evitamos llevar tres parlantes.</p>
                    {cfg.items.map((l) => {
                      const c = data.claims[l];
                      const mine = !!c?.mine;
                      const taken = !!c && !mine;
                      return (
                        <button key={l} className={"opt row" + (mine ? " picked" : "")} disabled={taken} style={{ gap: 14, padding: "14px 16px", borderRadius: 18, opacity: 1, cursor: taken ? "default" : "pointer" }} onClick={() => claim(l)}>
                          <span style={{ width: 26, height: 26, borderRadius: 8, flex: "none", border: `1.5px solid ${mine ? "#ff5a1f" : "rgba(31,24,18,.25)"}`, background: mine ? "#ff5a1f" : taken ? "#efe4d4" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", font: "700 14px var(--body)", color: "#18120e" }}>{c ? "✓" : ""}</span>
                          <span className="t15" style={{ flex: 1, textDecoration: taken ? "line-through" : "none" }}>{l}</span>
                          <span className="sub">{mine ? "Tú" : c ? c.name : "Apartar"}</span>
                        </button>
                      );
                    })}
                  </div>
                )}

                {tab === "dia" && (
                  <div className="col rise" style={{ paddingTop: 8 }}>
                    {cfg.agenda.map(([t, l, dd], i) => (
                      <div key={t + l} style={{ display: "grid", gridTemplateColumns: "74px 18px 1fr", gap: 10 }}>
                        <span className="mono muted" style={{ fontSize: 13, fontWeight: 500, paddingTop: 2 }}>{t}</span>
                        <div className="col" style={{ alignItems: "center" }}>
                          <span style={{ width: 14, height: 14, borderRadius: "50%", background: i === cfg.highlightAgenda ? "#ff5a1f" : "#1f1812", marginTop: 3, flex: "none" }} />
                          <span style={{ flex: 1, width: 2, background: "rgba(31,24,18,.14)", minHeight: 30 }} />
                        </div>
                        <div className="col" style={{ gap: 3, paddingBottom: 26 }}><span className="t16">{l}</span><span className="sub">{dd}</span></div>
                      </div>
                    ))}
                    <div className="col" style={{ borderRadius: 20, padding: 16, background: "#fffaf2", gap: 4 }}>
                      <span className="t15">{cfg.tipTitle}</span>
                      <span className="sub">{cfg.tipText}</span>
                    </div>
                    <a className="btn btn-ghost light-ghost" style={{ marginTop: 14 }} href={cfg.mapsUrl} target="_blank" rel="noopener noreferrer">Cómo llegar en Maps</a>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="homebar" style={{ background: statusColor }} />
        </div>
      </div>
    </div>
  );
}
