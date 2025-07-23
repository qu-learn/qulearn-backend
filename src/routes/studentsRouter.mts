import { Router, Request, Response } from 'express'

import {
    userToResponse,
    IGetMyProfileResponse,
    IUpdateMyProfileRequest,
    IUpdateMyProfileResponse,
    Req, Res,
    IGetMyDashboardResponse,
    courseToResponse,
} from '../types.mts'
import { AuthenticatedOnly } from './authRouter.mts'
import { CourseModel } from '../db.mts'

const studentsRouter = Router()


studentsRouter.get('/me/dashboard', AuthenticatedOnly, async (req: Req, res: Res<IGetMyDashboardResponse>) => {
    const courses = await CourseModel.find({}, {})
        .populate('instructor.userId', 'id fullName')
        .sort({ createdAt: 1 })
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
        "enrolledCourses": courses.map(c => {
            return {
                course: courseToResponse(c),
                progressPercentage: 0,
            }
        }),
        "recommendedCourses": [],
    })
})

export { studentsRouter }
