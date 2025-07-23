import { Router, Request, Response } from 'express'

import {
    userToResponse,
    IGetMyProfileResponse,
} from '../types.mts'
import { AuthenticatedOnly } from './authRouter.mts'

const usersRouter = Router()

usersRouter.get('/me', AuthenticatedOnly, async (req: Request, res: Response<IGetMyProfileResponse>) => {
    res.json({
        user: userToResponse(req.user!),
    })
})

export { usersRouter }
