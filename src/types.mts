export type * from '../../qulearn-frontend/src/utils/types'

import { Request, Response } from 'express'
import { User, Course } from './db.mts'
import { IUser, ICourse } from './types.mts'

export class APIError extends Error {
    name = 'APIError'
    status: number
    constructor(status: number, message: string) {
        super(message)
        this.status = status
    }
}

export type Req<T = any, P = any, Q = any> = Request<P, any, T, Q>
export type Res<T = any> = Response<T>

export function userToResponse(user: User): IUser {
    return {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        avatarUrl: user.avatarUrl || undefined,
        country: user.country || undefined,
        city: user.city || undefined,
        createdAt: user.createdAt.toISOString(),
    }
}

export function courseToResponse(course: Course): ICourse {
    return {
        id: course.id,
        title: course.title!,
        subtitle: course.subtitle!,
        description: course.description!,
        category: course.category!,
        difficultyLevel: course.difficultyLevel!,
        prerequisites: course.prerequisites,
        thumbnailUrl: course.thumbnailUrl!,
        status: course.status,
        instructor: {
            id: course.instructor?.userId?.toString()!,
            fullName: course.instructor?.fullName || '',
        },
        jupyterNotebookUrl: course.jupyterNotebookUrl || undefined,
        createdAt: course.createdAt.toISOString(),
        modules: course.modules.map(module => ({
            id: module.id!,
            title: module.title!,
            lessons: module.lessons.map(lesson => ({
                id: lesson.id!,
                title: lesson.title!,
                content: lesson.content!,
                quiz: lesson.quiz ? {
                    id: lesson.id!,
                    title: lesson.quiz.title!,
                    description: lesson.quiz.description!,
                    questions: lesson.quiz.questions.map(q => ({
                        id: q.id!,
                        text: q.text!,
                        type: q.type!,
                        options: q.options,
                        answers: q.answers,
                    })),
                } : undefined,
                circuitId: lesson.circuitId?.toString()!,
                networkId: lesson.networkId?.toString()!,
            })),
        })),
    }
}

