import { Router, Request, Response } from 'express'

import {
    userToResponse,
    IGetMyProfileResponse,
    IUpdateMyProfileRequest,
    IUpdateMyProfileResponse,
    Req, Res,
    IGetMyDashboardResponse,
    courseToResponse,
    mockHandler,
    IEnrollInCourseRequest,
    IEnrollInCourseResponse,
    IGetMyEnrollmentsResponse,
    IGetCoursesResponse,
    IEnrollment,
    APIError, // added
    IGetCourseByIdResponse, // added
    IMarkLessonCompleteRequest, // added
    IMarkLessonCompleteResponse, // added
} from '../types.mts'
import { AuthenticatedOnly, StudentOnly } from './authRouter.mts'
import { CourseModel, UserModel } from '../db.mts'

const studentsRouter = Router()


studentsRouter.get('/me/dashboard', StudentOnly, async (req: Req, res: Res<IGetMyDashboardResponse>) => {
    const userId = (req as any).user?.id
    if (!userId) throw new APIError(401, 'Unauthorized')

    const user = await UserModel.findById(userId)
    if (!user) throw new APIError(404, 'User not found')

    const enrolledCourses = await Promise.all((user.enrollments || []).map(async (enr) => {
        const course = enr.courseId
            ? await CourseModel.findById(enr.courseId).populate('instructor.userId', 'id fullName')
            : null
        return {
            course: course ? courseToResponse(course) : null,
            progressPercentage: enr.progressPercentage || 0,
        }
    }))

    res.json({
        "points": 1,
        "badges": [
            {
                "id": "b1",
                "name": "QBronze",
                "description": "Completed 3 Courses",
                "iconUrl": "https://cdn-icons-png.flaticon.com/128/11167/11167978.png"
            },
            {
                "id": "b2",
                "name": "Quantum Explorer",
                "description": "30+ simulations run",
                "iconUrl": "https://cdn-icons-png.flaticon.com/128/744/744922.png"
            },
            {
                "id": "b3",
                "name": "Quantum Enthusiast",
                "description": "Participated in 5 discussions",
                "iconUrl": "https://cdn-icons-png.flaticon.com/128/9319/9319106.png"
            }
        ],
        "learningStreak": 3,
        "achievements": [],
        "enrolledCourses": enrolledCourses as unknown as IEnrollment[],
        "recommendedCourses": [],
    })
})

// List courses available to students (published)
studentsRouter.get('/student/courses', StudentOnly, async (req: Req, res: Res<IGetCoursesResponse>) => {
    const courses = await CourseModel.find({ status: 'published' })
        .populate('instructor.userId', 'id fullName')
        .sort({ createdAt: -1 })
    res.json({
        courses: courses.map(c => courseToResponse(c)),
    })
})

// Enroll in a course
studentsRouter.post('/enrollments', StudentOnly, async (req: Req<IEnrollInCourseRequest>, res: Res<IEnrollInCourseResponse>) => {
    const userId = (req as any).user?.id
    if (!userId) throw new APIError(401, 'Unauthorized')

    const { courseId } = req.body
    const user = await UserModel.findById(userId)
    if (!user) throw new APIError(404, 'User not found')

    // prevent duplicate enrollment
    const already = user.enrollments?.some(e => e.courseId?.toString() === courseId)
    if (already) {
        throw new APIError(400, 'Already enrolled in this course')
    }
    user.enrollments = user.enrollments || []
    user.enrollments.push({ courseId, progressPercentage: 0 })
    await user.save()

    const course = await CourseModel.findById(courseId)
        .populate('instructor.userId', 'id fullName')

    res.json({
        enrollment: {
            course: course ? courseToResponse(course) : null,
            progressPercentage: 0,
        } as IEnrollment
    })
})

// Get authenticated user's enrollments
studentsRouter.get('/me/enrollments', StudentOnly, async (req: Req, res: Res<IGetMyEnrollmentsResponse>) => {
    const userId = (req as any).user?.id
    if (!userId) throw new APIError(401, 'Unauthorized')

    const user = await UserModel.findById(userId)
    if (!user) throw new APIError(404, 'User not found')

    const enrollments = await Promise.all((user.enrollments || []).map(async (enr) => {
        const course = enr.courseId ? await CourseModel.findById(enr.courseId).populate('instructor.userId', 'id fullName') : null
        return {
            course: course ? courseToResponse(course) : ({} as any),
            progressPercentage: enr.progressPercentage || 0,
            completedAt: enr.completedAt ? enr.completedAt.toISOString() : undefined,
        } as IEnrollment
    }))

    res.json({ enrollments })
})

// Get enrolled course by id for authenticated student
studentsRouter.get('/courses/:courseId', StudentOnly, async (req: Req, res: Res<IGetCourseByIdResponse>) => {
    const userId = (req as any).user?.id
    if (!userId) throw new APIError(401, 'Unauthorized')

    const { courseId } = req.params
    if (!courseId) throw new APIError(400, 'Course ID required')

    const user = await UserModel.findById(userId)
    if (!user) throw new APIError(404, 'User not found')

    const enrollment = (user.enrollments || []).find(e => e.courseId?.toString() === courseId)
    if (!enrollment) throw new APIError(403, 'Not enrolled in this course')

    const course = await CourseModel.findById(courseId)
        .populate('instructor.userId', 'id fullName')

    if (!course) throw new APIError(404, 'Course not found')

    const completion: IEnrollment = {
        progressPercentage: enrollment.progressPercentage || 0,
        completedAt: enrollment.completedAt ? enrollment.completedAt.toISOString() : undefined,
        completions: (enrollment as any).completions || undefined,
        QuizAttempts: (enrollment as any).QuizAttempts || undefined,
    } as unknown as IEnrollment

    res.json({
        course: courseToResponse(course),
        completion,
    })
})

// Mark a lesson complete for an enrolled student
studentsRouter.post('/enrollments/:courseId/modules/:moduleId/lessons/:lessonId/complete', StudentOnly, async (req: Req<IMarkLessonCompleteRequest>, res: Res<IMarkLessonCompleteResponse>) => {
    const userId = (req as any).user?.id
    if (!userId) throw new APIError(401, 'Unauthorized')

    const { courseId, moduleId, lessonId } = req.params as any
    if (!courseId || !moduleId || !lessonId) throw new APIError(400, 'courseId, moduleId and lessonId are required')

    const user = await UserModel.findById(userId)
    if (!user) throw new APIError(404, 'User not found')

    // find enrollment by index so we can re-assign later
    const enrollmentIndex = (user.enrollments || []).findIndex(e => String(e.courseId) === String(courseId))
    if (enrollmentIndex === -1) throw new APIError(403, 'Not enrolled in this course')

    const course = await CourseModel.findById(courseId)
    if (!course) throw new APIError(404, 'Course not found')

    // work on a mutable reference and re-assign it back to the document array
    const enrollment = user.enrollments![enrollmentIndex] as any
    enrollment.completions = enrollment.completions || []

    // find or create module completion by index
    let moduleIndex = enrollment.completions.findIndex((m: any) => String(m.moduleId) === String(moduleId))
    if (moduleIndex === -1) {
        enrollment.completions.push({ moduleId, lessonIds: [] })
        moduleIndex = enrollment.completions.length - 1
    }

    const modComp = enrollment.completions[moduleIndex] as any

    // check if lesson already completed
    const existing = (modComp.lessonIds || []).some((l: any) => String(l.lessonId) === String(lessonId))
    if (!existing) {
        modComp.lessonIds = modComp.lessonIds || []
        modComp.lessonIds.push({
            lessonId,
            completedAt: req.body?.completedAt ? new Date(req.body.completedAt) : new Date(),
        })
    }

    // re-assign the mutated enrollment object back to the user's enrollments array
    user.enrollments![enrollmentIndex] = enrollment

    // recalc progress
    const totalLessons = (course.modules || []).reduce((sum, m) => sum + ((m.lessons || []).length || 0), 0)
    const completedLessonIds = new Set<string>()
    ;(enrollment.completions || []).forEach((m: any) => {
        (m.lessonIds || []).forEach((l: any) => completedLessonIds.add(String(l.lessonId)))
    })
    const completedCount = completedLessonIds.size
    enrollment.progressPercentage = totalLessons > 0 ? Math.round((completedCount / totalLessons) * 100) : 0

    if (totalLessons > 0 && completedCount >= totalLessons && !enrollment.completedAt) {
        enrollment.completedAt = new Date()
    }

    // mark modified and save once
    user.markModified('enrollments')
    await user.save()

    const enrollmentResp: IEnrollment = {
        course: courseToResponse(course),
        progressPercentage: enrollment.progressPercentage || 0,
        completedAt: enrollment.completedAt ? enrollment.completedAt.toISOString() : undefined,
        completions: enrollment.completions,
        QuizAttempts: (enrollment as any).QuizAttempts || undefined,
    } as unknown as IEnrollment

    res.json({ enrollment: enrollmentResp })
})

export { studentsRouter }
