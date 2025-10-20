import { User, Course, UserModel, CourseModel } from './db.mts'
import { IBadge, IAchievement, IEnrollment } from './types.mts'

/**
 * Calculate and return dashboard data for a student
 */
export async function getDashboardData(user: User, enrolledCourses: IEnrollment[]) {
    // Get badges from achievements
    const badges: IBadge[] = (user.achievements || []).map((achievement, index) => ({
        id: `badge_${index}`,
        name: achievement.badgeName || 'Unknown Badge',
        description: '', // Could be enhanced later
        iconUrl: getDefaultBadgeIcon(achievement.badgeName || ''),
    }))

    const achievements: IAchievement[] = (user.achievements || []).map((achievement) => ({
        badge: {
            id: achievement.badgeName || '',
            name: achievement.badgeName || '',
            description: '',
            iconUrl: getDefaultBadgeIcon(achievement.badgeName || ''),
        },
        achievedAt: achievement.achievedAt ? achievement.achievedAt.toISOString() : new Date().toISOString(),
    }))

    // Build a set of unique YYYY-MM-DD strings from all enrollment activityHistory and completion subdocuments
    const dateSet = new Set<string>()
    for (const enr of enrolledCourses || []) {
        // activityHistory entries
        ;(enr.activityHistory || []).forEach((h: any) => {
            if (h?.date && h.lessonsCompleted && h.lessonsCompleted > 0) {
                const d = new Date(h.date)
                if (!isNaN(d.getTime())) dateSet.add(d.toISOString().slice(0, 10))
            }
        })
        // completions -> module -> lessonIds -> completedAt
        ;(enr.completions || []).forEach((mc: any) => {
            ;(mc.lessonIds || []).forEach((li: any) => {
                if (li?.completedAt) {
                    const d = new Date(li.completedAt)
                    if (!isNaN(d.getTime())) dateSet.add(d.toISOString().slice(0, 10))
                }
            })
        })
    }

    // Convert to sorted array of Date objects (ascending)
    const dateArr = Array.from(dateSet).sort().map(d => new Date(d))

    // Compute longest streak (scan sorted dates)
    let longest = 0
    if (dateArr.length > 0) {
        let run = 1
        for (let i = 1; i < dateArr.length; i++) {
            const prev = dateArr[i - 1]
            const cur = dateArr[i]
            const diffDays = Math.round((cur.getTime() - prev.getTime()) / (24 * 60 * 60 * 1000))
            if (diffDays === 1) {
                run++
            } else {
                if (run > longest) longest = run
                run = 1
            }
        }
        if (run > longest) longest = run
    }

    // Compute current streak: count backwards from today while dates exist
    let current = 0
    const today = new Date()
    // normalize to YYYY-MM-DD UTC
    const isoToday = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString().slice(0, 10)
    let cursor = new Date(isoToday)
    while (true) {
        const iso = cursor.toISOString().slice(0, 10)
        if (dateSet.has(iso)) {
            current++
            cursor.setDate(cursor.getDate() - 1)
        } else {
            break
        }
    }

    return {
        points: user.points || 0,
        badges,
        // return current streak as learningStreak for backward compatibility
        learningStreak: current,
        // also include longestStreak for clients that can use it
        longestStreak: longest,
        achievements,
    }
}

/**
 * Get global leaderboard with top users by points
 */
export async function getLeaderboard(limit: number = 10) {
    const topUsers = await UserModel.find({ role: 'student' })
        .sort({ points: -1 })
        .limit(limit)
        .select('fullName points')
        .lean()

    return topUsers.map((user, index) => ({
        rank: index + 1,
        name: user.fullName || 'Anonymous',
        points: user.points || 0,
    }))
}

/**
 * Calculate quiz score based on correct answers
 */
export function calculateQuizScore(questions: any[], submittedAnswers: { questionId: string; answers: string[] }[]) {
    let correctCount = 0
    const totalQuestions = questions.length

    const correctAnswers = questions.map((question) => {
        const submitted = submittedAnswers.find((a) => a.questionId === question.id)
        const submittedSet = new Set(submitted?.answers || [])
        const correctSet = new Set(question.answers || [])

        const isCorrect =
            submittedSet.size === correctSet.size &&
            [...submittedSet].every((ans) => correctSet.has(ans))

        if (isCorrect) correctCount++

        return {
            questionId: question.id!,
            correctAnswers: question.answers || [],
        }
    })

    const score = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0

    return {
        score,
        isPassed: score >= 60, // 60% passing threshold
        correctAnswers,
    }
}

/**
 * Award points to user for quiz completion
 */
export async function awardPointsForQuiz(user: User, course: Course, score: number) {
    if (!course.gamificationSettings) return

    const pointsToAward = course.gamificationSettings.pointsPerQuiz || 0
    const actualPoints = Math.round((pointsToAward * score) / 100) // Award points proportional to score

    user.points = ((user.points as number) || 0) + actualPoints
    await updateLearningStreak(user)
    await user.save()

    // Check and award badges after points update
    await checkAndAwardBadges(user)

    return actualPoints
}

/**
 * Update user's learning streak based on activity
 */
export async function updateLearningStreak(user: User) {
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

    if (!user.lastActiveDate) {
        user.learningStreak = 1
        user.lastActiveDate = now as any
        return
    }

    const lastActive = new Date(user.lastActiveDate as any)
    const lastActiveDay = new Date(lastActive.getFullYear(), lastActive.getMonth(), lastActive.getDate())

    const daysDiff = Math.floor((today.getTime() - lastActiveDay.getTime()) / (1000 * 60 * 60 * 24))

    if (daysDiff === 0) {
        // Same day, no change
        return
    } else if (daysDiff === 1) {
        // Consecutive day
        user.learningStreak = ((user.learningStreak as number) || 0) + 1
        user.lastActiveDate = now as any
    } else {
        // Streak broken
        user.learningStreak = 1
        user.lastActiveDate = now as any
    }
}

/**
 * Check badge criteria and award badges to user
 */
export async function checkAndAwardBadges(user: User) {
    // Get all courses to check their badge definitions
    const courses = await CourseModel.find({ 'gamificationSettings.badges.0': { $exists: true } }).lean()

    const allBadges: any[] = []
    courses.forEach((course) => {
        if (course.gamificationSettings?.badges) {
            allBadges.push(...course.gamificationSettings.badges)
        }
    })

    // Get user's existing badge names
    const existingBadges = new Set((user.achievements || []).map((a) => a.badgeName))

    // Count user's completed courses (enrollments with completedAt)
    const completedCoursesCount = (user.enrollments || []).filter((e) => e.completedAt).length
    const quizzesAnswered = user.quizzesAnswered || 0
    const simulationsRun = user.simulationsRun || 0

    // Check each badge criteria
    for (const badge of allBadges) {
        if (!badge.name || existingBadges.has(badge.name)) continue

        const criteria = badge.criteria
        if (!criteria) continue

        let earned = false

        switch (criteria.type) {
            case 'courses-completed':
                earned = completedCoursesCount >= (criteria.threshold || 0)
                break
            case 'quizzes-answered':
                earned = quizzesAnswered >= (criteria.threshold || 0)
                break
            case 'simulations-run':
                earned = simulationsRun >= (criteria.threshold || 0)
                break
        }

        if (earned) {
            user.achievements = user.achievements || []
            user.achievements.push({
                badgeName: badge.name,
                achievedAt: new Date(),
            })
            existingBadges.add(badge.name)
        }
    }

    await user.save()
}

/**
 * Get default badge icon URL based on badge name
 */
function getDefaultBadgeIcon(badgeName: string): string {
    // Default icons for common badges
    const iconMap: { [key: string]: string } = {
        'QBronze': 'https://cdn-icons-png.flaticon.com/128/11167/11167978.png',
        'Quantum Explorer': 'https://cdn-icons-png.flaticon.com/128/744/744922.png',
        'Quantum Enthusiast': 'https://cdn-icons-png.flaticon.com/128/9319/9319106.png',
    }

    return iconMap[badgeName] || 'https://cdn-icons-png.flaticon.com/128/744/744922.png'
}

/**
 * Calculate course progress percentage based on completed lessons
 */
export function calculateCourseProgress(course: Course, completedLessons: string[]): number {
    let totalLessons = 0
    
    for (const module of course.modules || []) {
        totalLessons += (module.lessons || []).length
    }

    if (totalLessons === 0) return 0

    const completedCount = completedLessons.length
    return Math.min(100, Math.round((completedCount / totalLessons) * 100))
}

/**
 * Mark lesson as completed and update course progress
 */
export async function markLessonCompleted(user: User, courseId: string, lessonId: string) {
    // Find the enrollment
    const enrollment = user.enrollments?.find(e => e.courseId?.toString() === courseId)
    if (!enrollment) return

    // Initialize completedLessons if needed
    if (!enrollment.completedLessons) {
        enrollment.completedLessons = []
    }

    // Add lesson if not already completed
    if (!enrollment.completedLessons.includes(lessonId)) {
        enrollment.completedLessons.push(lessonId)

        // Recalculate progress
        const course = await CourseModel.findById(courseId)
        if (course) {
            enrollment.progressPercentage = calculateCourseProgress(course, enrollment.completedLessons)

            // Mark course as completed if 100%
            if (enrollment.progressPercentage >= 100 && !enrollment.completedAt) {
                enrollment.completedAt = new Date()
            }
        }

        await user.save()
        
        // Check for new badges after progress update
        await checkAndAwardBadges(user)
    }
}

/**
 * Award points for simulation run
 */
export async function awardPointsForSimulation(user: User, course: Course) {
    if (!course.gamificationSettings) return

    const pointsToAward = course.gamificationSettings.pointsPerSimulation || 0
    
    user.points = ((user.points as number) || 0) + pointsToAward
    user.simulationsRun = ((user.simulationsRun as number) || 0) + 1
    
    await updateLearningStreak(user)
    await user.save()
    
    // Check and award badges
    await checkAndAwardBadges(user)

    return pointsToAward
}

/**
 * Track simulation run when student loads a circuit/network
 * Only tracks once per user per simulation
 */
export async function trackSimulationRun(userId: string, simulationId: string, simulationType: 'circuit' | 'network') {
    const user = await UserModel.findById(userId)
    if (!user || user.role !== 'student') {
        return // Only track for students
    }

    // Check if already completed this simulation
    const alreadyCompleted = user.completedSimulations?.some(
        sim => sim.toString() === simulationId
    )
    
    if (alreadyCompleted) {
        return // Already tracked
    }

    // Find the lesson that contains this circuit/network
    const lessonField = simulationType === 'circuit' ? 'circuitId' : 'networkId'
    const course = await CourseModel.findOne({
        [`modules.lessons.${lessonField}`]: simulationId
    })

    if (!course || !course.gamificationSettings) {
        return // No associated course or no gamification settings
    }

    // Mark as completed
    if (!user.completedSimulations) {
        user.completedSimulations = [] as any
    }
    user.completedSimulations.push(simulationId as any)

    // Award points
    await awardPointsForSimulation(user, course)
}
