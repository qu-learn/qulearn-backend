import { Router } from 'express'
import { CircuitModel } from '../db.mts'
import { AuthenticatedOnly } from './authRouter.mts'
import { Req, Res, mockHandler, APIError, ICreateCircuitRequest, IUpdateCircuitRequest } from '../types.mts'

const circuitsRouter = Router()

// POST /api/v1/circuits - Create a new circuit
circuitsRouter.post('/', AuthenticatedOnly, async (req: Req<ICreateCircuitRequest>, res: Res) => {
    const userId = req.user!.id
    const circuit = new CircuitModel({
        userId,
        name: req.body.name,
        configuration: req.body.configuration,
    })

    await circuit.save()

    res.status(201).json({
        circuit: {
            id: circuit._id.toString(),
            name: circuit.name,
            configuration: circuit.configuration,
            createdAt: circuit.createdAt,
            updatedAt: circuit.updatedAt,
        }
    })
})

// GET /api/v1/circuits/:id - Get a specific circuit (visible to all logged-in users)
circuitsRouter.get('/:id', AuthenticatedOnly, async (req: Req<void>, res: Res) => {
    const circuitId = req.params.id

    const circuit = await CircuitModel.findById(circuitId).lean()

    if (!circuit) {
        throw new APIError(404, 'Circuit not found')
    }

    res.json({
        circuit: {
            id: circuit._id.toString(),
            userId: circuit.userId?.toString(),
            name: circuit.name,
            configuration: circuit.configuration,
            createdAt: circuit.createdAt,
            updatedAt: circuit.updatedAt,
        }
    })
})

// PUT /api/v1/circuits/:id - Update a circuit
circuitsRouter.put('/:id', AuthenticatedOnly, async (req: Req<IUpdateCircuitRequest>, res: Res) => {
    const userId = req.user!.id
    const circuitId = req.params.id

    const circuit = await CircuitModel.findOneAndUpdate(
        { _id: circuitId, userId },
        {
            name: req.body.name,
            configuration: req.body.configuration,
            updatedAt: new Date(),
        },
        { new: true }
    ).lean()

    if (!circuit) {
        throw new APIError(404, 'Circuit not found')
    }

    res.json({
        circuit: {
            id: circuit._id.toString(),
            name: circuit.name,
            configuration: circuit.configuration,
            createdAt: circuit.createdAt,
            updatedAt: circuit.updatedAt,
        }
    })
})

// DELETE /api/v1/circuits/:id - Delete a circuit
circuitsRouter.delete('/:id', AuthenticatedOnly, async (req: Req<void>, res: Res) => {
    const userId = req.user!.id
    const circuitId = req.params.id

    const result = await CircuitModel.deleteOne({ _id: circuitId, userId })

    if (result.deletedCount === 0) {
        throw new APIError(404, 'Circuit not found')
    }

    res.status(204).send()
})

circuitsRouter.use(mockHandler)

export { circuitsRouter }
