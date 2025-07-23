import { Router } from "express";
import { IAddCourseAdministratorRequest, IAddCourseAdministratorResponse, Req, Res } from "../types.mts";

const sysAdminRouter = Router();

sysAdminRouter.post("/course-admins", async (req: Req<IAddCourseAdministratorRequest>, res: Res<IAddCourseAdministratorResponse>) => {
    console.log("Adding course administrator:", req.body);
    return;
})

export { sysAdminRouter };