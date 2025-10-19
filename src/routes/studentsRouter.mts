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
} from '../types.mts'
import { AuthenticatedOnly, StudentOnly } from './authRouter.mts'
import { CourseModel, UserModel } from '../db.mts'

const studentsRouter = Router()


studentsRouter.get('/me/dashboard', AuthenticatedOnly, async (req: Req, res: Res<IGetMyDashboardResponse>) => {
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
        "enrolledCourses": enrolledCourses,
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
            course: course ? courseToResponse(course) : ({} as any),
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

export { studentsRouter }
