import { Router } from 'express'

import {
    APIError,
    CourseStatus,
    courseToResponse,
    IGetCoursesResponse,
    IGetEducatorDashboardResponse,
    IGetCourseAnalyticsResponse,
    mockHandler,
    Req,
    Res,
} from '../types.mts'
import { Course, CourseModel, UserModel } from '../db.mts'
import { EducatorOnly } from './authRouter.mts'

const educatorsRouter = Router()

educatorsRouter.get('/me/courses', EducatorOnly, async (req: Req<void>, res: Res<IGetCoursesResponse>) => {
    const courses = await CourseModel.find({
        'instructor.userId': req.user!.id,
    })
        .populate('instructor.userId', 'id fullName')
        .sort({ createdAt: 1 })

    // Build enrollment stats for these courses
    const courseIds = courses.map(c => c._id.toString())
    const usersWithEnrollments = await UserModel.find(
        { 'enrollments.courseId': { $in: courseIds } },
        'fullName enrollments'
    ).lean()

    const stats = new Map<string, { count: number; history: any[] }>()
    for (const cid of courseIds) stats.set(cid, { count: 0, history: [] })

    for (const user of usersWithEnrollments) {
        if (!user.enrollments) continue
        for (const en of user.enrollments) {
            if (!en || !en.courseId) continue
            const cid = en.courseId.toString()
            if (!stats.has(cid)) continue
            const s = stats.get(cid)!
            s.count++
            s.history.push({
                userId: user._id?.toString() ?? 'unknown',
                fullName: (user as any).fullName,
                progress: en.progressPercentage ?? 0,
                completedAt: en.completedAt ? new Date(en.completedAt).toISOString() : undefined,
            })
        }
    }

    res.json({
        courses: courses.map(course => {
            const s = stats.get(course._id.toString()) || { count: 0, history: [] }
            return courseToResponse(course, s.count, s.history)
        }),
    })
})

// New: educator dashboard
educatorsRouter.get('/me/dashboard', EducatorOnly, async (req: Req<void>, res: Res<IGetEducatorDashboardResponse>) => {
    const instructorId = req.user!.id

    // Find all courses by this instructor
    const courses = await CourseModel.find({ 'instructor.userId': instructorId })
        .populate('instructor.userId', 'id fullName')
        .sort({ createdAt: -1 })

    const publishedCourses = courses.filter(c => c.status === "published" as CourseStatus);

    const courseIds = courses.map(c => c._id.toString())

    // Find users who have enrollments for these courses
    const usersWithEnrollments = await UserModel.find(
        { 'enrollments.courseId': { $in: courseIds } },
        'enrollments'
    ).lean()

    let totalEnrollments = 0
    const uniqueStudents = new Set<string>()

    for (const user of usersWithEnrollments) {
        if (!user.enrollments) continue
        for (const en of user.enrollments) {
            if (!en || !en.courseId) continue
            const cid = en.courseId.toString()
            if (courseIds.includes(cid)) {
                totalEnrollments++
                uniqueStudents.add(user._id.toString ? user._id.toString() : (user as any)._id)
            }
        }
    }

    res.json({
        publishedCoursesCount: publishedCourses.length,
        totalEnrollments,
        totalStudents: uniqueStudents.size,
        // include recent courses and full course objects
        recentCourses: courses.slice(0, 5).map(courseToResponse),
        courses: courses.map(courseToResponse),
    })
})

// New: educator course analytics
educatorsRouter.get(
    '/courses/:id/analytics',
    EducatorOnly,
    async (req: Req<void, { id: string }>, res: Res<IGetCourseAnalyticsResponse>) => {
        const courseId = req.params.id

        const course = await CourseModel.findById(courseId)
        if (!course) throw new APIError(404, 'Course not found')

        // Ensure requesting educator owns the course
        if (course.instructor?.userId?.toString() !== req.user!.id)
            throw new APIError(403, 'Not authorized to view analytics for this course')

        // Find users having enrollments for this course
        const users = await UserModel.find(
            { 'enrollments.courseId': course._id },
            'enrollments fullName email createdAt'
        ).lean()

        let totalEnrolled = 0
        let totalCompleted = 0
        let sumProgress = 0
        const students: Array<{
            studentId: string
            studentName?: string
            email?: string
            progress: number
            completed: boolean
            enrolledAt?: string
        }> = []

        const studentsProgress: { studentId: string; studentName: string; progress: number }[] = []

        for (const user of users) {
            if (!user.enrollments) continue
            for (const en of user.enrollments) {
                if (!en || en.courseId?.toString() !== courseId) continue
                totalEnrolled++
                const progress = en.progressPercentage ?? 0
                sumProgress += progress
                const completed = !!en.completedAt || progress >= 100
                if (completed) totalCompleted++
                students.push({
                    studentId: user._id?.toString?.() ?? (user as any)._id,
                    studentName: (user as any).fullName,
                    email: (user as any).email,
                    progress,
                    completed,
                    enrolledAt: en.completedAt ? new Date(en.completedAt).toISOString() : undefined,
                })

                studentsProgress.push({
                    studentId: user._id?.toString?.() ?? (user as any)._id,
                    studentName: (user as any).fullName,
                    progress,
                })
            }
        }

        const averageProgress = totalEnrolled ? Math.round((sumProgress / totalEnrolled) * 100) / 100 : 0

        res.json({
            courseId: course._id.toString(),
            title: course.title || '',
            enrollmentCount: totalEnrolled,
            totalCompleted,
            studentProgress: studentsProgress,
            completionRate: averageProgress,
            averageQuizScore: 67, // Placeholder for future quiz analytics
        })
    }
)

educatorsRouter.delete("/courses/:courseId", EducatorOnly, async (req: Req<void>, res: Res<{ success: boolean }>, next) => {
    try {
        // verify course exists and that the requesting educator owns it
        const course = await CourseModel.findById(req.params.courseId)
        if (!course) throw new APIError(404, 'Course not found')

        if (course.instructor?.userId?.toString() !== req.user!.id) {
            throw new APIError(403, 'Not authorized to delete this course')
        }

        await CourseModel.deleteOne({ _id: course._id })
        res.json({ success: true })
    } catch (err) {
        next(err)
    }
})

export { educatorsRouter }
