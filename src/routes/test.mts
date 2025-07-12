import { Router, Request, Response } from 'express'
import { TestModel } from '../db.mts';

const testRouter = Router()

type TestInput = void
type TestOutput = {
    message: string;
}

testRouter.get('/', async (req: Request<TestInput>, res: Response<TestOutput>) => {
    const testMessage = await TestModel.findOne()
    res.json({
        message: testMessage?.testmsg || 'No message found in the database!'
    })
})

export { testRouter }
