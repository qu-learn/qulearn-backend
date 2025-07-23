import { Router } from 'express'
import passport from 'passport'
import { Strategy as JwtStrategy, ExtractJwt } from 'passport-jwt'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcrypt'

import { UserModel } from '../db.mts'
import {
    APIError, Req, Res, userToResponse,
    ILoginRequest, ILoginResponse,
    IRegisterRequest, IRegisterResponse,
    Role,
} from '../types.mts'

const JWT_SECRET = 'jQFHpDTJEN0iH1t07gn6qIuV'

passport.use('jwt', new JwtStrategy({
    jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
    secretOrKey: JWT_SECRET,
}, async (payload, done) => {
    try {
        const user = await UserModel.findById(payload.sub)
        if (!user) return done(null, false)
        return done(null, user)
    } catch (err) {
        return done(err, false)
    }
}))

export const AuthMiddleware = passport.authenticate('jwt', { session: false })

function createRoleCheckMiddleware(...roles: Role[]) {
    return (req: Req, res: Res, next: Function) => {
        AuthMiddleware(req, res, () => {
            if (!req.user || !roles.includes(req.user.role)) {
                res.status(403).json({ error: 'Forbidden' })
            } else {
                next()
            }
        })
    }
}

export const AuthenticatedOnly = AuthMiddleware
export const StudentOnly = createRoleCheckMiddleware('student')
export const EducatorOnly = createRoleCheckMiddleware('educator')
export const SysAdminOnly = createRoleCheckMiddleware('system-administrator')
export const CourseAdminOnly = createRoleCheckMiddleware('course-administrator')

const authRouter = Router()

authRouter.post('/login', async (req: Req<ILoginRequest>, res: Res<ILoginResponse>) => {
    const { email, password } = req.body
    const user = await UserModel.findOne({ email }, '+passwordHash')
    if (!user) {
        throw new APIError(401, 'Invalid email or password')
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash!)
    if (!isMatch) {
        throw new APIError(401, 'Invalid email or password')
    }

    const token = jwt.sign({ sub: user.id }, JWT_SECRET, { expiresIn: '7d' })
    res.json({
        user: userToResponse(user),
        token,
    })
})

authRouter.post('/register', async (req: Req<IRegisterRequest>, res: Res<IRegisterResponse>) => {
    const { email, password, fullName } = req.body
    const existing = await UserModel.findOne({ email })
    if (existing) {
        throw new APIError(400, 'Email already used')
    }

    const hash = await bcrypt.hash(password, 10)
    const user = await UserModel.create({
        email,
        passwordHash: hash,
        fullName,
        role: 'student',
    })

    const token = jwt.sign({ sub: user.id }, JWT_SECRET, { expiresIn: '7d' })
    res.json({
        user: userToResponse(user),
        token,
    })
})

authRouter.post('/logout', (req: Req, res: Res) => {
    res.status(200).end()
})

export { authRouter }

