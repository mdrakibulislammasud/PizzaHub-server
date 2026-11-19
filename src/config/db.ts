
import { MongoClient, Db } from "mongodb";
import { env } from "./env.js";

const client = new MongoClient(env.MONGODB_URI, {
  serverSelectionTimeoutMS: 10000,
  connectTimeoutMS: 10000,
  socketTimeoutMS: 45000,
  maxPoolSize: 10,
  minPoolSize: 0,
  retryReads: true,
  retryWrites: true,
});

let database: Db | null = null;
let connectionPromise: Promise<Db> | null = null;
let isClosing = false;

export const connectDB = async (): Promise<Db> => {
  if (isClosing) {
    throw new Error("Database connection is shutting down.");
  }

  if (database) {
    return database;
  }

  if (!connectionPromise) {
    connectionPromise = (async () => {
      try {
        await client.connect();

        if (isClosing) {
          throw new Error("Database shutdown started during connection.");
        }

        database = client.db(env.DB_NAME);

        await database.command({ ping: 1 });

        console.log(`MongoDB connected: ${env.DB_NAME}`);

        return database;
      } catch (error) {
        database = null;

        try {
          await client.close();
        } catch (closeError) {
          console.error("MongoDB cleanup after connection failure failed.");
        }

        throw error;
      } finally {
        connectionPromise = null;
      }
    })();
  }

  return connectionPromise;
};

export const closeDB = async (): Promise<void> => {
  isClosing = true;

  try {
    await connectionPromise;
  } catch {
    // Connection failure is already handled by connectDB.
  } finally {
    try {
      await client.close();
    } finally {
      database = null;
      connectionPromise = null;
      console.log("MongoDB connection closed.");
    }
  }
};

export { client };
