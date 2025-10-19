import { Router } from 'express'
import { NetworkModel } from '../db.mts'
import { AuthenticatedOnly } from './authRouter.mts'
import { Req, Res, mockHandler, APIError, ICreateNetworkRequest, IUpdateNetworkRequest } from '../types.mts'

const networksRouter = Router()

// GET /api/v1/networks - Get all networks (visible to all logged-in users)
networksRouter.get('/', AuthenticatedOnly, async (req: Req<void>, res: Res) => {
    const networks = await NetworkModel.find({})
        .sort({ updatedAt: -1 })
        .lean()
    
    res.json({
        networks: networks.map(n => ({
            id: n._id.toString(),
            userId: n.userId!.toString(),
            name: n.name,
            configuration: n.configuration,
            createdAt: n.createdAt,
            updatedAt: n.updatedAt,
        }))
    })
})

// POST /api/v1/networks - Create a new network
networksRouter.post('/', AuthenticatedOnly, async (req: Req<ICreateNetworkRequest>, res: Res) => {
    const userId = req.user!.id
    
    const network = new NetworkModel({
        userId,
        name: req.body.name,
        configuration: req.body.configuration,
    })
    
    await network.save()
    
    res.status(201).json({
        network: {
            id: network._id.toString(),
            name: network.name,
            configuration: network.configuration,
            createdAt: network.createdAt,
            updatedAt: network.updatedAt,
        }
    })
})

// GET /api/v1/networks/:id - Get a specific network (visible to all logged-in users)
networksRouter.get('/:id', AuthenticatedOnly, async (req: Req<void>, res: Res) => {
    const networkId = req.params.id
    
    const network = await NetworkModel.findById(networkId).lean()
    
    if (!network) {
        throw new APIError(404, 'Network not found')
    }
    
    res.json({
        network: {
            id: network._id.toString(),
            userId: network.userId?.toString(),
            name: network.name,
            configuration: network.configuration,
            createdAt: network.createdAt,
            updatedAt: network.updatedAt,
        }
    })
})

// PATCH /api/v1/networks/:id - Update a network
networksRouter.patch('/:id', AuthenticatedOnly, async (req: Req<IUpdateNetworkRequest>, res: Res) => {
    const userId = req.user!.id
    const networkId = req.params.id
    
    const network = await NetworkModel.findOneAndUpdate(
        { _id: networkId, userId },
        {
            name: req.body.name,
            configuration: req.body.configuration,
            updatedAt: new Date(),
        },
        { new: true }
    ).lean()
    
    if (!network) {
        throw new APIError(404, 'Network not found')
    }
    
    res.json({
        network: {
            id: network._id.toString(),
            name: network.name,
            configuration: network.configuration,
            createdAt: network.createdAt,
            updatedAt: network.updatedAt,
        }
    })
})

// DELETE /api/v1/networks/:id - Delete a network
networksRouter.delete('/:id', AuthenticatedOnly, async (req: Req<void>, res: Res) => {
    const userId = req.user!.id
    const networkId = req.params.id
    
    const result = await NetworkModel.deleteOne({ _id: networkId, userId })
    
    if (result.deletedCount === 0) {
        throw new APIError(404, 'Network not found')
    }
    
    res.status(204).send()
})

networksRouter.use(mockHandler)

export { networksRouter }
