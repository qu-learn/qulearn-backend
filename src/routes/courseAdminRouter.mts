import { Router } from "express";
import {
    IAddCourseAdministratorRequest,
    IAddCourseAdministratorResponse,
    IAddEducatorRequest,
    IAddEducatorResponse,
    IGetCourseAdministratorsResponse,
    IGetEducatorsResponse,
    IGetEducatorResponse,
    IUpdateEducatorRequest,
    IUpdateEducatorResponse,
    IDeleteEducatorResponse,
    mockHandler,
    Req,
    Res,
    userToResponse,
    APIError,
    IGetCourseAdminDashboardResponse,
    IGetCourseAdminUsersRequest,
    IGetCourseAdminUsersResponse,
    IGetCourseAdminCoursesResponse,
    IUpdateCourseStatusRequest,
    IUpdateCourseStatusResponse,
} from "../types.mts";
import { CourseAdminOnly } from "./authRouter.mts";
import bcrypt from 'bcrypt'
import { UserModel, CourseModel } from "../db.mts";
import { courseToResponse } from "../types.mts";

const courseAdminRouter = Router();

// Validation helpers
function isValidEmail(email: string) {
    return /^\S+@\S+\.\S+$/.test(email)
}
function isStrongPassword(pw: string) {
    // min 8 chars, at least one letter and one number
    return /^(?=.*[A-Za-z])(?=.*\d).{8,}$/.test(pw)
}
function isValidContactNumber(n: string) {
    // allow optional + and 7-15 digits
    return /^\+?\d{7,15}$/.test(n)
}

courseAdminRouter.get("/educators", CourseAdminOnly, async (req: Req<void>, res: Res<IGetEducatorsResponse>) => {
    const courseAdmins = await UserModel.find({ role: 'educator' })
    res.json({
        educators: courseAdmins.map(userToResponse),
    })
})

courseAdminRouter.post("/educators", CourseAdminOnly, async (req: Req<IAddEducatorRequest>, res: Res<IAddEducatorResponse>, next) => {
    try {
        const data = req.body;

        // Required fields
        const required = ['fullName','email','password','contactNumber','nationalId','residentialAddress','gender']
        for (const f of required) {
            if (!data[f as keyof typeof data]) {
                throw new APIError(400, `${f} is required`)
            }
        }

        if (!isValidEmail(data.email)) throw new APIError(400, "Invalid email")
        if (!isStrongPassword(data.password)) throw new APIError(400, "Password must be at least 8 characters and include letters and numbers")
        if (!isValidContactNumber(data.contactNumber)) throw new APIError(400, "Invalid contact number")

        // Uniqueness checks
        const existingEmail = await UserModel.findOne({ email: data.email })
        if (existingEmail) throw new APIError(400, "Email already in use")

        const existingNid = await UserModel.findOne({ nationalId: data.nationalId })
        if (existingNid) throw new APIError(400, "National ID already in use")

        const hash = await bcrypt.hash(data.password, 10)
        const user = await UserModel.create({
            fullName: data.fullName,
            email: data.email,
            passwordHash: hash,
            contactNumber: data.contactNumber,
            nationalId: data.nationalId,
            residentialAddress: data.residentialAddress,
            gender: data.gender,
            role: 'educator',
        })
        res.json({
            educator: userToResponse(user),
        })
    } catch (err) {
        next(err)
    }
})

// Replace single-educator GET to use APIError
courseAdminRouter.get("/educators/:educatorId", CourseAdminOnly, async (req: Req<void>, res: Res<IGetEducatorResponse>, next) => {
    try {
        const educator = await UserModel.findOne({ _id: req.params.educatorId, role: 'educator' })
        if (!educator) throw new APIError(404, 'Educator not found')
        res.json({ educator: userToResponse(educator) })
    } catch (err) {
        next(err)
    }
})

// Replace/update educator PATCH handler with validation & safe updates
courseAdminRouter.patch("/educators/:educatorId", CourseAdminOnly, async (req: Req<IUpdateEducatorRequest>, res: Res<IUpdateEducatorResponse>, next) => {
    try {
        // Support either { educator } wrapper or direct body
        const payload = (req.body && (req.body as any).educator) ? (req.body as any).educator : req.body;

        if (!payload || Object.keys(payload).length === 0) {
            throw new APIError(400, "No update data provided")
        }

        const educatorId = req.params.educatorId

        // Optional: ensure body educatorId (if provided) matches URL
        if (payload.educatorId && payload.educatorId !== educatorId) {
            throw new APIError(400, "educatorId in body does not match URL")
        }

        // Whitelist fields that can be updated
        const allowed = [
            'fullName',
            'email',
            'password',
            'contactNumber',
            'nationalId',
            'residentialAddress',
            'gender',
            'avatarUrl',
            'country',
            'city',
            'status',
        ]

        const updates: any = {}
        for (const key of allowed) {
            if (Object.prototype.hasOwnProperty.call(payload, key)) {
                updates[key] = (payload as any)[key]
            }
        }

        // Field-specific validations
        if (updates.email) {
            if (!isValidEmail(updates.email)) throw new APIError(400, "Invalid email")
            const existing = await UserModel.findOne({ email: updates.email, _id: { $ne: educatorId } })
            if (existing) throw new APIError(400, "Email already in use")
        }

        if (updates.password) {
            if (!isStrongPassword(updates.password)) throw new APIError(400, "Password must be at least 8 characters and include letters and numbers")
        }

        if (updates.contactNumber && !isValidContactNumber(updates.contactNumber)) {
            throw new APIError(400, "Invalid contact number")
        }

        if (updates.nationalId) {
            const existingN = await UserModel.findOne({ nationalId: updates.nationalId, _id: { $ne: educatorId } })
            if (existingN) throw new APIError(400, "National ID already in use")
        }

        // Hash password if provided
        if (updates.password) {
            updates.passwordHash = await bcrypt.hash(updates.password, 10)
            delete updates.password
        }

        // Do not allow role changes via this endpoint; enforce educator role
        updates.role = 'educator'

        console.log("Updating educator", educatorId, "with", updates)

        const updated = await UserModel.findOneAndUpdate(
            { _id: educatorId, role: 'educator' },
            updates,
            { new: true }
        )

        if (!updated) throw new APIError(404, "Educator not found")

        res.json({ educator: userToResponse(updated) })
    } catch (err) {
        next(err)
    }
})

// New: delete educator
courseAdminRouter.delete("/educators/:educatorId", CourseAdminOnly, async (req: Req<void>, res: Res<IDeleteEducatorResponse>) => {
    await UserModel.deleteOne({ _id: req.params.educatorId, role: 'educator' })
    res.json({ success: true })
})

// New: course-admin dashboard
courseAdminRouter.get("/dashboard", CourseAdminOnly, async (req: Req<void>, res: Res<IGetCourseAdminDashboardResponse>, next) => {
    try {
        const totalUsers = await UserModel.countDocuments({})
        const activeCourses = await CourseModel.countDocuments({ status: 'published' })
        const now = new Date()
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
        const newRegistrationsThisMonth = await UserModel.countDocuments({ createdAt: { $gte: startOfMonth } })
        const pendingApprovals = await CourseModel.countDocuments({ status: 'under-review' })

        // enrollmentsPerMonth: last 6 months based on enrollment.enrolledAt in Course.enrollments
        const monthsBack = 6
        const months: { monthLabel: string; year: number; monthNum: number; count: number }[] = []
        for (let i = monthsBack - 1; i >= 0; i--) {
            const date = new Date(now.getFullYear(), now.getMonth() - i, 1)
            months.push({
                monthLabel: date.toLocaleString('en-US', { month: 'short', year: 'numeric' }),
                year: date.getFullYear(),
                monthNum: date.getMonth() + 1, // Mongo $month is 1-based
                count: 0,
            })
        }

        const startDate = new Date(now.getFullYear(), now.getMonth() - (monthsBack - 1), 1)
        const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 1)

        // Aggregate counts from Course.enrollments.enrolledAt for the given window
        const enrollmentCounts = await CourseModel.aggregate([
            { $unwind: "$enrollments" },
            { $match: { "enrollments.enrolledAt": { $gte: startDate, $lt: endDate } } },
            {
                $group: {
                    _id: {
                        year: { $year: "$enrollments.enrolledAt" },
                        month: { $month: "$enrollments.enrolledAt" }
                    },
                    count: { $sum: 1 }
                }
            }
        ])

        // Map aggregation results into our months array
        for (const ec of enrollmentCounts) {
            const yr = ec._id.year
            const mon = ec._id.month
            const idx = months.findIndex(m => m.year === yr && m.monthNum === mon)
            if (idx !== -1) months[idx].count = ec.count
        }

        // Convert to expected response shape
        const enrollmentsPerMonth = months.map(m => ({ month: m.monthLabel, count: m.count }))

        res.json({
            totalUsers,
            activeCourses,
            newRegistrationsThisMonth,
            pendingApprovals,
            enrollmentsPerMonth,
        })
    } catch (err) {
        next(err)
    }
})

// New: paginated users list for course-admin
courseAdminRouter.get("/users", CourseAdminOnly, async (req: Req<void, any, IGetCourseAdminUsersRequest>, res: Res<IGetCourseAdminUsersResponse>, next) => {
    try {
        const page = Math.max(1, Number(req.query.page) || 1)
        const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 20))
        const total = await UserModel.countDocuments({})
        const totalPages = Math.max(1, Math.ceil(total / pageSize))
        const users = await UserModel.find({})
            .skip((page - 1) * pageSize)
            .limit(pageSize)
            .sort({ createdAt: -1 })

        res.json({
            users: users.map(userToResponse),
            totalPages,
            currentPage: page,
        })
    } catch (err) {
        next(err)
    }
})

// New: list courses for course-admin
courseAdminRouter.get("/courses", CourseAdminOnly, async (req: Req<void>, res: Res<IGetCourseAdminCoursesResponse>, next) => {
    try {
        const courses = await CourseModel.find({})

        // Build enrollment stats for these courses
        const courseIds = courses.map(c => c._id.toString())
        const usersWithEnrollments = await UserModel.find(
            { 'enrollments.courseId': { $in: courseIds } },
            'fullName enrollments'
        ).lean()

        // Track total enrollments count, history and completion sum/count for averaging
        const stats = new Map<string, { count: number; history: any[]; completionSum: number; completionCount: number }>()
        for (const cid of courseIds) stats.set(cid, { count: 0, history: [], completionSum: 0, completionCount: 0 })

        for (const user of usersWithEnrollments) {
            if (!user.enrollments) continue
            for (const en of user.enrollments) {
                if (!en || !en.courseId) continue
                const cid = en.courseId.toString()
                if (!stats.has(cid)) continue
                const s = stats.get(cid)!
                s.count++
                // accumulate for average
                if (typeof en.progressPercentage === 'number') {
                    s.completionSum += en.progressPercentage
                    s.completionCount += 1
                }
                s.history.push({
                    userId: user._id ? user._id.toString() : 'unknown',
                    fullName: (user as any).fullName,
                    progress: en.progressPercentage ?? 0,
                    completedAt: en.completedAt ? new Date(en.completedAt).toISOString() : undefined,
                })
            }
        }

        // Build response with avgCompletionRate per course
        // Prepare last 6 months labels
        const now = new Date()
        const monthsBack = 6
        const months: { monthLabel: string; year: number; monthNum: number }[] = []
        for (let i = monthsBack - 1; i >= 0; i--) {
            const date = new Date(now.getFullYear(), now.getMonth() - i, 1)
            months.push({
                monthLabel: date.toLocaleString('en-US', { month: 'short', year: 'numeric' }),
                year: date.getFullYear(),
                monthNum: date.getMonth() + 1,
            })
        }

        res.json({
            courses: courses.map(course => {
                const s = stats.get(course._id.toString()) || { count: 0, history: [], completionSum: 0, completionCount: 0 }
                const avg = s.completionCount > 0 ? (s.completionSum / s.completionCount) : 0

                // Build per-course monthly enrollment counts by scanning course.enrollments
                const counts = new Map<string, number>()
                ;(course.enrollments || []).forEach((en: any) => {
                    if (!en || !en.enrolledAt) return
                    const d = new Date(en.enrolledAt)
                    if (isNaN(d.getTime())) return
                    const key = `${d.getFullYear()}-${d.getMonth() + 1}`
                    counts.set(key, (counts.get(key) || 0) + 1)
                })

                const monthlyEnrollments = months.map(m => ({
                    month: m.monthLabel,
                    count: counts.get(`${m.year}-${m.monthNum}`) || 0,
                }))

                return {
                    course: courseToResponse(course, s.count, s.history),
                    avgCompletionRate: Math.round(avg * 100) / 100, // round to 2 decimals
                    monthlyEnrollments,
                }
            })
        })
    } catch (err) {
        next(err)
    }
})

// New: update course status (publish/reject) with optional feedback
courseAdminRouter.patch("/courses/:courseId/status", CourseAdminOnly, async (req: Req<IUpdateCourseStatusRequest>, res: Res<IUpdateCourseStatusResponse>, next) => {
    try {
        const { status, feedback } = req.body
        // Allow all valid CourseStatus values defined in the schema
        const allowedStatuses = ['draft', 'under-review', 'published', 'rejected']

        if (!status || typeof status !== 'string' || !allowedStatuses.includes(status)) {
            throw new APIError(400, `Invalid status; must be one of: ${allowedStatuses.join(', ')}`)
        }

        const update: any = { status }
        if (feedback) update.feedback = feedback

        const updated = await CourseModel.findByIdAndUpdate(
            req.params.courseId,
            update,
            { new: true }
        )

        if (!updated) throw new APIError(404, "Course not found")
        res.json({ course: courseToResponse(updated) })
    } catch (err) {
        next(err)
    }
})

// New: delete course
courseAdminRouter.delete("/courses/:courseId", CourseAdminOnly, async (req: Req<void>, res: Res<{ success: boolean }>, next) => {
    try {
        await CourseModel.deleteOne({ _id: req.params.courseId })
        res.json({ success: true })
    } catch (err) {
        next(err)
    }
})

export { courseAdminRouter };