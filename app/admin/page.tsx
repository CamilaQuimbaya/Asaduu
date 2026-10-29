"use client";

import { useCallback, useEffect, useState } from "react";
import { EVENT } from "@/lib/config";
import type { MyRsvp } from "@/lib/rsvp";

type Row = MyRsvp & { total: number; createdAt: string; updatedAt: string; items: string[] };

const KEY = "asado-admin-key";
const money = (n: number) => "$" + Math.round(n).toLocaleString("es-CO");
const RIDE: Record<string, string> = { driver: "Lleva carro", rider: "Pasajero", own: "Por su cuenta" };

export default function Admin() {
  const [key, setKey] = useState("");
  const [input, setInput] = useState("");
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<"todos" | "si" | "no" | "pendientes">("todos");

  const call = useCallback(
    async (k: string, init?: RequestInit) => {
      const res = await fetch("/api/admin", { ...init, headers: { "Content-Type": "application/json", "x-admin-key": k }, cache: "no-store" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Error");
      setRows(json.rsvps);
      setError("");
    },
    [],
  );

  useEffect(() => {
    const saved = (() => { try { return localStorage.getItem(KEY) || ""; } catch { return ""; } })();
    if (saved) {
      setKey(saved);
      call(saved).catch(() => setKey(""));
    }
  }, [call]);

  useEffect(() => {
    if (!key) return;
    const t = setInterval(() => call(key).catch(() => {}), 20000);
    return () => clearInterval(t);
  }, [key, call]);

  async function login(e: React.FormEvent) {
    e.preventDefault();
    try {
      await call(input);
      setKey(input);
      try { localStorage.setItem(KEY, input); } catch {}
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function exportCsv() {
    const res = await fetch("/api/admin/export", { headers: { "x-admin-key": key } });
    if (!res.ok) return setError("No se pudo exportar");
    const url = URL.createObjectURL(await res.blob());
    const a = Object.assign(document.createElement("a"), { href: url, download: "invitados-asado.csv" });
    a.click();
    URL.revokeObjectURL(url);
  }

  if (!key || !rows) {
    return (
      <main className="admin" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
        <form onSubmit={login} className="col" style={{ gap: 14, width: "100%", maxWidth: 360 }}>
          <h1 className="h2">Panel del<br /><span className="ember">asado</span></h1>
          <input className="field" type="password" placeholder="Clave de quien organiza" value={input} onChange={(e) => setInput(e.target.value)} autoFocus />
          {error && <span style={{ color: "#b3261e", fontSize: 14 }}>{error}</span>}
          <button className="btn btn-ink" disabled={!input}>Entrar</button>
          <a href="/" className="link-btn" style={{ textAlign: "center", color: "var(--mute)" }}>← Volver a la invitación</a>
        </form>
      </main>
    );
  }

  const yes = rows.filter((r) => r.attending === "si");
  const people = yes.reduce((a, r) => a + 1 + r.guests, 0);
  const pledged = yes.reduce((a, r) => a + r.total, 0);
  const received = yes.filter((r) => r.paidConfirmed).reduce((a, r) => a + r.total, 0);
  const diets = yes.flatMap((r) => r.diet.filter((x) => x !== "Ninguna").map((x) => `${r.name}: ${x}`));
  const drivers = new Map(rows.filter((r) => r.ride === "driver").map((r) => [r.id, r.name]));
  const shown = rows.filter((r) =>
    filter === "todos" ? true : filter === "pendientes" ? r.attending === "si" && !r.paidConfirmed : r.attending === filter,
  );

  return (
    <main className="admin">
      <div className="admin-wrap">
        <div className="row between" style={{ flexWrap: "wrap", gap: 12 }}>
          <div className="col" style={{ gap: 4 }}>
            <span className="label">Panel de quien organiza · se actualiza solo</span>
            <h1 className="h2">{EVENT.title}</h1>
          </div>
          <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
            <a className="small-btn row" href="/" style={{ background: "transparent", border: "1.5px solid var(--line)", color: "var(--ink)", textDecoration: "none" }}>← Invitación</a>
            <button className="small-btn btn-ink" onClick={exportCsv}>Descargar Excel (CSV)</button>
            <button className="small-btn" style={{ background: "transparent", border: "1.5px solid var(--line)" }} onClick={() => { try { localStorage.removeItem(KEY); } catch {} setKey(""); setRows(null); }}>Salir</button>
          </div>
        </div>
        {error && <span style={{ color: "#b3261e" }}>{error}</span>}

        <div className="stats">
          <div className="stat"><b>{people}</b><span className="sub">personas van ({yes.length} respuestas)</span></div>
          <div className="stat"><b>{rows.length - yes.length}</b><span className="sub">no van</span></div>
          <div className="stat"><b>{drivers.size}</b><span className="sub">carros · {yes.filter((r) => r.ride === "rider" && !r.carId).length} sin cupo</span></div>
          <div className="stat"><b>{money(pledged)}</b><span className="sub">comprometido de {money(EVENT.fundGoal)}</span></div>
          <div className="stat" style={{ background: "#dde6cf" }}><b>{money(received)}</b><span className="sub">recibido (confirmado por ti)</span></div>
        </div>

        {diets.length > 0 && (
          <div className="card col" style={{ padding: 16, gap: 6 }}>
            <span className="label">Ojo con la comida</span>
            <span style={{ fontSize: 14 }}>{diets.join(" · ")}</span>
          </div>
        )}

        <div className="chips">
          {([["todos", "Todos"], ["si", "Van"], ["no", "No van"], ["pendientes", "Pago pendiente"]] as const).map(([k, l]) => (
            <button key={k} className={"opt chip sm" + (filter === k ? " on" : "")} onClick={() => setFilter(k)}>{l}</button>
          ))}
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Nombre</th><th>Personas</th><th>Comida</th><th>Transporte</th><th>Lleva</th><th>Aporte</th><th>Pago</th><th></th></tr>
            </thead>
            <tbody>
              {shown.length === 0 && <tr><td colSpan={8} className="sub">Nadie por aquí todavía.</td></tr>}
              {shown.map((r) => (
                <tr key={r.id} className={r.attending === "no" ? "no" : ""}>
                  <td><b>{r.name || "(sin nombre)"}</b>{r.attending === "no" && <div className="sub">No va</div>}</td>
                  <td>{r.attending === "si" ? 1 + r.guests : "—"}</td>
                  <td>{r.attending === "si" ? r.diet.join(", ") : ""}</td>
                  <td>
                    {r.attending === "si" && r.ride && RIDE[r.ride]}
                    {r.ride === "driver" && <div className="sub">{r.seats} cupos · {r.from} {r.time} {r.carModel && `· ${r.carModel}`}</div>}
                    {r.ride === "rider" && <div className="sub">{r.carId ? `con ${drivers.get(r.carId) ?? "?"}` : "sin cupo aún"}</div>}
                  </td>
                  <td className="sub">{r.items.join(", ")}</td>
                  <td className="mono">{r.attending === "si" ? money(r.total) : ""}{r.attending === "si" && <div className="sub">{r.method}{r.paid ? " · dice que pagó" : ""}</div>}</td>
                  <td>
                    {r.attending === "si" && (
                      <button className="small-btn" style={{ background: r.paidConfirmed ? "#3f6b3a" : "transparent", color: r.paidConfirmed ? "#f5ede1" : "#1f1812", border: "1.5px solid " + (r.paidConfirmed ? "#3f6b3a" : "var(--line)") }}
                        onClick={() => call(key, { method: "PATCH", body: JSON.stringify({ id: r.id, paidConfirmed: !r.paidConfirmed }) }).catch((e) => setError(e.message))}>
                        {r.paidConfirmed ? "Recibido ✓" : "Marcar recibido"}
                      </button>
                    )}
                  </td>
                  <td>
                    <button className="link-btn" style={{ color: "#b3261e" }} onClick={() => confirm(`¿Borrar la respuesta de ${r.name || "este invitado"}?`) && call(key, { method: "DELETE", body: JSON.stringify({ id: r.id }) }).catch((e) => setError(e.message))}>Borrar</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
