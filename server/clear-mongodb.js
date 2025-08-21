import { MongoClient, ServerApiVersion } from "mongodb";
import dotenv from "dotenv";
dotenv.config();

const uri = process.env.MONGODB_URI;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function clearAllData() {
  try {
    await client.connect();
    console.log("Connected to MongoDB!");
    
    const db = client.db("CommonSource");
    const usersCollection = db.collection("users");
    const verifyCollection = db.collection("verify");
    
    // Clear all data from collections
    console.log("Clearing users collection...");
    const usersResult = await usersCollection.deleteMany({});
    console.log(`Deleted ${usersResult.deletedCount} documents from users collection`);
    
    console.log("Clearing verify collection...");
    const verifyResult = await verifyCollection.deleteMany({});
    console.log(`Deleted ${verifyResult.deletedCount} documents from verify collection`);
    
    // List remaining documents to verify
    const usersCount = await usersCollection.countDocuments();
    const verifyCount = await verifyCollection.countDocuments();
    
    console.log(`\nRemaining documents:`);
    console.log(`- users collection: ${usersCount}`);
    console.log(`- verify collection: ${verifyCount}`);
    
    console.log("\n✅ MongoDB cleared successfully!");
    
  } catch (error) {
    console.error("Error clearing MongoDB:", error);
  } finally {
    await client.close();
    console.log("MongoDB connection closed");
    process.exit(0);
  }
}

clearAllData();