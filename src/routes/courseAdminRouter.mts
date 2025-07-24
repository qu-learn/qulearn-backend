import { Router } from "express";
import { IAddCourseAdministratorRequest, IAddCourseAdministratorResponse, IAddEducatorRequest, IAddEducatorResponse, IGetCourseAdministratorsResponse, IGetEducatorsResponse, mockHandler, Req, Res, userToResponse } from "../types.mts";
import { CourseAdminOnly, SysAdminOnly } from "./authRouter.mts";
import bcrypt from 'bcrypt'
import { UserModel } from "../db.mts";

const courseAdminRouter = Router();

courseAdminRouter.get("/educators", CourseAdminOnly, async (req: Req<void>, res: Res<IGetEducatorsResponse>) => {
    const courseAdmins = await UserModel.find({ role: 'educator' })
    res.json({
        educators: courseAdmins.map(userToResponse),
    })
})

courseAdminRouter.post("/educators", CourseAdminOnly, async (req: Req<IAddEducatorRequest>, res: Res<IAddEducatorResponse>) => {
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
        role: 'educator',
    })
    res.json({
        educator: userToResponse(user),
    })
})

courseAdminRouter.use(mockHandler)

export { courseAdminRouter };