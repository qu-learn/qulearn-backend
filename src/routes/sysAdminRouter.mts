import { Router } from "express";
import { IAddCourseAdministratorRequest, IAddCourseAdministratorResponse, IGetCourseAdministratorsResponse, mockHandler, Req, Res, userToResponse } from "../types.mts";
import { SysAdminOnly } from "./authRouter.mts";
import bcrypt from 'bcrypt'
import { UserModel } from "../db.mts";

const sysAdminRouter = Router();

sysAdminRouter.get("/course-admins", SysAdminOnly, async (req: Req<void>, res: Res<IGetCourseAdministratorsResponse>) => {
    const courseAdmins = await UserModel.find({ role: 'course-administrator' })
    res.json({
        cAdmins: courseAdmins.map(userToResponse),
    })
})

sysAdminRouter.post("/course-admins", SysAdminOnly, async (req: Req<IAddCourseAdministratorRequest>, res: Res<IAddCourseAdministratorResponse>) => {
    const data = req.body;
    // Validation
    if (!data.fullName || typeof data.fullName !== 'string' || !data.fullName.trim()) {
        return res.status(400).json({ error: 'Full Name is required.' } as any);
    }
    if (!data.email || typeof data.email !== 'string' || !/^\S+@\S+\.\S+$/.test(data.email)) {
        return res.status(400).json({ error: 'Valid email is required.' } as any);
    }
    if (data.contactNumber && !/^\d{10,15}$/.test(data.contactNumber)) {
        return res.status(400).json({ error: 'Contact Number should be 10-15 digits.' } as any);
    }
    if (data.nationalId && data.nationalId.length < 5) {
        return res.status(400).json({ error: 'National ID is too short.' } as any);
    }
    if (data.residentialAddress && data.residentialAddress.length < 5) {
        return res.status(400).json({ error: 'Address is too short.' } as any);
    }
    if (!data.gender || !['male', 'female', 'other'].includes(data.gender)) {
        return res.status(400).json({ error: 'Gender is required.' } as any);
    }
    if (!data.password || typeof data.password !== 'string' || data.password.length < 6) {
        return res.status(400).json({ error: 'Password is required and must be at least 6 characters.' } as any);
    }
    const hash = await bcrypt.hash(data.password, 10)
    const user = await UserModel.create({
        fullName: data.fullName,
        email: data.email,
        passwordHash: hash,
        contactNumber: data.contactNumber,
        nationalId: data.nationalId,
        residentialAddress: data.residentialAddress,
        gender: data.gender,
        role: 'course-administrator',
    })
    res.json({
        cAdmin: userToResponse(user),
    })
})

sysAdminRouter.use(mockHandler)

export { sysAdminRouter };