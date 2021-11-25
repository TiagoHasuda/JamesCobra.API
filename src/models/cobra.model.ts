import { Coordinate } from "./coordinate.model"

export type Direction = 'up' | 'down' | 'left' | 'right'

export interface Cobra {
    head: Coordinate
    body: Coordinate[]
    facing: Direction
}
