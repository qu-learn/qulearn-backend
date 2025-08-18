import { Router } from "express";
import { IAddCourseAdministratorRequest, IAddCourseAdministratorResponse, IGetCourseAdministratorsResponse, mockHandler, Req, Res, userToResponse, APIError, IGetCourseAdministratorResponse, IUpdateCourseAdministratorResponse, IDeleteCourseAdministratorResponse } from "../types.mts";
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
        throw new APIError(400, 'Full Name is required.');
    }
    if (!data.email || typeof data.email !== 'string' || !/^\S+@\S+\.\S+$/.test(data.email)) {
        throw new APIError(400, 'Valid email is required.');
    }
    if (data.contactNumber && !/^\d{10,15}$/.test(data.contactNumber)) {
        throw new APIError(400, 'Contact Number should be 10-15 digits.');
    }
    if (data.nationalId && data.nationalId.length < 5) {
        throw new APIError(400, 'National ID is too short.');
    }
    if (data.residentialAddress && data.residentialAddress.length < 5) {
        throw new APIError(400, 'Address is too short.');
    }
    if (!data.gender || !['male', 'female', 'other'].includes(data.gender)) {
        throw new APIError(400, 'Gender is required.');
    }
    if (!data.password || typeof data.password !== 'string' || data.password.length < 6) {
        throw new APIError(400, 'Password is required and must be at least 6 characters.');
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

// New: get single course administrator
sysAdminRouter.get("/course-admins/:id", SysAdminOnly, async (req: Req<void, { id: string }>, res: Res<IGetCourseAdministratorResponse>) => {
	const { id } = req.params
	const user = await UserModel.findById(id)
	if (!user || user.role !== 'course-administrator') {
		throw new APIError(404, 'Course administrator not found.')
	}
	res.json({ cAdmin: userToResponse(user) })
})

// New: update course administrator
sysAdminRouter.patch("/course-admins/:id", SysAdminOnly, async (req: Req<IAddCourseAdministratorRequest, { id: string }>, res: Res<IUpdateCourseAdministratorResponse>) => {
	const { id } = req.params
	const data = req.body

	// Basic validation (only validate provided fields)
	if (data.fullName !== undefined && (typeof data.fullName !== 'string' || !data.fullName.trim())) {
		throw new APIError(400, 'Full Name is required.')
	}
	if (data.email !== undefined) {
		if (typeof data.email !== 'string' || !/^\S+@\S+\.\S+$/.test(data.email)) {
			throw new APIError(400, 'Valid email is required.')
		}
		// Ensure email not used by another user
		const existing = await UserModel.findOne({ email: data.email })
		if (existing && existing.id !== id) {
			throw new APIError(400, 'Email already used.')
		}
	}
	if (data.contactNumber !== undefined && data.contactNumber && !/^\d{10,15}$/.test(data.contactNumber)) {
		throw new APIError(400, 'Contact Number should be 10-15 digits.')
	}
	if (data.nationalId !== undefined && data.nationalId && data.nationalId.length < 5) {
		throw new APIError(400, 'National ID is too short.')
	}
	if (data.residentialAddress !== undefined && data.residentialAddress && data.residentialAddress.length < 5) {
		throw new APIError(400, 'Address is too short.')
	}
	if (data.gender !== undefined && !['male', 'female', 'other'].includes(data.gender)) {
		throw new APIError(400, 'Gender is required.')
	}
	if (data.password !== undefined && (typeof data.password !== 'string' || data.password.length < 6)) {
		throw new APIError(400, 'Password must be at least 6 characters.')
	}
	// New: validate accountStatus if provided
	if (data.accountStatus !== undefined && !['active', 'suspended', 'deactivated', 'deleted'].includes(data.accountStatus as string)) {
		throw new APIError(400, 'Invalid account status.')
	}

	const updatePayload: any = {}
	if (data.fullName !== undefined) updatePayload.fullName = data.fullName
	if (data.email !== undefined) updatePayload.email = data.email
	if (data.contactNumber !== undefined) updatePayload.contactNumber = data.contactNumber
	if (data.nationalId !== undefined) updatePayload.nationalId = data.nationalId
	if (data.residentialAddress !== undefined) updatePayload.residentialAddress = data.residentialAddress
	if (data.gender !== undefined) updatePayload.gender = data.gender
	if (data.password !== undefined) {
		updatePayload.passwordHash = await bcrypt.hash(data.password as string, 10)
	}
	// New: include accountStatus -> map to user.status
	if (data.accountStatus !== undefined) updatePayload.status = data.accountStatus

	const user = await UserModel.findById(id)
	if (!user || user.role !== 'course-administrator') {
		throw new APIError(404, 'Course administrator not found.')
	}

	Object.assign(user, updatePayload)
	await user.save()

	res.json({ cAdmin: userToResponse(user) })
})

// New: delete course administrator
sysAdminRouter.delete("/course-admins/:id", SysAdminOnly, async (req: Req<void, { id: string }>, res: Res<IDeleteCourseAdministratorResponse>) => {
	const { id } = req.params
	const user = await UserModel.findById(id)
	if (!user || user.role !== 'course-administrator') {
		throw new APIError(404, 'Course administrator not found.')
	}
	await UserModel.findByIdAndDelete(id)
	// respond with success boolean per frontend type
	res.json({ success: true })
})

export { sysAdminRouter };