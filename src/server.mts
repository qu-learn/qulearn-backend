import express, { Router } from 'express'
import logger from 'morgan'
import cors from 'cors'
import { initDb } from './db.mts'
import passport from 'passport'
import { APIError, mockHandler } from './types.mts'
import { authRouter } from './routes/authRouter.mjs'
import { usersRouter } from './routes/usersRouter.mts'
import { coursesRouter } from './routes/coursesRouter.mts'
import { educatorsRouter } from './routes/educatorsRouter.mts'
import { sysAdminRouter } from './routes/sysAdminRouter.mts'
import { courseAdminRouter } from './routes/courseAdminRouter.mts'
import { studentsRouter } from './routes/studentsRouter.mts'
import { circuitsRouter } from './routes/circuitsRouter.mts'
import { networksRouter } from './routes/networksRouter.mts'
import { achievementsRouter } from './routes/achievementsRouter.mts'

await initDb()

const app = express()

app.use(logger('dev') as any)
app.use(cors())
app.use(express.json())
app.use(passport.initialize())

const api = Router()
app.use('/api/v1', api)

api.use('/auth', authRouter)
api.use('/users', usersRouter)
api.use('/courses', coursesRouter)
api.use('/educators', educatorsRouter)
api.use('/sys-admin', sysAdminRouter)
api.use('/course-admin', courseAdminRouter)
api.use('/students', studentsRouter)
api.use('/circuits', circuitsRouter)
api.use('/networks', networksRouter)
api.use('/achievements', achievementsRouter)

api.use(mockHandler)

api.use((err, req, res, next) => {
    console.error(err.stack || err)
    if (err instanceof APIError) {
        res.status(err.status).json({ error: err.message })
    } else {
        res.status(500).json({ error: 'Internal Server Error' })
    }
})

const port = parseInt(process.env.PORT || '4000')
app.listen(port, () => console.log(`Server running on ${port}`))
