import { Router } from 'express'

import {
    APIError,
    Req,
    Res,
    IGetAchievementsResponse,
} from '../types.mts'
import { AuthenticatedOnly } from './authRouter.mts'
import { User } from '../db.mts'

const achievementsRouter = Router()

achievementsRouter.get('/', AuthenticatedOnly, async (req: Req<void>, res: Res<IGetAchievementsResponse>) => {
    const user = req.user!
    
    res.json({
        milestones: [],
        leaderboard: [],
    })
})

export function getDashboardData(user: User) {
    return {
        points: 1,
        badges: [
            {
                id: "b1",
                name: "QBronze",
                description: "Completed 3 Courses",
                iconUrl: "https://cdn-icons-png.flaticon.com/128/11167/11167978.png"
            },
            {
                id: "b2",
                name: "Quantum Explorer",
                description: "30+ simulations run",
                iconUrl: "https://cdn-icons-png.flaticon.com/128/744/744922.png"
            },
            {
                id: "b3",
                name: "Quantum Enthusiast",
                description: "Participated in 5 discussions",
                iconUrl: "https://cdn-icons-png.flaticon.com/128/9319/9319106.png"
            }
        ],
        learningStreak: 3,
        achievements: [],
    }
}

export { achievementsRouter }
