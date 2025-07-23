import { Router } from 'express'

import {
    APIError,
    courseToResponse,
    ICreateCourseRequest, ICreateCourseResponse,
    IGetCourseByIdResponse,
    IUpdateCourseRequest,
    IUpdateCourseResponse,
    Req,
    Res,
} from '../types.mts'
import { CourseModel, User } from '../db.mts'
import { EducatorOnly } from './authRouter.mts'
import { runConversionEngine } from '../conversion-engine.mts'

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

/*coursesRouter.get('/', async (req: Req<void>, res: Res<IGetCoursesResponse>) => {
    const courses = await CourseModel.find({ status: 'published' }, { modules: 0 })
        .populate('instructor.userId', 'id fullName')
        .sort({ title: 1 })
    res.json({
        courses: courses.map(courseToResponse),
    })
})*/

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
        status: 'draft',
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

export { coursesRouter }
