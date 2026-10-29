# 🔥 Asado en Zipa

Mini app de invitación: confirmar asistencia, cuadrar carros, aporte, lista de "qué llevar" y logística del día. Todo se guarda en MongoDB Atlas y se comparte en vivo entre los invitados.

Next.js 15 (App Router) · TypeScript · MongoDB Atlas · lista para Vercel.

## Cambiar los datos del evento

Todo está en **`lib/config.ts`**: fecha, lugar, link de Maps, cuota, meta del fondo, tu WhatsApp, cuentas de Nequi/Daviplata/Bancolombia, puntos de salida, lista de cosas, presupuesto y agenda.

## Correrla en tu compu

```bash
cp .env.example .env.local   # y llena MONGODB_URI y ADMIN_KEY
npm install
npm run dev                  # http://localhost:3000
```

| Variable      | Para qué                                                       |
| ------------- | -------------------------------------------------------------- |
| `MONGODB_URI` | Cadena de conexión de Atlas (`mongodb+srv://...`)              |
| `MONGODB_DB`  | Nombre de la base (por defecto `asado_zipa`)                    |
| `ADMIN_KEY`   | Clave para entrar a `/admin`                                     |

## Publicarla en Vercel

1. Sube la carpeta a un repo de GitHub.
2. En [vercel.com](https://vercel.com) → **Add New → Project** → importa el repo.
3. En **Environment Variables** pon `MONGODB_URI`, `MONGODB_DB` y `ADMIN_KEY`.
4. **Deploy**. Te queda un link tipo `asado-zipa.vercel.app` para mandar por WhatsApp.
5. En Atlas → **Network Access** agrega `0.0.0.0/0` (Vercel no tiene IP fija).

## Panel de quien organiza

Entra a **`/admin`** con tu `ADMIN_KEY`: ves quién va, quién no, restricciones de comida, carros, quién lleva qué, marcas los pagos como recibidos, borras respuestas y descargas todo en CSV (abre directo en Excel).

## Cómo funciona

- Cada celular recibe un identificador aleatorio guardado en el navegador; con eso el invitado puede volver, editar o borrar su respuesta sin crear cuenta.
- El servidor valida todo: no deja subirse a un carro lleno, no deja apartar algo que ya apartó otro, y si un conductor cancela, sus pasajeros quedan "buscando cupo".
- La pantalla se actualiza sola cada 15 s.
- Colecciones en Mongo: `rsvps` (respuestas) y `claims` (qué lleva cada quien).
