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
      const connection = client.connect();
      globalForMongo._erdAlgwalMongoClientPromise = connection.catch((error) => {
        // Do not keep a rejected connection promise cached after a transient
        // network/TLS failure. The next request should be able to retry.
        if (globalForMongo._erdAlgwalMongoClientPromise === connection) {
          globalForMongo._erdAlgwalMongoClientPromise = undefined;
        }
        void client.close().catch(() => undefined);
        throw error;
      });
    }
    return globalForMongo._erdAlgwalMongoClientPromise;
  }

  if (!localClientPromise) {
    const client = new MongoClient(uri);
    const connection = client.connect();
    localClientPromise = connection.catch((error) => {
      // A failed promise must not poison this warm serverless instance forever.
      if (localClientPromise === connection) {
        localClientPromise = undefined;
      }
      void client.close().catch(() => undefined);
      throw error;
    });
  }

  return localClientPromise;
}

export async function getDb(): Promise<Db> {
  const client = await getClientPromise();
  return client.db(process.env.MONGODB_DB || 'erd_algwal');
}
