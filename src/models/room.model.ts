import { Cobra } from "./cobra.model"
import { Coordinate } from "./coordinate.model"
import { User } from "./user.model"

export type RoomType = 'separate' | 'split'

export interface Room {
    id: number
    name: string
    type: RoomType
    started: boolean
    paused: boolean
    points: number
    userOne: User & { ready: boolean }
    userTwo?: User & { ready: boolean }
    turn: 'one' | 'two'
    cobra: Cobra
    food: Coordinate
    delay: number
    interval?: NodeJS.Timeout
}
