import mongoose from 'mongoose'

export const TestModel = mongoose.model('Test', new mongoose.Schema({
    testmsg: String,
}))

export async function initDb() {
    await mongoose.connect('mongodb://127.0.0.1:27017/qulearn')    
    console.log('Database connection initialized')
    
    // Ensure the TestModel has at least one document
    if (!(await TestModel.findOne())) {
        await TestModel.create({
            testmsg: 'This is a test message from the database!'
        })
    }
}
