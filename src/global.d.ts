
import type { User as UserInstance } from "./db.mts"

declare global {
    namespace Express {
        interface User extends UserInstance { }
    }
}
