import { MongoMemoryServer } from 'mongodb-memory-server';

let mongoServer: MongoMemoryServer;

export default async function globalSetup() {
  // Start MongoDB Memory Server
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();

  // Set environment variables for tests
  process.env.MONGODB_URL = mongoUri;
  process.env.JWT_SECRET = 'test-jwt-secret-key-for-integration-tests';
  process.env.NODE_ENV = 'test';

  // Store mongoServer instance globally for teardown
  (global as any).__MONGOSERVER__ = mongoServer;

  console.log('MongoDB Memory Server started:', mongoUri);
}
