import { Router } from 'express'

import {
    APIError,
    courseToResponse,
    IGetCoursesResponse,
    Req,
    Res,
} from '../types.mts'
import { CourseModel } from '../db.mts'
import { EducatorOnly } from './authRouter.mts'

const educatorsRouter = Router()

educatorsRouter.get('/me/courses', EducatorOnly, async (req: Req<void>, res: Res<IGetCoursesResponse>) => {
    const courses = await CourseModel.find({
        'instructor.userId': req.user!.id,
    })
        .populate('instructor.userId', 'id fullName')
        .sort({ title: 1 })
    res.json({
        courses: courses.map(courseToResponse),
    })
})

export { educatorsRouter }
