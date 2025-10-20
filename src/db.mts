import mongoose from 'mongoose'
import { HydratedDocumentFromSchema } from 'mongoose'

const QuestionSchema = new mongoose.Schema({
  text: String,
  type: { type: String, enum: ["multiple-choice", "single-choice"] },
  options: [String],
  answers: [String],
})

const QuizSchema = new mongoose.Schema({
  title: String,
  description: String,
  questions: [QuestionSchema],
})

const LessonSchema = new mongoose.Schema({
  title: String,
  content: String,
  quiz: QuizSchema,
  circuitId: mongoose.Types.ObjectId,
  networkId: mongoose.Types.ObjectId,
})

const ModuleSchema = new mongoose.Schema({
  title: String,
  lessons: [LessonSchema],
})

const EnrollmentSchema = new mongoose.Schema({
  courseId: mongoose.Types.ObjectId,
  progressPercentage: { type: Number, default: 0 },
  completedAt: Date,
  completedLessons: [String], // Array of lesson IDs
})

const GamificationSettingsSchema = new mongoose.Schema({
  pointsPerLesson: { type: Number, default: 10 },
  pointsPerQuiz: { type: Number, default: 20 },
  pointsPerSimulation: { type: Number, default: 15 },
  badges: [{
    name: String,
    description: String,
    iconUrl: String,
    criteria: {
      type: { type: String, enum: ["courses-completed", "simulations-run", "quizzes-answered"] },
      threshold: Number,
    },
  }],
})

const CourseSchema = new mongoose.Schema({
  title: String,
  subtitle: String,
  description: String,
  thumbnailUrl: String,
  category: String,
  difficultyLevel: { type: String, enum: ["beginner", "intermediate", "advanced"] },
  prerequisites: [String],
  status: { type: String, enum: ["draft", "under-review", "published", "rejected"], default: "draft" },
  instructor: {
    userId: mongoose.Types.ObjectId,
    fullName: String, //todo: remove this
  },
  modules: [ModuleSchema],
  jupyterNotebookUrl: String,
  createdAt: { type: Date, default: Date.now },
  feedback: String,
  gamificationSettings: GamificationSettingsSchema,
})

const UserSchema = new mongoose.Schema({
  fullName: { type: String, required: true },
  email: { type: String, unique:true, required: true },
  passwordHash: { type: String, required: true, select: false },
  role: {
    type: String,
    required: true,
    enum: ["student", "educator", "course-administrator", "system-administrator"],
  },
  avatarUrl: String,
  bio: String,
  certName: String,
  country: String,
  city: String,
  contactNumber: String,
  nationalId: String,
  residentialAddress: String,
  gender: String,
  createdAt: { type: Date, default: Date.now },

  // Gamification fields
  points: { type: Number, default: 0 },
  learningStreak: { type: Number, default: 0 },
  lastActiveDate: Date,
  quizzesAnswered: { type: Number, default: 0 },
  simulationsRun: { type: Number, default: 0 },
  completedSimulations: [{ type: mongoose.Types.ObjectId }], // Track which circuits/networks were run

  achievements: [{
    badgeName: String,
    achievedAt: Date,
  }],

  enrollments: [EnrollmentSchema],
  status: { type: String, enum: ["active", "suspended", "deactivated", "deleted"], default: "active" },
})

const CircuitSchema = new mongoose.Schema({
  id: String,
  userId: mongoose.Types.ObjectId,
  name: String,
  configuration: mongoose.Schema.Types.Mixed,
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
})

const NetworkSchema = new mongoose.Schema({
  id: String,
  userId: mongoose.Types.ObjectId,
  name: String,
  configuration: mongoose.Schema.Types.Mixed,
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
})

export const UserModel = mongoose.model('User', UserSchema)
export const CourseModel = mongoose.model('Course', CourseSchema)
export const CircuitModel = mongoose.model('Circuit', CircuitSchema)
export const NetworkModel = mongoose.model('Network', NetworkSchema)

export type User = HydratedDocumentFromSchema<typeof UserSchema>
export type Course = HydratedDocumentFromSchema<typeof CourseSchema>
export type Circuit = HydratedDocumentFromSchema<typeof CircuitSchema>
export type Network = HydratedDocumentFromSchema<typeof NetworkSchema>

export async function initDb() {
  await mongoose.connect(
    //'mongodb://127.0.0.1:27017/qulearn',
    'mongodb+srv://QuLearnAdmin:QuLearnAdmin@qulearncluster.jjsnnoj.mongodb.net/qulearn?retryWrites=true&w=majority&appName=QuLearnCluster',
  )
  console.log('Database connection initialized')
}
