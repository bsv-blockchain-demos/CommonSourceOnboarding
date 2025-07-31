import { MongoClient, ServerApiVersion } from "mongodb";
import dotenv from "dotenv";
dotenv.config();

// Use environment variable for MongoDB URI or fallback to hardcoded value
const uri = process.env.MONGODB_URI;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

// Database and collections
let db;
let usersCollection;
let verifyCollection;

// Connect to MongoDB
async function connectToMongo() {
  if (!db) {
    try {
      // Connect the client to the server
      await client.connect();
      console.log("Connected to MongoDB!");
      
      // Initialize database and collections
      db = client.db("CommonSource");
      usersCollection = db.collection("users");
      verifyCollection = db.collection("verify");
      
      // Create indexes for better performance
      await usersCollection.createIndex({ "_id": 1 });
      await usersCollection.createIndex({ "email": 1 });
      await usersCollection.createIndex({ "signedCertificate": 1 });

      await verifyCollection.createIndex({ "email": 1 });
      await verifyCollection.createIndex({ "code": 1 });
      await verifyCollection.createIndex({ "expirationTime": 1 });
      
      await usersCollection.createIndex({ id: 1 }, { unique: true });
      
      console.log("MongoDB indexes created successfully");
    } catch (error) {
      console.error("Error connecting to MongoDB:", error);
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
