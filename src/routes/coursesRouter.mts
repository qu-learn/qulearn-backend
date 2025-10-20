import { Router } from 'express'
import mongoose from 'mongoose'

import {
    APIError,
    courseToResponse,
    ICreateCourseRequest, ICreateCourseResponse,
    IGetCourseByIdResponse,
    IGetCoursesNoModulesResponse,
    IGetCoursesResponse,
    IUpdateCourseRequest,
    IUpdateCourseResponse,
    IUpdateGamificationSettingsRequest,
    IUpdateGamificationSettingsResponse,
    ISubmitQuizRequest,
    ISubmitQuizResponse,
    mockHandler,
    Req,
    Res,
} from '../types.mts'
import { CourseModel, User, UserModel } from '../db.mts'
import { EducatorOnly, AuthenticatedOnly } from './authRouter.mts'
import { runConversionEngine } from '../conversion-engine.mts'
import { calculateQuizScore, awardPointsForQuiz, markLessonCompleted } from '../gamification-engine.mts'
 
const coursesRouter = Router()
 
async function createCourseFromRequest(request: ICreateCourseRequest, user: User) {
    if (request.jupyterNotebookUrl) {
        try {
            request.modules = await runConversionEngine(request.jupyterNotebookUrl)
        } catch (error) {
            throw new APIError(400, 'Invalid Jupyter Notebook URL or content')
        }
    }
    return {
        title: request.title,
        subtitle: request.subtitle,
        description: request.description,
        category: request.category,
        difficultyLevel: request.difficultyLevel,
        prerequisites: request.prerequisites,
        jupyterNotebookUrl: request.jupyterNotebookUrl,
        thumbnailUrl: request.thumbnailImageUrl,
        instructor: {
            userId: user.id,
            fullName: user.fullName,
        },
        modules: request.modules,
    }
}

coursesRouter.get('/', async (req: Req<void>, res: Res<IGetCoursesNoModulesResponse>) => {
    const courses = await CourseModel.find({ status: 'published' })
        .populate('instructor.userId', 'id fullName')
        .sort({ title: 1 })
        .lean()

    res.json({
        courses: courses.map((c) => courseToResponse({ ...c, modules: [] })),
    })
})

coursesRouter.get('/:courseId', async (req: Req<void>, res: Res<IGetCourseByIdResponse>) => {
    const courseId = req.params.courseId as string
    const course = await CourseModel.findById(courseId)
    if (!course) {
        throw new APIError(404, 'Course not found')
    }
    res.json({
        course: courseToResponse(course),
    })
})

coursesRouter.post('/', EducatorOnly, async (req: Req<ICreateCourseRequest>, res: Res<ICreateCourseResponse>) => {
    const courseData = await createCourseFromRequest(req.body, req.user!)
    const course = await CourseModel.create({
        ...courseData,
        status: 'under-review',
    })
    res.json({
        course: courseToResponse(course),
    })
})

coursesRouter.patch('/:courseId', EducatorOnly, async (req: Req<IUpdateCourseRequest>, res: Res<IUpdateCourseResponse>) => {
    const courseId = req.params.courseId as string
    const courseData = await createCourseFromRequest(req.body.course, req.user!)
    const course = await CourseModel.findOneAndUpdate(
        {
            _id: courseId,
            'instructor.userId': req.user!.id,
        },
        courseData,
        { new: true },
    )
    if (!course) {
        throw new APIError(404, 'Course not found or you are not the instructor')
    }
    res.json({
        course: courseToResponse(course),
    })
})

coursesRouter.put('/:courseId/gamification', EducatorOnly, async (req: Req<IUpdateGamificationSettingsRequest>, res: Res<IUpdateGamificationSettingsResponse>) => {
    const courseId = req.params.courseId as string
    
    // Verify the course exists and the user is the instructor
    const course = await CourseModel.findOne({
        _id: courseId,
        'instructor.userId': req.user!.id,
    })
    
    if (!course) {
        throw new APIError(404, 'Course not found or you are not the instructor')
    }
    
    // Update gamification settings
    if (!course.gamificationSettings) {
        course.gamificationSettings = {
            pointsPerLesson: req.body.pointsPerLesson,
            pointsPerQuiz: req.body.pointsPerQuiz,
            pointsPerSimulation: req.body.pointsPerSimulation,
            badges: [] as any,
        }
    } else {
        course.gamificationSettings.pointsPerLesson = req.body.pointsPerLesson
        course.gamificationSettings.pointsPerQuiz = req.body.pointsPerQuiz
        course.gamificationSettings.pointsPerSimulation = req.body.pointsPerSimulation
    }
    
    // Clear and repopulate badges
    course.gamificationSettings.badges = req.body.badges as any
    
    await course.save()
    
    res.json({
        success: true,
    })
})

coursesRouter.post('/:courseId/lessons/:lessonId/quiz/submit', AuthenticatedOnly, async (req: Req<ISubmitQuizRequest>, res: Res<ISubmitQuizResponse>) => {
    const courseId = req.params.courseId as string
    const lessonId = req.params.lessonId as string
    const userId = req.user!.id

    // Find the course
    const course = await CourseModel.findById(courseId)
    if (!course) {
        throw new APIError(404, 'Course not found')
    }

    // Find the lesson and its quiz
    let quiz: any = null
    let found = false

    for (const module of course.modules || []) {
        for (const lesson of module.lessons || []) {
            if (lesson.id === lessonId || lesson._id?.toString() === lessonId) {
                quiz = lesson.quiz
                found = true
                break
            }
        }
        if (found) break
    }

    if (!quiz || !quiz.questions || quiz.questions.length === 0) {
        throw new APIError(404, 'Quiz not found for this lesson')
    }

    console.log('Found quiz:', quiz)
    console.error('Submitted answers:', req.body.answers)

    // Calculate quiz score
    const result = calculateQuizScore(quiz.questions, req.body.answers)

    // Get user and award points
    const user = await UserModel.findById(userId)
    if (user) {
        // Increment quiz counter
        user.quizzesAnswered = (user.quizzesAnswered as number || 0) + 1

        // Build quiz attempt record
        const quizAttempt = {
            quizId: quiz._id || null,
            answers: req.body.answers,
            score: result.score,
            attemptedAt: new Date(),
        }

        // Ensure enrollments array exists
        user.enrollments = user.enrollments || []

        // Try to find the enrollment for this course
        const enrollment = (user.enrollments as any[]).find(e => {
            try {
                return e.courseId?.toString() === courseId
            } catch {
                return false
            }
        })

        if (enrollment) {
            // Ensure QuizAttempts exists on the enrollment and push the attempt
            enrollment.QuizAttempts = enrollment.QuizAttempts || []
            enrollment.QuizAttempts.push(quizAttempt)
        } else {
            // If the user isn't enrolled (unlikely), create a lightweight enrollment entry and store the attempt
            (user.enrollments as any[]).push({
                courseId: mongoose.Types.ObjectId(courseId),
                progressPercentage: 0,
                enrolledAt: new Date(),
                QuizAttempts: [quizAttempt],
            })
        }

        // Award points based on score
        await awardPointsForQuiz(user, course, result.score)

        // Mark lesson as completed if quiz passed (60% or higher)
        if (result.isPassed) {
            await markLessonCompleted(user, courseId, lessonId)
        }

        // Persist user changes (quizzesAnswered and saved attempts)
        await user.save()
    }

    res.json(result)
})

coursesRouter.use(mockHandler)

export { coursesRouter }
