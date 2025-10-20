import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { UserModel } from '../../src/db.mts';

/**
 * Creates a student user in the database and returns the user object
 */
export async function createStudent(overrides: any = {}) {
  const hash = await bcrypt.hash('password123', 10);
  const student = await UserModel.create({
    fullName: 'Test Student',
    email: 'student@test.com',
    passwordHash: hash,
    role: 'student',
    ...overrides,
  });
  return student;
}

/**
 * Creates an educator user in the database and returns the user object
 */
export async function createEducator(overrides: any = {}) {
  const hash = await bcrypt.hash('password123', 10);
  const educator = await UserModel.create({
    fullName: 'Test Educator',
    email: 'educator@test.com',
    passwordHash: hash,
    role: 'educator',
    ...overrides,
  });
  return educator;
}

/**
 * Creates a course administrator user in the database and returns the user object
 */
export async function createCourseAdmin(overrides: any = {}) {
  const hash = await bcrypt.hash('password123', 10);
  const admin = await UserModel.create({
    fullName: 'Test Course Admin',
    email: 'courseadmin@test.com',
    passwordHash: hash,
    role: 'course-administrator',
    ...overrides,
  });
  return admin;
}

/**
 * Creates a system administrator user in the database and returns the user object
 */
export async function createSysAdmin(overrides: any = {}) {
  const hash = await bcrypt.hash('password123', 10);
  const admin = await UserModel.create({
    fullName: 'Test System Admin',
    email: 'sysadmin@test.com',
    passwordHash: hash,
    role: 'system-administrator',
    ...overrides,
  });
  return admin;
}

/**
 * Generates a JWT token for a given user ID
 * @param userId - The MongoDB ObjectId of the user (as string)
 * @returns JWT token string
 */
export function generateToken(userId: string): string {
  const secret = process.env.JWT_SECRET || 'test-jwt-secret-key-for-integration-tests';
  return jwt.sign({ sub: userId }, secret, { expiresIn: '7d' });
}

/**
 * Creates a student and returns both the user object and a valid JWT token
 */
export async function createStudentWithToken(overrides: any = {}) {
  const student = await createStudent(overrides);
  const token = generateToken(student.id);
  return { student, token };
}

/**
 * Creates an educator and returns both the user object and a valid JWT token
 */
export async function createEducatorWithToken(overrides: any = {}) {
  const educator = await createEducator(overrides);
  const token = generateToken(educator.id);
  return { educator, token };
}
