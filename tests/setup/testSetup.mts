import mongoose from 'mongoose';
import { UserModel, CourseModel, CircuitModel, NetworkModel } from '../../src/db.mts';

beforeAll(async () => {
  // Connect to the in-memory database
  if (!process.env.MONGODB_URL) {
    throw new Error('MONGODB_URL not set in test environment');
  }

  await mongoose.connect(process.env.MONGODB_URL);
});

afterAll(async () => {
  // Disconnect from the database
  await mongoose.connection.close();
});

beforeEach(async () => {
  // Clear all collections before each test
  const collections = mongoose.connection.collections;

  for (const key in collections) {
    await collections[key].deleteMany({});
  }
});
