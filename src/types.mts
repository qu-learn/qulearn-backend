export * from './types-frontend.mjs'
import type { IUser, ICourse } from './types-frontend.mjs'

import { Request, Response } from 'express'
import { User, Course } from './db.mts'

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
    const u: any = user as any
    const createdAt: any = u.createdAt
    return {
        id: (u._id?.toString?.() ?? u.id) as string,
        fullName: (u.fullName ?? '') as string,
        email: (u.email ?? '') as string,
        bio: (u.bio ?? undefined) as any,
        certName: (u.certName ?? undefined) as any,
        contactNumber: (u.contactNumber ?? undefined) as any,
        nationalId: (u.nationalId ?? undefined) as any,
        residentialAddress: (u.residentialAddress ?? undefined) as any,
        gender: (u.gender ?? undefined) as any,
        role: u.role as any,
        avatarUrl: (u.avatarUrl ?? undefined) as any,
        country: (u.country ?? undefined) as any,
        city: (u.city ?? undefined) as any,
        createdAt: (createdAt instanceof Date ? createdAt.toISOString() : new Date(createdAt ?? Date.now()).toISOString()),
        status: u.status as any,
    }
}

export function courseToResponse(course: Course, enrollments?: number, enrollmentHistory?: any[]): ICourse {
    return {
        id: course._id.toString(),
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
        createdAt: course.createdAt.toString(),
        modules: course.modules.map(module => ({
            id: (module as any)._id?.toString?.() ?? String((module as any).id ?? ''),
            title: module.title!,
            lessons: module.lessons.map(lesson => ({
                id: (lesson as any)._id?.toString?.() ?? String((lesson as any).id ?? ''),
                title: lesson.title!,
                content: lesson.content!,
                quiz: lesson.quiz ? {
                    id: (lesson.quiz as any)._id?.toString?.() ?? String(((lesson as any).quiz as any)?.id ?? ''),
                    title: lesson.quiz.title!,
                    description: lesson.quiz.description!,
                    questions: lesson.quiz.questions.map(q => ({
                        id: (q as any)._id?.toString?.() ?? String((q as any).id ?? ''),
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
        enrollments,
        enrollmentHistory,
    }
}

import { mockResponse } from '../mock-server-x.mjs'
import type { Request as ExpressRequest, Response as ExpressResponse, NextFunction } from 'express'
export const mockHandler = (req: ExpressRequest, res: ExpressResponse, next: NextFunction) => {
    const key = ('/api/v1' + req.path) as keyof typeof mockResponse
    if (Object.prototype.hasOwnProperty.call(mockResponse, key)) {
        res.json((mockResponse as any)[key])
        return
    }
    next()
}
