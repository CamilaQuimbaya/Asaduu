import { MongoClient, type Db } from "mongodb";

// En desarrollo Next recarga los módulos; guardamos el cliente en globalThis
// para no abrir una conexión nueva en cada cambio. En Vercel cada instancia
// serverless reutiliza la misma conexión entre peticiones.
const g = globalThis as unknown as { _mongo?: Promise<MongoClient>; _indexes?: Promise<unknown> };

function client(): Promise<MongoClient> {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("Falta MONGODB_URI en las variables de entorno");
  if (!g._mongo) {
    g._mongo = new MongoClient(uri, { maxPoolSize: 5, serverSelectionTimeoutMS: 8000 })
      .connect()
      .catch((e) => {
        g._mongo = undefined;
        throw e;
      });
  }
  return g._mongo;
}

export async function getDb(): Promise<Db> {
  const db = (await client()).db(process.env.MONGODB_DB || "asado_zipa");
  if (!g._indexes) {
    g._indexes = Promise.all([
      db.collection("rsvps").createIndex({ token: 1 }, { unique: true }),
      db.collection("rsvps").createIndex({ carId: 1 }),
    ]).catch((e) => {
      g._indexes = undefined;
      throw e;
    });
  }
  await g._indexes;
  return db;
}
