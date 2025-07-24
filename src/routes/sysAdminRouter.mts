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
    //console.log("Adding course administrator:", req.body);
    const data = req.body;
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