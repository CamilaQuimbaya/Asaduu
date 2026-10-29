// ─────────────────────────────────────────────────────────────
//  CONFIGURACIÓN DEL EVENTO — cambia aquí los datos reales.
//  Todo lo que ve el invitado sale de este archivo.
// ─────────────────────────────────────────────────────────────

export const EVENT = {
  // Pantalla de intro (lo primero que ve el invitado)
  intro: {
    kicker: "Una invitación para ti",
    lead: "Este año no sería lo mismo sin ti. Queremos que seas parte del",
    highlight: "gran asado de planeación",
    text: "Un día para encontrarnos, comer rico alrededor del fuego y soñar juntos lo que viene.",
    meta: "SÁB 12 DIC · ZIPAQUIRÁ",
    button: "Abrir invitación",
  },

  title: "Asado en Zipa",
  tagline:
    "Carne al carbón, buena música y el frío rico de la sabana. Confirma, cuadra tu transporte y listo.",

  // Fecha y hora (zona horaria de Colombia, -05:00)
  startISO: "2026-12-12T11:00:00-05:00",
  endISO: "2026-12-12T19:00:00-05:00",
  dateLabel: "Sábado 12 de diciembre",
  dateShort: "12 · 12 · 2026",
  ticketDate: "SÁB 12 DIC",
  dayNumber: "12",
  timeLabel: "Desde las 11:00 a.m.",
  arrival: "11:00 a.m.",

  // Lugar
  place: "Finca en Zipaquirá",
  placeSub: "San Simón La Quinta · a 1 h de Bogotá",
  location: "San Simón La Quinta, Zipaquirá, Cundinamarca",
  mapsUrl: "https://maps.app.goo.gl/keMTWmznnJ3gEx8N6",

  // Plata
  fee: 20000, // cuota por persona (COP)
  fundGoal: 1500000, // meta del fondo (COP)
  maxGuests: 4, // acompañantes máximos por invitado
  extraOptions: [0, 10000, 20000, 50000],

  // Quien organiza (WhatsApp en formato internacional, sin + ni espacios)
  organizer: { name: "Camila", whatsapp: "573000000000" },

  // Cuentas para pagar. Pon null en el método que no aplique.
  // Bre-B: pon tu llave tal cual (celular, correo, cédula o alias @...).
  payments: {
    "Bre-B": "1024502681",
    Efectivo: null,
  } as Record<string, string | null>,
  // Métodos que se copian tal cual (los demás copian solo los números)
  paymentsCopyAsIs: ["Bre-B"],
  paymentLabels: { "Bre-B": "Llave Bre-B" } as Record<string, string>,

  diets: ["Ninguna", "Vegetariano", "Sin cerdo", "Sin gluten", "Alergia"],
  fromOptions: ["Portal Norte", "Usaquén", "Chía", "Suba", "Cajicá"],
  timeOptions: ["8:00", "8:30", "9:00", "9:30"],
  maxSeats: 6,

  // Lista de "qué llevar" (cada cosa la aparta una sola persona)
  items: [
    "Carbón extra",
    "Hielo",
    "Parlante",
    "Arepas",
    "Postre",
    "Juego de rana",
    "Vasos y servilletas",
    "Guitarra",
  ],

  // En qué se va la plata (COP)
  budget: [
    ["Carne y chorizo", 720000],
    ["Bebidas", 380000],
    ["Carbón y leña", 160000],
    ["Hielo, arepas y otros", 240000],
  ] as [string, number][],

  agenda: [
    ["8:00 a.m.", "Salen los carros", "Cada conductor recoge en su punto."],
    ["10:30 a.m.", "Llegada a la finca", "Café y algo de picar."],
    ["11:00 a.m.", "Se prende el carbón", "Manos a la obra los de la parrilla."],
    ["1:00 p.m.", "Asado", "Carne, chorizo, arepas y mazorca."],
    ["3:00 p.m.", "Tejo, rana y música", "Y una vuelta por la Catedral de Sal si hay ánimo."],
    ["6:00 p.m.", "Regreso", "Mismos carros de ida."],
  ] as [string, string, string][],
  highlightAgenda: 3,

  tipTitle: "Lleva chaqueta",
  tipText: "En Zipa la tarde enfría rápido. Y algo de efectivo por si hay tejo.",
};

export type EventConfig = typeof EVENT;
