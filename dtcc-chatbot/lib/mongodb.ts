//lib/mongodb.ts
import { MongoClient,ObjectId} from 'mongodb';
import { UserData } from '@/types/user';

const uri = process.env.MONGODB_URI as string;
const options = {};

let client: MongoClient;
let clientPromise: Promise<MongoClient>;

if (!process.env.MONGODB_URI) {
  throw new Error('Add Mongo URI to .env.local');
}

if (process.env.NODE_ENV === 'development') {
  if (!(global as any)._mongoClientPromise) {
    client = new MongoClient(uri, options);
    (global as any)._mongoClientPromise = client.connect();
  }
  clientPromise = (global as any)._mongoClientPromise;
} else {
  client = new MongoClient(uri, options);
  clientPromise = client.connect();
}
clientPromise
  .then(client => {
    console.log('✅ MongoDB connected to database:', client.db().databaseName);
  })
  .catch(error => {
    console.error('❌ MongoDB connection error:', error);
  });
export default clientPromise;

// app/lib/mongodb.ts
export async function saveUserData(userData: UserData) {
    try {
      const client = await clientPromise;
      const result = await client.db()
        .collection('users')
        .updateOne(
          { uid: userData.uid },
          { $set: userData },
          { upsert: true }
        );
      return result;
    } catch (error) {
      console.error('MongoDB save error:', error);
      throw error;
    }
  }
  
  export async function getUserData(uid: string) {
    try {
      const client = await clientPromise;
      return await client.db()
        .collection('users')
        .findOne({ uid }, {
          projection: {
            _id: 0,
            uid: 1,
            email: 1,
            displayName: 1,
            photoURL: 1,
            provider: 1,
            createdAt: 1,
            updatedAt: 1
          }
        });
    } catch (error) {
      console.error('MongoDB fetch error:', error);
      throw error;
    }
  }

  
export async function getChatHistory(email: string) {
  try {
    const client = await clientPromise;
    return await client.db()
      .collection('chats')
      .find({ email }, {
        projection: {
          messages: 1,
          createdAt: 1,
          updatedAt: 1,
        }
      })
      .sort({ createdAt: -1 })
      .toArray();
  } catch (error) {
    console.error('MongoDB history fetch error:', error);
    throw error;
  }
}

export async function saveChatSession(email: string, messages: any[]) {
  try {
    const client = await clientPromise;
    const result = await client.db()
      .collection('chats')
      .insertOne({
        email,
        messages,
        createdAt: new Date(),
        updatedAt: new Date()
      });
    return result.insertedId;
  } catch (error) {
    console.error('MongoDB session save error:', error);
    throw error;
  }
}

export async function updateChatSession(sessionId: string, messages: any[]) {
  try {
    const client = await clientPromise;
    return await client.db()
      .collection('chats')
      .updateOne(
        { _id: new ObjectId(sessionId) },
        { $set: { messages, updatedAt: new Date() } }
      );
  } catch (error) {
    console.error('MongoDB session update error:', error);
    throw error;
  }
}