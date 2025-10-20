import { MongoMemoryServer } from 'mongodb-memory-server';

export default async function globalTeardown() {
  // Stop MongoDB Memory Server
  const mongoServer: MongoMemoryServer = (global as any).__MONGOSERVER__;

  if (mongoServer) {
    await mongoServer.stop();
    console.log('MongoDB Memory Server stopped');
  }
}
