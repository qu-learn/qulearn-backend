import { Router, Request, Response } from 'express'

import {
    userToResponse,
    IGetMyProfileResponse,
    IUpdateMyProfileRequest,
    IUpdateMyProfileResponse,
    IChangePasswordRequest,
    IChangePasswordResponse,
    Req, Res,
    mockHandler,
} from '../types.mts'
import { AuthenticatedOnly } from './authRouter.mts'
import { UserModel } from '../db.mts'
import bcrypt from 'bcrypt'

const usersRouter = Router()

usersRouter.get('/me', AuthenticatedOnly, async (req: Req, res: Res<IGetMyProfileResponse>) => {
    res.json({
        user: userToResponse(req.user!),
    })
})

usersRouter.patch('/me', AuthenticatedOnly, async (req: Req<IUpdateMyProfileRequest>, res: Res<IUpdateMyProfileResponse>) => {
    const user = req.user!

    // Only apply fields that are actually provided in the request
    const updatable = ['fullName', 'email', 'country', 'city', 'bio', 'certName', 'contactNumber', 'avatarUrl'] as const
    let changed = false
    for (const key of updatable) {
        if (typeof (req.body as any)[key] !== 'undefined') {
            ;(user as any)[key] = (req.body as any)[key]
            changed = true
        }
    }

    if (changed) {
        await user.save()
    }

    res.json({
        user: userToResponse(user),
    })
})

// Change password endpoint
usersRouter.patch('/me/change-password', AuthenticatedOnly, async (req: Req<IChangePasswordRequest>, res: Res<IChangePasswordResponse>) => {
    const user = req.user!
    const { oldPassword, newPassword } = req.body || {}

    if (!oldPassword || !newPassword) {
        return res.status(400).json({ success: false, reason: 'missing_passwords' })
    }

    // load user with passwordHash for verification
    const fullUser = await UserModel.findById(user.id).select('+passwordHash')
    if (!fullUser || !fullUser.passwordHash) {
        return res.status(404).json({ success: false, reason: 'user_not_found' })
    }

    const match = await bcrypt.compare(oldPassword, fullUser.passwordHash)
    if (!match) {
        return res.status(400).json({ success: false, reason: 'incorrect_old_password' })
    }

    // ensure new password isn't identical to old one
    if (await bcrypt.compare(newPassword, fullUser.passwordHash)) {
        return res.status(400).json({ success: false, reason: 'new_password_same_as_old' })
    }

    fullUser.passwordHash = await bcrypt.hash(newPassword, 10)
    await fullUser.save()

    return res.json({ success: true })
})

usersRouter.use(mockHandler)

export { usersRouter }
