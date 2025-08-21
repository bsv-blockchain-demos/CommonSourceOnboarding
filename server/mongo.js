import { MongoClient, ServerApiVersion } from "mongodb";
import dotenv from "dotenv";
dotenv.config();

// Use environment variable for MongoDB URI or fallback to hardcoded value
const uri = process.env.MONGODB_URI;

if (!uri) {
  console.error('[Server Mongo] MONGODB_URI environment variable is not set');
  throw new Error('MongoDB URI is required. Please set MONGODB_URI environment variable.');
}

console.log('[Server Mongo] Using MongoDB URI (partial):', uri.substring(0, 20) + '...');

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
  // Additional connection options to handle Railway/Atlas SSL issues
  tls: true,
  tlsAllowInvalidCertificates: true, // This helps with SSL certificate validation issues
  tlsAllowInvalidHostnames: true,
  connectTimeoutMS: 30000, // 30 seconds
  socketTimeoutMS: 45000, // 45 seconds
  maxPoolSize: 10,
  minPoolSize: 1,
  maxIdleTimeMS: 30000,
  serverSelectionTimeoutMS: 30000, // How long to try to connect
  heartbeatFrequencyMS: 10000,
  // Add retry options
  retryWrites: true,
  retryReads: true
});

// Database and collections
let db;
let usersCollection;
let verifyCollection;

// Connect to MongoDB
async function connectToMongo() {
  if (!db) {
    try {
      console.log('[Server Mongo] Attempting to connect to MongoDB...');
      
      // Connect the client to the server
      await client.connect();
      console.log("[Server Mongo] Connected to MongoDB successfully!");
      
      // Initialize database and collections
      db = client.db("CommonSource");
      usersCollection = db.collection("users");
      verifyCollection = db.collection("verify");
      console.log('[Server Mongo] Database and collections initialized');
      
      // Create indexes for better performance
      try {
        await usersCollection.createIndex({ "_id": 1 });
        await usersCollection.createIndex({ "email": 1 });
        await usersCollection.createIndex({ "signedCertificate": 1 });

        await verifyCollection.createIndex({ "email": 1 });
        await verifyCollection.createIndex({ "code": 1 });
        await verifyCollection.createIndex({ "expirationTime": 1 });
        console.log("[Server Mongo] MongoDB indexes created successfully");
      } catch (indexError) {
        console.warn('[Server Mongo] Index creation warning (may already exist):', indexError.message);
      }
      
    } catch (error) {
      console.error("[Server Mongo] Error connecting to MongoDB:", error);
      console.error("[Server Mongo] Error name:", error.name);
      console.error("[Server Mongo] Error message:", error.message);
      if (error.code) {
        console.error("[Server Mongo] Error code:", error.code);
      }
      throw error;
    }
  }
  return { db, usersCollection, verifyCollection };
}

// Connect immediately when this module is imported
connectToMongo().catch(console.error);

// Handle application shutdown
process.on('SIGINT', async () => {
  try {
    await client.close();
    console.log('MongoDB connection closed.');
    process.exit(0);
  } catch (error) {
    console.error('Error during MongoDB shutdown:', error);
    process.exit(1);
  }
});

export { connectToMongo, usersCollection, verifyCollection };
