import express, { Router } from 'express'
import cookieParser from 'cookie-parser'
import logger from 'morgan'
import cors from 'cors'
import { testRouter } from './routes/test.mts'

const app = express()

app.use(logger('dev'))
app.use(cors())
app.use(cookieParser())

const api = Router()
app.use('/api/v1', api)

api.use('/test', testRouter)

const port = parseInt(process.env.PORT || '3000')
app.listen(port, () => console.log(`Server running on ${port}`))
