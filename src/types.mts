export type * from '../../qulearn-frontend/src/utils/types'

import { Request, Response } from 'express'
import { User } from './db.mts'
import { IUser } from './types.mts'

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

