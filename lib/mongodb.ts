import { MongoClient, type Db } from 'mongodb';

const globalForMongo = globalThis as typeof globalThis & {
  _erdAlgwalMongoClientPromise?: Promise<MongoClient>;
};

let localClientPromise: Promise<MongoClient> | undefined;

function getClientPromise(): Promise<MongoClient> {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI is not configured');
  }

  if (process.env.NODE_ENV !== 'production') {
    if (!globalForMongo._erdAlgwalMongoClientPromise) {
      const client = new MongoClient(uri);
      let cachedConnection: Promise<MongoClient>;
      cachedConnection = client.connect().catch((error) => {
        // Do not keep a rejected promise cached after a transient network/TLS failure.
        if (globalForMongo._erdAlgwalMongoClientPromise === cachedConnection) {
          globalForMongo._erdAlgwalMongoClientPromise = undefined;
        }
        void client.close().catch(() => undefined);
        throw error;
      });
      globalForMongo._erdAlgwalMongoClientPromise = cachedConnection;
    }
    return globalForMongo._erdAlgwalMongoClientPromise;
  }

  if (!localClientPromise) {
    const client = new MongoClient(uri);
    let cachedConnection: Promise<MongoClient>;
    cachedConnection = client.connect().catch((error) => {
      // A failed promise must not poison this warm serverless instance forever.
      if (localClientPromise === cachedConnection) {
        localClientPromise = undefined;
      }
      void client.close().catch(() => undefined);
      throw error;
    });
    localClientPromise = cachedConnection;
  }

  return localClientPromise;
}

export async function getDb(): Promise<Db> {
  // Telegram administration and every storefront API must use the same
  // authoritative database. The live admin-managed Erd Al-Gwal data is stored
  // in "erd_algwal"; do not silently route the website to the empty bb_store
  // database and show seeded fallback content instead.
  const client = await getClientPromise();
  return client.db('erd_algwal');
}
