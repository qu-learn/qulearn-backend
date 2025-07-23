import { Router, Request, Response } from 'express'

import {
    userToResponse,
    IGetMyProfileResponse,
    IUpdateMyProfileRequest,
    IUpdateMyProfileResponse,
    Req, Res,
} from '../types.mts'
import { AuthenticatedOnly } from './authRouter.mts'

const usersRouter = Router()

usersRouter.get('/me', AuthenticatedOnly, async (req: Req, res: Res<IGetMyProfileResponse>) => {
    res.json({
        user: userToResponse(req.user!),
    })
})

usersRouter.patch('/me', AuthenticatedOnly, async (req: Req<IUpdateMyProfileRequest>, res: Res<IUpdateMyProfileResponse>) => {
    const user = req.user!
    
    await user.updateOne({
        fullName: req.body.fullName,
        email: req.body.email,
        country: req.body.country,
        city: req.body.city,
    })

    res.json({
        user: userToResponse(user),
    })
})

export { usersRouter }
