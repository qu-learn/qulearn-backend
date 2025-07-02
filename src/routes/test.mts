import { Router, Request, Response } from 'express'

const testRouter = Router()

type TestInput = void
type TestOutput = {
    message: string;
}

testRouter.get('/', (req: Request<TestInput>, res: Response<TestOutput>) => {
    res.json({
        message: 'Test route is working!',
    })
})

export { testRouter }
