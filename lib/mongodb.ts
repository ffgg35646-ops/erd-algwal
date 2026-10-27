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
      globalForMongo._erdAlgwalMongoClientPromise = client.connect();
    }
    return globalForMongo._erdAlgwalMongoClientPromise;
  }

  if (!localClientPromise) {
    const client = new MongoClient(uri);
    localClientPromise = client.connect();
  }

  return localClientPromise;
}

export async function getDb(): Promise<Db> {
  const client = await getClientPromise();
  return client.db(process.env.MONGODB_DB || 'erd_algwal');
}
