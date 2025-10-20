import { Router } from 'express'

import {
    APIError,
    Req,
    Res,
    IGetAchievementsResponse,
} from '../types.mts'
import { AuthenticatedOnly } from './authRouter.mts'
import { UserModel } from '../db.mts'
import { getLeaderboard } from '../gamification-engine.mts'

const achievementsRouter = Router()

achievementsRouter.get('/', AuthenticatedOnly, async (req: Req<void>, res: Res<IGetAchievementsResponse>) => {
    const user = req.user!
    
    // Get leaderboard
    const leaderboard = await getLeaderboard(10)
    
    // Generate milestones from user's achievements
    const milestones = (user.achievements || []).map(achievement => 
        `Earned ${achievement.badgeName} badge`
    )
    
    res.json({
        milestones,
        leaderboard,
    })
})

export { achievementsRouter }
