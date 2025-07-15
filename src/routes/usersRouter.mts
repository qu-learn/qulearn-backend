import { Router, Request, Response } from 'express'

import {
    userToResponse,
    IGetMyProfileResponse,
} from '../types.mts'

const usersRouter = Router()

usersRouter.get('/me', async (req: Request, res: Response<IGetMyProfileResponse>) => {
    res.json({
        user: userToResponse(req.user!),
    })
})

export { usersRouter }
