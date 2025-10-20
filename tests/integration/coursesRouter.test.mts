/**
 * Integration Tests for coursesRouter.mts
 *
 * This test suite covers all endpoints in the courses router:
 * - GET / - List published courses
 * - GET /:courseId - Get course by ID
 * - POST / - Create course (EducatorOnly)
 * - PATCH /:courseId - Update course (EducatorOnly)
 * - PUT /:courseId/gamification - Update gamification settings (EducatorOnly)
 * - POST /:courseId/lessons/:lessonId/quiz/submit - Submit quiz (AuthenticatedOnly)
 */

import request from 'supertest';
import express, { Express } from 'express';
import { coursesRouter } from '../../src/routes/coursesRouter.mts';
import { CourseModel, UserModel } from '../../src/db.mts';
import { createStudent, createEducator, generateToken, createStudentWithToken, createEducatorWithToken } from '../helpers/authHelpers.mts';
import passport from 'passport';
import { APIError } from '../../src/types.mts';

// Mock the conversion engine to avoid external fetch calls
jest.mock('../../src/conversion-engine.mts', () => ({
  runConversionEngine: jest.fn(async (url: string) => {
    // Return a simple mock module structure
    return [
      {
        id: 'mock-module-id',
        title: 'Mock Module',
        lessons: [
          {
            id: 'mock-lesson-id',
            title: 'Mock Lesson',
            content: 'Mock content from Jupyter notebook',
          },
        ],
      },
    ];
  }),
}));

// Import the mocked function for assertions
import { runConversionEngine } from '../../src/conversion-engine.mts';

// Create Express app for testing
let app: Express;

beforeAll(() => {
  app = express();
  app.use(express.json());
  app.use(passport.initialize());

  // Mount the courses router at the same path as production
  app.use('/api/v1/courses', coursesRouter);

  // Error handler middleware (matches server.mts pattern)
  app.use((err: any, req: any, res: any, next: any) => {
    if (err instanceof APIError) {
      res.status(err.status).json({ error: err.message });
    } else if (err.name === 'APIError') {
      res.status(err.status).json({ error: err.message });
    } else {
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });
});

describe('Courses Router Integration Tests', () => {

  // ========================================
  // GET / - List Published Courses
  // ========================================

  describe('GET /api/v1/courses', () => {

    it('should return an empty array when no published courses exist', async () => {
      const response = await request(app)
        .get('/api/v1/courses')
        .expect(200);

      expect(response.body).toHaveProperty('courses');
      expect(response.body.courses).toEqual([]);
    });

    it('should return only published courses, not drafts or under-review courses', async () => {
      const educator = await createEducator();

      // Create courses with different statuses
      await CourseModel.create({
        title: 'Draft Course',
        subtitle: 'This is a draft',
        description: 'Draft description',
        category: 'Quantum Computing',
        difficultyLevel: 'beginner',
        status: 'draft',
        instructor: { userId: educator.id, fullName: educator.fullName },
        modules: [],
      });

      await CourseModel.create({
        title: 'Under Review Course',
        subtitle: 'This is under review',
        description: 'Under review description',
        category: 'Quantum Computing',
        difficultyLevel: 'intermediate',
        status: 'under-review',
        instructor: { userId: educator.id, fullName: educator.fullName },
        modules: [],
      });

      const publishedCourse = await CourseModel.create({
        title: 'Published Course',
        subtitle: 'This is published',
        description: 'Published description',
        category: 'Quantum Computing',
        difficultyLevel: 'advanced',
        status: 'published',
        instructor: { userId: educator.id, fullName: educator.fullName },
        modules: [],
      });

      const response = await request(app)
        .get('/api/v1/courses')
        .expect(200);

      expect(response.body.courses).toHaveLength(1);
      expect(response.body.courses[0].title).toBe('Published Course');
      expect(response.body.courses[0].status).toBe('published');
    });

    it('should return published courses sorted by title', async () => {
      const educator = await createEducator();

      // Create multiple published courses with different titles
      await CourseModel.create({
        title: 'Zebra Course',
        subtitle: 'Z course',
        description: 'Description',
        category: 'Quantum Computing',
        difficultyLevel: 'beginner',
        status: 'published',
        instructor: { userId: educator.id, fullName: educator.fullName },
        modules: [],
      });

      await CourseModel.create({
        title: 'Alpha Course',
        subtitle: 'A course',
        description: 'Description',
        category: 'Quantum Computing',
        difficultyLevel: 'beginner',
        status: 'published',
        instructor: { userId: educator.id, fullName: educator.fullName },
        modules: [],
      });

      await CourseModel.create({
        title: 'Beta Course',
        subtitle: 'B course',
        description: 'Description',
        category: 'Quantum Computing',
        difficultyLevel: 'beginner',
        status: 'published',
        instructor: { userId: educator.id, fullName: educator.fullName },
        modules: [],
      });

      const response = await request(app)
        .get('/api/v1/courses')
        .expect(200);

      expect(response.body.courses).toHaveLength(3);
      expect(response.body.courses[0].title).toBe('Alpha Course');
      expect(response.body.courses[1].title).toBe('Beta Course');
      expect(response.body.courses[2].title).toBe('Zebra Course');
    });

    it('should return courses without modules in the response (performance optimization)', async () => {
      const educator = await createEducator();

      await CourseModel.create({
        title: 'Course With Modules',
        subtitle: 'Has modules',
        description: 'Description',
        category: 'Quantum Computing',
        difficultyLevel: 'beginner',
        status: 'published',
        instructor: { userId: educator.id, fullName: educator.fullName },
        modules: [
          {
            id: 'module-1',
            title: 'Module 1',
            lessons: [
              { id: 'lesson-1', title: 'Lesson 1', content: 'Content' },
            ],
          },
        ],
      });

      const response = await request(app)
        .get('/api/v1/courses')
        .expect(200);

      expect(response.body.courses).toHaveLength(1);
      expect(response.body.courses[0].modules).toEqual([]);
    });
  });

  // ========================================
  // GET /:courseId - Get Course By ID
  // ========================================

  describe('GET /api/v1/courses/:courseId', () => {

    it('should return a course by ID with full details including modules', async () => {
      const educator = await createEducator();

      const course = await CourseModel.create({
        title: 'Quantum Basics',
        subtitle: 'Learn quantum computing',
        description: 'A comprehensive introduction to quantum computing',
        category: 'Quantum Computing',
        difficultyLevel: 'beginner',
        status: 'published',
        instructor: { userId: educator.id, fullName: educator.fullName },
        modules: [
          {
            id: 'module-1',
            title: 'Introduction',
            lessons: [
              {
                id: 'lesson-1',
                title: 'What is Quantum Computing?',
                content: 'Quantum computing is...',
              },
            ],
          },
        ],
      });

      const response = await request(app)
        .get(`/api/v1/courses/${course._id}`)
        .expect(200);

      expect(response.body).toHaveProperty('course');
      expect(response.body.course.title).toBe('Quantum Basics');
      expect(response.body.course.modules).toHaveLength(1);
      expect(response.body.course.modules[0].title).toBe('Introduction');
      expect(response.body.course.modules[0].lessons).toHaveLength(1);
    });

    it('should return 404 when course does not exist', async () => {
      const fakeId = '507f1f77bcf86cd799439011'; // Valid ObjectId format

      const response = await request(app)
        .get(`/api/v1/courses/${fakeId}`)
        .expect(404);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toBe('Course not found');
    });

    it('should return a draft course by ID (no auth restriction on GET)', async () => {
      const educator = await createEducator();

      const draftCourse = await CourseModel.create({
        title: 'Draft Course',
        subtitle: 'Still in draft',
        description: 'Description',
        category: 'Quantum Computing',
        difficultyLevel: 'beginner',
        status: 'draft',
        instructor: { userId: educator.id, fullName: educator.fullName },
        modules: [],
      });

      const response = await request(app)
        .get(`/api/v1/courses/${draftCourse._id}`)
        .expect(200);

      expect(response.body.course.title).toBe('Draft Course');
      expect(response.body.course.status).toBe('draft');
    });
  });

  // ========================================
  // POST / - Create Course (EducatorOnly)
  // ========================================

  describe('POST /api/v1/courses', () => {

    it('should create a course successfully with educator authentication', async () => {
      const { educator, token } = await createEducatorWithToken();

      const courseData = {
        title: 'New Quantum Course',
        subtitle: 'Advanced quantum concepts',
        description: 'Learn advanced quantum computing',
        category: 'Quantum Computing',
        difficultyLevel: 'advanced',
        prerequisites: ['Basic Quantum Mechanics'],
        thumbnailImageUrl: 'https://example.com/thumbnail.jpg',
        modules: [
          {
            id: 'module-1',
            title: 'Module 1',
            lessons: [
              {
                id: 'lesson-1',
                title: 'Lesson 1',
                content: 'Content',
              },
            ],
          },
        ],
      };

      const response = await request(app)
        .post('/api/v1/courses')
        .set('Authorization', `Bearer ${token}`)
        .send(courseData)
        .expect(200);

      expect(response.body).toHaveProperty('course');
      expect(response.body.course.title).toBe('New Quantum Course');
      expect(response.body.course.status).toBe('under-review'); // New courses start as under-review
      expect(response.body.course.instructor.id).toBe(educator.id);

      // Verify course was saved to database
      const savedCourse = await CourseModel.findById(response.body.course.id);
      expect(savedCourse).toBeTruthy();
      expect(savedCourse?.title).toBe('New Quantum Course');
    });

    it('should create a course from Jupyter notebook URL using conversion engine', async () => {
      const { educator, token } = await createEducatorWithToken();

      const courseData = {
        title: 'Jupyter-based Course',
        subtitle: 'Created from notebook',
        description: 'Course created from Jupyter notebook',
        category: 'Quantum Computing',
        difficultyLevel: 'intermediate',
        jupyterNotebookUrl: 'https://example.com/notebook.ipynb',
      };

      const response = await request(app)
        .post('/api/v1/courses')
        .set('Authorization', `Bearer ${token}`)
        .send(courseData)
        .expect(200);

      // Verify conversion engine was called
      expect(runConversionEngine).toHaveBeenCalledWith('https://example.com/notebook.ipynb');

      expect(response.body.course.title).toBe('Jupyter-based Course');
      expect(response.body.course.modules).toHaveLength(1);
      expect(response.body.course.modules[0].title).toBe('Mock Module');
    });

    it('should return 400 if Jupyter notebook conversion fails', async () => {
      const { educator, token } = await createEducatorWithToken();

      // Mock the conversion engine to throw an error
      (runConversionEngine as jest.Mock).mockRejectedValueOnce(new Error('Invalid notebook'));

      const courseData = {
        title: 'Invalid Jupyter Course',
        subtitle: 'Should fail',
        description: 'Course with invalid notebook',
        category: 'Quantum Computing',
        difficultyLevel: 'intermediate',
        jupyterNotebookUrl: 'https://example.com/invalid.ipynb',
      };

      const response = await request(app)
        .post('/api/v1/courses')
        .set('Authorization', `Bearer ${token}`)
        .send(courseData)
        .expect(400);

      expect(response.body.error).toBe('Invalid Jupyter Notebook URL or content');

      // Reset the mock
      (runConversionEngine as jest.Mock).mockResolvedValue([
        {
          id: 'mock-module-id',
          title: 'Mock Module',
          lessons: [{ id: 'mock-lesson-id', title: 'Mock Lesson', content: 'Mock content' }],
        },
      ]);
    });

    it('should return 401 when no authentication token is provided', async () => {
      const courseData = {
        title: 'Unauthorized Course',
        subtitle: 'No token',
        description: 'Should fail',
        category: 'Quantum Computing',
        difficultyLevel: 'beginner',
        modules: [],
      };

      const response = await request(app)
        .post('/api/v1/courses')
        .send(courseData)
        .expect(401);

      expect(response.body).toEqual({});
    });

    it('should return 403 when a student tries to create a course', async () => {
      const { student, token } = await createStudentWithToken();

      const courseData = {
        title: 'Student Course',
        subtitle: 'Created by student',
        description: 'Should fail',
        category: 'Quantum Computing',
        difficultyLevel: 'beginner',
        modules: [],
      };

      const response = await request(app)
        .post('/api/v1/courses')
        .set('Authorization', `Bearer ${token}`)
        .send(courseData)
        .expect(403);

      expect(response.body.error).toBe('Forbidden');
    });
  });

  // ========================================
  // PATCH /:courseId - Update Course (EducatorOnly)
  // ========================================

  describe('PATCH /api/v1/courses/:courseId', () => {

    it('should update a course successfully when educator is the instructor', async () => {
      const { educator, token } = await createEducatorWithToken();

      const course = await CourseModel.create({
        title: 'Original Title',
        subtitle: 'Original subtitle',
        description: 'Original description',
        category: 'Quantum Computing',
        difficultyLevel: 'beginner',
        status: 'draft',
        instructor: { userId: educator.id, fullName: educator.fullName },
        modules: [],
      });

      const updateData = {
        course: {
          title: 'Updated Title',
          subtitle: 'Updated subtitle',
          description: 'Updated description',
          category: 'Machine Learning',
          difficultyLevel: 'advanced',
          modules: [
            {
              id: 'new-module',
              title: 'New Module',
              lessons: [],
            },
          ],
        },
      };

      const response = await request(app)
        .patch(`/api/v1/courses/${course._id}`)
        .set('Authorization', `Bearer ${token}`)
        .send(updateData)
        .expect(200);

      expect(response.body.course.title).toBe('Updated Title');
      expect(response.body.course.subtitle).toBe('Updated subtitle');
      expect(response.body.course.category).toBe('Machine Learning');
      expect(response.body.course.difficultyLevel).toBe('advanced');
      expect(response.body.course.modules).toHaveLength(1);

      // Verify database was updated
      const updatedCourse = await CourseModel.findById(course._id);
      expect(updatedCourse?.title).toBe('Updated Title');
    });

    it('should return 404 when educator tries to update a course they do not own', async () => {
      const { educator: educator1, token: token1 } = await createEducatorWithToken({
        email: 'educator1@test.com',
      });
      const educator2 = await createEducator({ email: 'educator2@test.com' });

      const course = await CourseModel.create({
        title: 'Educator 2 Course',
        subtitle: 'Owned by educator 2',
        description: 'Description',
        category: 'Quantum Computing',
        difficultyLevel: 'beginner',
        status: 'draft',
        instructor: { userId: educator2.id, fullName: educator2.fullName },
        modules: [],
      });

      const updateData = {
        course: {
          title: 'Hacked Title',
          subtitle: 'subtitle',
          description: 'description',
          category: 'Quantum Computing',
          difficultyLevel: 'beginner',
          modules: [],
        },
      };

      const response = await request(app)
        .patch(`/api/v1/courses/${course._id}`)
        .set('Authorization', `Bearer ${token1}`)
        .send(updateData)
        .expect(404);

      expect(response.body.error).toBe('Course not found or you are not the instructor');

      // Verify course was not updated
      const unchangedCourse = await CourseModel.findById(course._id);
      expect(unchangedCourse?.title).toBe('Educator 2 Course');
    });

    it('should return 404 when course does not exist', async () => {
      const { educator, token } = await createEducatorWithToken();
      const fakeId = '507f1f77bcf86cd799439011';

      const updateData = {
        course: {
          title: 'Nonexistent Course',
          subtitle: 'subtitle',
          description: 'description',
          category: 'Quantum Computing',
          difficultyLevel: 'beginner',
          modules: [],
        },
      };

      const response = await request(app)
        .patch(`/api/v1/courses/${fakeId}`)
        .set('Authorization', `Bearer ${token}`)
        .send(updateData)
        .expect(404);

      expect(response.body.error).toBe('Course not found or you are not the instructor');
    });

    it('should return 401 when no authentication token is provided', async () => {
      const educator = await createEducator();
      const course = await CourseModel.create({
        title: 'Test Course',
        subtitle: 'subtitle',
        description: 'description',
        category: 'Quantum Computing',
        difficultyLevel: 'beginner',
        status: 'draft',
        instructor: { userId: educator.id, fullName: educator.fullName },
        modules: [],
      });

      const updateData = {
        course: {
          title: 'Updated Title',
          subtitle: 'subtitle',
          description: 'description',
          category: 'Quantum Computing',
          difficultyLevel: 'beginner',
          modules: [],
        },
      };

      await request(app)
        .patch(`/api/v1/courses/${course._id}`)
        .send(updateData)
        .expect(401);
    });

    it('should return 403 when a student tries to update a course', async () => {
      const educator = await createEducator();
      const { student, token } = await createStudentWithToken();

      const course = await CourseModel.create({
        title: 'Educator Course',
        subtitle: 'subtitle',
        description: 'description',
        category: 'Quantum Computing',
        difficultyLevel: 'beginner',
        status: 'draft',
        instructor: { userId: educator.id, fullName: educator.fullName },
        modules: [],
      });

      const updateData = {
        course: {
          title: 'Student Hacked Title',
          subtitle: 'subtitle',
          description: 'description',
          category: 'Quantum Computing',
          difficultyLevel: 'beginner',
          modules: [],
        },
      };

      const response = await request(app)
        .patch(`/api/v1/courses/${course._id}`)
        .set('Authorization', `Bearer ${token}`)
        .send(updateData)
        .expect(403);

      expect(response.body.error).toBe('Forbidden');
    });
  });

  // ========================================
  // PUT /:courseId/gamification - Update Gamification Settings (EducatorOnly)
  // ========================================

  describe('PUT /api/v1/courses/:courseId/gamification', () => {

    it('should update gamification settings successfully when educator is the instructor', async () => {
      const { educator, token } = await createEducatorWithToken();

      const course = await CourseModel.create({
        title: 'Course With Gamification',
        subtitle: 'Gamified course',
        description: 'Description',
        category: 'Quantum Computing',
        difficultyLevel: 'beginner',
        status: 'published',
        instructor: { userId: educator.id, fullName: educator.fullName },
        modules: [],
      });

      const gamificationData = {
        pointsPerLesson: 50,
        pointsPerQuiz: 100,
        pointsPerSimulation: 75,
        badges: [
          {
            name: 'Quantum Beginner',
            description: 'Complete 1 course',
            iconUrl: 'https://example.com/badge1.png',
            criteria: {
              type: 'courses-completed',
              threshold: 1,
            },
          },
          {
            name: 'Quiz Master',
            description: 'Answer 10 quizzes',
            iconUrl: 'https://example.com/badge2.png',
            criteria: {
              type: 'quizzes-answered',
              threshold: 10,
            },
          },
        ],
      };

      const response = await request(app)
        .put(`/api/v1/courses/${course._id}/gamification`)
        .set('Authorization', `Bearer ${token}`)
        .send(gamificationData)
        .expect(200);

      expect(response.body.success).toBe(true);

      // Verify gamification settings were saved
      const updatedCourse = await CourseModel.findById(course._id);
      expect(updatedCourse?.gamificationSettings?.pointsPerLesson).toBe(50);
      expect(updatedCourse?.gamificationSettings?.pointsPerQuiz).toBe(100);
      expect(updatedCourse?.gamificationSettings?.pointsPerSimulation).toBe(75);
      expect(updatedCourse?.gamificationSettings?.badges).toHaveLength(2);
      expect(updatedCourse?.gamificationSettings?.badges[0].name).toBe('Quantum Beginner');
    });

    it('should create gamification settings if they do not exist', async () => {
      const { educator, token } = await createEducatorWithToken();

      const course = await CourseModel.create({
        title: 'Course Without Gamification',
        subtitle: 'No gamification yet',
        description: 'Description',
        category: 'Quantum Computing',
        difficultyLevel: 'beginner',
        status: 'published',
        instructor: { userId: educator.id, fullName: educator.fullName },
        modules: [],
        // No gamificationSettings field
      });

      const gamificationData = {
        pointsPerLesson: 30,
        pointsPerQuiz: 60,
        pointsPerSimulation: 45,
        badges: [],
      };

      const response = await request(app)
        .put(`/api/v1/courses/${course._id}/gamification`)
        .set('Authorization', `Bearer ${token}`)
        .send(gamificationData)
        .expect(200);

      expect(response.body.success).toBe(true);

      const updatedCourse = await CourseModel.findById(course._id);
      expect(updatedCourse?.gamificationSettings).toBeTruthy();
      expect(updatedCourse?.gamificationSettings?.pointsPerLesson).toBe(30);
    });

    it('should return 404 when educator tries to update gamification for a course they do not own', async () => {
      const { educator: educator1, token: token1 } = await createEducatorWithToken({
        email: 'educator1@test.com',
      });
      const educator2 = await createEducator({ email: 'educator2@test.com' });

      const course = await CourseModel.create({
        title: 'Educator 2 Course',
        subtitle: 'Owned by educator 2',
        description: 'Description',
        category: 'Quantum Computing',
        difficultyLevel: 'beginner',
        status: 'published',
        instructor: { userId: educator2.id, fullName: educator2.fullName },
        modules: [],
      });

      const gamificationData = {
        pointsPerLesson: 100,
        pointsPerQuiz: 200,
        pointsPerSimulation: 150,
        badges: [],
      };

      const response = await request(app)
        .put(`/api/v1/courses/${course._id}/gamification`)
        .set('Authorization', `Bearer ${token1}`)
        .send(gamificationData)
        .expect(404);

      expect(response.body.error).toBe('Course not found or you are not the instructor');
    });

    it('should return 404 when course does not exist', async () => {
      const { educator, token } = await createEducatorWithToken();
      const fakeId = '507f1f77bcf86cd799439011';

      const gamificationData = {
        pointsPerLesson: 10,
        pointsPerQuiz: 20,
        pointsPerSimulation: 15,
        badges: [],
      };

      const response = await request(app)
        .put(`/api/v1/courses/${fakeId}/gamification`)
        .set('Authorization', `Bearer ${token}`)
        .send(gamificationData)
        .expect(404);

      expect(response.body.error).toBe('Course not found or you are not the instructor');
    });

    it('should return 401 when no authentication token is provided', async () => {
      const educator = await createEducator();
      const course = await CourseModel.create({
        title: 'Test Course',
        subtitle: 'subtitle',
        description: 'description',
        category: 'Quantum Computing',
        difficultyLevel: 'beginner',
        status: 'published',
        instructor: { userId: educator.id, fullName: educator.fullName },
        modules: [],
      });

      const gamificationData = {
        pointsPerLesson: 10,
        pointsPerQuiz: 20,
        pointsPerSimulation: 15,
        badges: [],
      };

      await request(app)
        .put(`/api/v1/courses/${course._id}/gamification`)
        .send(gamificationData)
        .expect(401);
    });

    it('should return 403 when a student tries to update gamification settings', async () => {
      const educator = await createEducator();
      const { student, token } = await createStudentWithToken();

      const course = await CourseModel.create({
        title: 'Educator Course',
        subtitle: 'subtitle',
        description: 'description',
        category: 'Quantum Computing',
        difficultyLevel: 'beginner',
        status: 'published',
        instructor: { userId: educator.id, fullName: educator.fullName },
        modules: [],
      });

      const gamificationData = {
        pointsPerLesson: 999,
        pointsPerQuiz: 999,
        pointsPerSimulation: 999,
        badges: [],
      };

      const response = await request(app)
        .put(`/api/v1/courses/${course._id}/gamification`)
        .set('Authorization', `Bearer ${token}`)
        .send(gamificationData)
        .expect(403);

      expect(response.body.error).toBe('Forbidden');
    });
  });

  // ========================================
  // POST /:courseId/lessons/:lessonId/quiz/submit - Submit Quiz (AuthenticatedOnly)
  // ========================================

  describe('POST /api/v1/courses/:courseId/lessons/:lessonId/quiz/submit', () => {

    it('should submit quiz answers and calculate score correctly for 100% correct', async () => {
      const { student, token } = await createStudentWithToken();
      const educator = await createEducator();

      // Create a course with a quiz
      const course = await CourseModel.create({
        title: 'Course With Quiz',
        subtitle: 'Has a quiz',
        description: 'Description',
        category: 'Quantum Computing',
        difficultyLevel: 'beginner',
        status: 'published',
        instructor: { userId: educator.id, fullName: educator.fullName },
        gamificationSettings: {
          pointsPerLesson: 10,
          pointsPerQuiz: 20,
          pointsPerSimulation: 15,
          badges: [],
        },
        modules: [
          {
            id: 'module-1',
            title: 'Module 1',
            lessons: [
              {
                id: 'lesson-1',
                title: 'Lesson with Quiz',
                content: 'Content',
                quiz: {
                  title: 'Test Quiz',
                  description: 'A test quiz',
                  questions: [
                    {
                      id: 'q1',
                      text: 'What is quantum computing?',
                      type: 'single-choice',
                      options: ['A', 'B', 'C'],
                      answers: ['A'],
                    },
                    {
                      id: 'q2',
                      text: 'Select all quantum gates',
                      type: 'multiple-choice',
                      options: ['Hadamard', 'NOT', 'XOR'],
                      answers: ['Hadamard', 'NOT'],
                    },
                  ],
                },
              },
            ],
          },
        ],
      });

      // Enroll the student in the course
      student.enrollments = [
        {
          courseId: course._id as any,
          progressPercentage: 0,
          completions: [],
          QuizAttempts: [],
          completedLessons: [],
          activityHistory: [],
        } as any,
      ];
      await student.save();

      const quizSubmission = {
        answers: [
          { questionId: 'q1', answers: ['A'] },
          { questionId: 'q2', answers: ['Hadamard', 'NOT'] },
        ],
      };

      const response = await request(app)
        .post(`/api/v1/courses/${course._id}/lessons/lesson-1/quiz/submit`)
        .set('Authorization', `Bearer ${token}`)
        .send(quizSubmission)
        .expect(200);

      expect(response.body.score).toBe(100);
      expect(response.body.isPassed).toBe(true);
      expect(response.body.correctAnswers).toHaveLength(2);

      // Verify user's quiz count was incremented
      const updatedStudent = await UserModel.findById(student.id);
      expect(updatedStudent?.quizzesAnswered).toBe(1);

      // Verify user received points
      expect(updatedStudent?.points).toBeGreaterThan(0);
    });

    it('should submit quiz answers and calculate score correctly for partial credit', async () => {
      const { student, token } = await createStudentWithToken();
      const educator = await createEducator();

      const course = await CourseModel.create({
        title: 'Course With Quiz',
        subtitle: 'Has a quiz',
        description: 'Description',
        category: 'Quantum Computing',
        difficultyLevel: 'beginner',
        status: 'published',
        instructor: { userId: educator.id, fullName: educator.fullName },
        gamificationSettings: {
          pointsPerLesson: 10,
          pointsPerQuiz: 100,
          pointsPerSimulation: 15,
          badges: [],
        },
        modules: [
          {
            id: 'module-1',
            title: 'Module 1',
            lessons: [
              {
                id: 'lesson-1',
                title: 'Lesson with Quiz',
                content: 'Content',
                quiz: {
                  title: 'Test Quiz',
                  description: 'A test quiz',
                  questions: [
                    {
                      id: 'q1',
                      text: 'Question 1',
                      type: 'single-choice',
                      options: ['A', 'B', 'C'],
                      answers: ['A'],
                    },
                    {
                      id: 'q2',
                      text: 'Question 2',
                      type: 'single-choice',
                      options: ['X', 'Y', 'Z'],
                      answers: ['Y'],
                    },
                  ],
                },
              },
            ],
          },
        ],
      });

      student.enrollments = [
        {
          courseId: course._id as any,
          progressPercentage: 0,
          completions: [],
          QuizAttempts: [],
          completedLessons: [],
          activityHistory: [],
        } as any,
      ];
      await student.save();

      const quizSubmission = {
        answers: [
          { questionId: 'q1', answers: ['A'] }, // Correct
          { questionId: 'q2', answers: ['X'] }, // Incorrect
        ],
      };

      const response = await request(app)
        .post(`/api/v1/courses/${course._id}/lessons/lesson-1/quiz/submit`)
        .set('Authorization', `Bearer ${token}`)
        .send(quizSubmission)
        .expect(200);

      expect(response.body.score).toBe(50); // 1 out of 2 correct
      expect(response.body.isPassed).toBe(false); // Less than 60%

      // Verify user received proportional points (50% of 100 = 50 points)
      const updatedStudent = await UserModel.findById(student.id);
      expect(updatedStudent?.points).toBe(50);
    });

    it('should mark lesson as completed when quiz is passed (>= 60%)', async () => {
      const { student, token } = await createStudentWithToken();
      const educator = await createEducator();

      const course = await CourseModel.create({
        title: 'Course With Quiz',
        subtitle: 'Has a quiz',
        description: 'Description',
        category: 'Quantum Computing',
        difficultyLevel: 'beginner',
        status: 'published',
        instructor: { userId: educator.id, fullName: educator.fullName },
        gamificationSettings: {
          pointsPerLesson: 10,
          pointsPerQuiz: 20,
          pointsPerSimulation: 15,
          badges: [],
        },
        modules: [
          {
            id: 'module-1',
            title: 'Module 1',
            lessons: [
              {
                id: 'lesson-1',
                title: 'Lesson with Quiz',
                content: 'Content',
                quiz: {
                  title: 'Test Quiz',
                  description: 'A test quiz',
                  questions: [
                    {
                      id: 'q1',
                      text: 'Question 1',
                      type: 'single-choice',
                      options: ['A', 'B'],
                      answers: ['A'],
                    },
                  ],
                },
              },
            ],
          },
        ],
      });

      student.enrollments = [
        {
          courseId: course._id as any,
          progressPercentage: 0,
          completions: [],
          QuizAttempts: [],
          completedLessons: [],
          activityHistory: [],
        } as any,
      ];
      await student.save();

      const quizSubmission = {
        answers: [{ questionId: 'q1', answers: ['A'] }],
      };

      const response = await request(app)
        .post(`/api/v1/courses/${course._id}/lessons/lesson-1/quiz/submit`)
        .set('Authorization', `Bearer ${token}`)
        .send(quizSubmission)
        .expect(200);

      expect(response.body.score).toBe(100);
      expect(response.body.isPassed).toBe(true);

      // Verify lesson was marked as completed
      const updatedStudent = await UserModel.findById(student.id);
      const enrollment = updatedStudent?.enrollments?.find(
        (e) => e.courseId?.toString() === course._id.toString()
      );
      expect(enrollment?.completedLessons).toContain('lesson-1');
    });

    it('should NOT mark lesson as completed when quiz is failed (< 60%)', async () => {
      const { student, token } = await createStudentWithToken();
      const educator = await createEducator();

      const course = await CourseModel.create({
        title: 'Course With Quiz',
        subtitle: 'Has a quiz',
        description: 'Description',
        category: 'Quantum Computing',
        difficultyLevel: 'beginner',
        status: 'published',
        instructor: { userId: educator.id, fullName: educator.fullName },
        gamificationSettings: {
          pointsPerLesson: 10,
          pointsPerQuiz: 20,
          pointsPerSimulation: 15,
          badges: [],
        },
        modules: [
          {
            id: 'module-1',
            title: 'Module 1',
            lessons: [
              {
                id: 'lesson-1',
                title: 'Lesson with Quiz',
                content: 'Content',
                quiz: {
                  title: 'Test Quiz',
                  description: 'A test quiz',
                  questions: [
                    {
                      id: 'q1',
                      text: 'Question 1',
                      type: 'single-choice',
                      options: ['A', 'B'],
                      answers: ['A'],
                    },
                  ],
                },
              },
            ],
          },
        ],
      });

      student.enrollments = [
        {
          courseId: course._id as any,
          progressPercentage: 0,
          completions: [],
          QuizAttempts: [],
          completedLessons: [],
          activityHistory: [],
        } as any,
      ];
      await student.save();

      const quizSubmission = {
        answers: [{ questionId: 'q1', answers: ['B'] }], // Wrong answer
      };

      const response = await request(app)
        .post(`/api/v1/courses/${course._id}/lessons/lesson-1/quiz/submit`)
        .set('Authorization', `Bearer ${token}`)
        .send(quizSubmission)
        .expect(200);

      expect(response.body.score).toBe(0);
      expect(response.body.isPassed).toBe(false);

      // Verify lesson was NOT marked as completed
      const updatedStudent = await UserModel.findById(student.id);
      const enrollment = updatedStudent?.enrollments?.find(
        (e) => e.courseId?.toString() === course._id.toString()
      );
      expect(enrollment?.completedLessons).not.toContain('lesson-1');
      expect(enrollment?.completedLessons).toHaveLength(0);
    });

    it('should return 404 when course does not exist', async () => {
      const { student, token } = await createStudentWithToken();
      const fakeId = '507f1f77bcf86cd799439011';

      const quizSubmission = {
        answers: [{ questionId: 'q1', answers: ['A'] }],
      };

      const response = await request(app)
        .post(`/api/v1/courses/${fakeId}/lessons/lesson-1/quiz/submit`)
        .set('Authorization', `Bearer ${token}`)
        .send(quizSubmission)
        .expect(404);

      expect(response.body.error).toBe('Course not found');
    });

    it('should return 404 when lesson does not exist in the course', async () => {
      const { student, token } = await createStudentWithToken();
      const educator = await createEducator();

      const course = await CourseModel.create({
        title: 'Course Without Lesson',
        subtitle: 'No lessons',
        description: 'Description',
        category: 'Quantum Computing',
        difficultyLevel: 'beginner',
        status: 'published',
        instructor: { userId: educator.id, fullName: educator.fullName },
        modules: [],
      });

      const quizSubmission = {
        answers: [{ questionId: 'q1', answers: ['A'] }],
      };

      const response = await request(app)
        .post(`/api/v1/courses/${course._id}/lessons/nonexistent-lesson/quiz/submit`)
        .set('Authorization', `Bearer ${token}`)
        .send(quizSubmission)
        .expect(404);

      expect(response.body.error).toBe('Quiz not found for this lesson');
    });

    it('should return 404 when lesson exists but has no quiz', async () => {
      const { student, token } = await createStudentWithToken();
      const educator = await createEducator();

      const course = await CourseModel.create({
        title: 'Course With Lesson But No Quiz',
        subtitle: 'Lesson without quiz',
        description: 'Description',
        category: 'Quantum Computing',
        difficultyLevel: 'beginner',
        status: 'published',
        instructor: { userId: educator.id, fullName: educator.fullName },
        modules: [
          {
            id: 'module-1',
            title: 'Module 1',
            lessons: [
              {
                id: 'lesson-1',
                title: 'Lesson without Quiz',
                content: 'Content',
                // No quiz property
              },
            ],
          },
        ],
      });

      const quizSubmission = {
        answers: [{ questionId: 'q1', answers: ['A'] }],
      };

      const response = await request(app)
        .post(`/api/v1/courses/${course._id}/lessons/lesson-1/quiz/submit`)
        .set('Authorization', `Bearer ${token}`)
        .send(quizSubmission)
        .expect(404);

      expect(response.body.error).toBe('Quiz not found for this lesson');
    });

    it('should return 401 when no authentication token is provided', async () => {
      const educator = await createEducator();

      const course = await CourseModel.create({
        title: 'Course With Quiz',
        subtitle: 'Has a quiz',
        description: 'Description',
        category: 'Quantum Computing',
        difficultyLevel: 'beginner',
        status: 'published',
        instructor: { userId: educator.id, fullName: educator.fullName },
        modules: [
          {
            id: 'module-1',
            title: 'Module 1',
            lessons: [
              {
                id: 'lesson-1',
                title: 'Lesson with Quiz',
                content: 'Content',
                quiz: {
                  title: 'Test Quiz',
                  description: 'A test quiz',
                  questions: [
                    {
                      id: 'q1',
                      text: 'Question 1',
                      type: 'single-choice',
                      options: ['A', 'B'],
                      answers: ['A'],
                    },
                  ],
                },
              },
            ],
          },
        ],
      });

      const quizSubmission = {
        answers: [{ questionId: 'q1', answers: ['A'] }],
      };

      await request(app)
        .post(`/api/v1/courses/${course._id}/lessons/lesson-1/quiz/submit`)
        .send(quizSubmission)
        .expect(401);
    });

    it('should allow both students and educators to submit quizzes (AuthenticatedOnly)', async () => {
      const { educator, token } = await createEducatorWithToken();

      const course = await CourseModel.create({
        title: 'Course With Quiz',
        subtitle: 'Has a quiz',
        description: 'Description',
        category: 'Quantum Computing',
        difficultyLevel: 'beginner',
        status: 'published',
        instructor: { userId: educator.id, fullName: educator.fullName },
        gamificationSettings: {
          pointsPerLesson: 10,
          pointsPerQuiz: 20,
          pointsPerSimulation: 15,
          badges: [],
        },
        modules: [
          {
            id: 'module-1',
            title: 'Module 1',
            lessons: [
              {
                id: 'lesson-1',
                title: 'Lesson with Quiz',
                content: 'Content',
                quiz: {
                  title: 'Test Quiz',
                  description: 'A test quiz',
                  questions: [
                    {
                      id: 'q1',
                      text: 'Question 1',
                      type: 'single-choice',
                      options: ['A', 'B'],
                      answers: ['A'],
                    },
                  ],
                },
              },
            ],
          },
        ],
      });

      const quizSubmission = {
        answers: [{ questionId: 'q1', answers: ['A'] }],
      };

      const response = await request(app)
        .post(`/api/v1/courses/${course._id}/lessons/lesson-1/quiz/submit`)
        .set('Authorization', `Bearer ${token}`)
        .send(quizSubmission)
        .expect(200);

      expect(response.body.score).toBe(100);
      expect(response.body.isPassed).toBe(true);
    });
  });
});
