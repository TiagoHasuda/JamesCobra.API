import { Injectable, NotFoundException } from "@nestjs/common"
import { Server } from "socket.io"
import { Direction } from "src/models/cobra.model"
import { Coordinate } from "src/models/coordinate.model"
import { EventsResponse } from "src/models/events.model"
import { Room, RoomType } from "src/models/room.model"
import { User } from "src/models/user.model"

export interface ServerCallbackProps {
    event: EventsResponse
    group?: string
    data?: any
    server: Server
}

export type ServerCallback = ({ }: ServerCallbackProps) => void

@Injectable()
export class GameService {
    private users: User[] = []
    private rooms: Room[] = []

    private callback({
        event,
        group,
        data,
        server,
    }: ServerCallbackProps) {
        if (typeof data === 'object' && !Array.isArray(data)) {
            const newData: any = {}
            Object.keys(data).forEach(key => {
                if (key !== 'interval')
                    newData[key] = data[key]
            })
            data = JSON.stringify(newData)
        } else if (typeof data !== 'string')
            data = JSON.stringify(data)
        if (!!group)
            server.to(group).emit(event, data)
        else
            server.emit(event, data)
    }

    private randomizeFood(head: Coordinate, body: Coordinate[]): Coordinate {
        let x = 0
        let y = 0
        let exists = true
        while (exists) {
            x = Math.floor(Math.random() * 15)
            y = Math.floor(Math.random() * 15)
            if (head.x === x && head.y === y) continue
            let existsInBody = false
            body.forEach(coord => {
                if (coord.x === x && coord.y === y) existsInBody = true
            })
            if (existsInBody) continue
            exists = false
        }
        return {
            x,
            y,
        }
    }

    private endGame(win: boolean, room: Room, server: Server) {
        room.started = false
        room.userOne.ready = false
        room.userTwo.ready = false
        this.callback({
            event: win ? 'winGame' : 'loseGame',
            server,
            data: room,
            group: room.id.toString(),
        })
    }

    private move(direction: Direction, room: Room, server: Server) {
        const lastHeadCoord = { ...room.cobra.head }
        switch (direction) {
            case 'right':
                room.cobra.head = {
                    x: room.cobra.head.x,
                    y: room.cobra.head.y + 1,
                }
                break
            case 'left':
                room.cobra.head = {
                    x: room.cobra.head.x,
                    y: room.cobra.head.y - 1,
                }
                break
            case 'up':
                room.cobra.head = {
                    x: room.cobra.head.x - 1,
                    y: room.cobra.head.y,
                }
                break
            case 'down':
                room.cobra.head = {
                    x: room.cobra.head.x + 1,
                    y: room.cobra.head.y,
                }
                break
        }
        if (room.cobra.head.x < 0
            || room.cobra.head.y < 0
            || room.cobra.head.x > 14
            || room.cobra.head.y > 14) {
            room.started = false
            this.endGame(false, room, server)
            return
        }
        if (room.cobra.head.x === room.food.x
            && room.cobra.head.y === room.food.y) {
            room.cobra.body.unshift(lastHeadCoord)
            room.points++
            room.delay -= 3
            if (room.cobra.body.length === (15 * 15) - 1) {
                room.started = false
                this.endGame(true, room, server)
                return
            }
            room.food = this.randomizeFood(room.cobra.head, room.cobra.body)
        } else {
            const ghostBlock = {
                last: { ...lastHeadCoord },
                curr: { ...lastHeadCoord },
            }
            for (let i = 0; i < room.cobra.body.length; i++) {
                ghostBlock.curr.x = room.cobra.body[i].x
                ghostBlock.curr.y = room.cobra.body[i].y
                switch (room.cobra.facing) {
                    case 'right':
                        room.cobra.body[i] = {
                            x: ghostBlock.last.x,
                            y: ghostBlock.last.y,
                        }
                        break
                    case 'left':
                        room.cobra.body[i] = {
                            x: ghostBlock.last.x,
                            y: ghostBlock.last.y,
                        }
                        break
                    case 'up':
                        room.cobra.body[i] = {
                            x: ghostBlock.last.x,
                            y: ghostBlock.last.y,
                        }
                        break
                    case 'down':
                        room.cobra.body[i] = {
                            x: ghostBlock.last.x,
                            y: ghostBlock.last.y,
                        }
                        break
                }
                ghostBlock.last.x = ghostBlock.curr.x
                ghostBlock.last.y = ghostBlock.curr.y
            }
        }
        for (let i = 0; i < room.cobra.body.length; i++) {
            if (room.cobra.body[i].x === room.cobra.head.x
                && room.cobra.body[i].y === room.cobra.head.y) {
                room.started = false
                this.endGame(false, room, server)
                return
            }
        }
    }

    private async gameLoop(room: Room, server: Server) {
        if (!room.paused && room.started) {
            this.move(room.cobra.facing, room, server)
        } else {
            return
        }
        this.callback({
            event: 'gameUpdate',
            server,
            data: room,
            group: room.id.toString(),
        })
        room.interval = setTimeout(() => this.gameLoop(room, server), room.delay)
    }

    private startGame(room: Room, server: Server) {
        room.cobra = {
            body: [],
            facing: 'right',
            head: {
                x: 0,
                y: 0,
            },
        }
        room.food = this.randomizeFood(room.cobra.head, room.cobra.body)
        room.paused = false
        room.points = 0
        room.started = true
        room.turn = 'one'
        room.delay = 800
        room.interval = setTimeout(() => this.gameLoop(room, server), room.delay)
    }

    getSeparateRooms(): Room[] {
        return this.rooms.filter(room => room.type === 'separate')
    }

    getSplitRooms(): Room[] {
        return this.rooms.filter(room => room.type === 'split')
    }

    newUser(newUser: User): boolean {
        const existing = this.users.find(user => user.nickname === newUser.nickname)
        if (!!existing) return false
        this.users.push(newUser)
        return true
    }

    removeUser(userId: string, server: Server): number {
        const existing = this.users.find(user => user.id === userId)
        if (!existing) return 0
        this.users = this.users.filter(user => user.id !== userId)
        const leadingRoom = this.rooms.find(room => room.userOne.id === userId)
        if (!!leadingRoom) {
            if (!leadingRoom.userTwo) {
                this.rooms = this.rooms.filter(room => room.id !== leadingRoom.id)
                this.callback({
                    event: leadingRoom.type === 'separate' ? 'getSeparateRooms' : 'getSplitRooms',
                    data: this.rooms.filter(room => room.type === leadingRoom.type),
                    server,
                })
            } else {
                leadingRoom.userOne = { ...leadingRoom.userTwo }
                leadingRoom.userTwo = undefined
                leadingRoom.paused = true
                this.callback({
                    event: 'gameUpdate',
                    data: leadingRoom,
                    group: leadingRoom.id.toString(),
                    server,
                })
            }
            return leadingRoom.id
        }
        const inRoom = this.rooms.find(room => room.userTwo?.id === userId)
        if (!!inRoom) {
            inRoom.userTwo = undefined
            inRoom.paused = true
            this.callback({
                event: 'gameUpdate',
                data: inRoom,
                group: inRoom.id.toString(),
                server,
            })
            return inRoom.id
        }
        return 0
    }

    newRoom(name: string, type: RoomType, userId: string, server: Server): Room {
        const user = this.users.find(user => user.id === userId)
        if (!user) throw new NotFoundException('User not found')
        const alreadyInRoom = this.rooms.find(room => room.userOne.id === userId || room.userTwo?.id === userId)
        if (!!alreadyInRoom) {
            console.log('User already in a room')
            return
        }
        const existingIds = this.rooms.map(room => room.id)
        let id = 1
        while (existingIds.includes(id)) id++
        const newRoom: Room = {
            id,
            name,
            type,
            started: false,
            paused: false,
            points: 0,
            userOne: {
                ...user,
                ready: false,
            },
            userTwo: null,
            turn: 'one',
            cobra: {
                head: {
                    x: 0,
                    y: 0,
                },
                body: [],
                facing: 'right',
            },
            food: {
                x: 0,
                y: 0,
            },
            delay: 1000,
        }
        this.rooms.push(newRoom)
        this.callback({
            event: newRoom.type === 'separate' ? 'getSeparateRooms' : 'getSplitRooms',
            data: this.rooms.filter(room => room.type === newRoom.type),
            server,
        })
        return newRoom
    }

    joinRoom(userId: string, roomId: number, server: Server): Room {
        const existing = this.users.find(user => user.id === userId)
        if (!existing) throw new NotFoundException('User not found')
        const existingRoom = this.rooms.find(room => room.id === roomId)
        if (!existingRoom) throw new NotFoundException('Room not found')
        if (!!existingRoom.userTwo) {
            console.log('Room is full')
            return
        }
        const alreadyInRoom = this.rooms.find(room => room.userOne.id === userId || room.userTwo?.id === userId)
        if (!!alreadyInRoom) {
            console.log('User already in a room')
            return
        }
        existingRoom.userTwo = {
            ...existing,
            ready: false,
        }
        this.callback({
            event: 'gameUpdate',
            data: existingRoom,
            group: existingRoom.id.toString(),
            server,
        })
        return existingRoom
    }

    leaveRoom(userId: string, server: Server): number {
        const existing = this.users.find(user => user.id === userId)
        if (!existing) throw new NotFoundException('User not found')
        const existingRoom = this.rooms.find(room => room.userOne.id === userId || room.userTwo?.id === userId)
        if (!existingRoom) throw new NotFoundException('Room not found')
        if (!existingRoom.userTwo) {
            this.rooms = this.rooms.filter(room => room.id !== existingRoom.id)
            this.callback({
                event: existingRoom.type === 'separate' ? 'getSeparateRooms' : 'getSplitRooms',
                data: this.rooms.filter(room => room.type === existingRoom.type),
                server,
            })
        } else {
            if (existingRoom.userOne.id === userId) {
                existingRoom.userOne = { ...existingRoom.userTwo }
                existingRoom.userTwo = undefined
                existingRoom.paused = true
                this.callback({
                    event: 'gameUpdate',
                    data: existingRoom,
                    group: existingRoom.id.toString(),
                    server,
                })
            } else {
                existingRoom.userTwo = undefined
                existingRoom.paused = true
                this.callback({
                    event: 'gameUpdate',
                    data: existingRoom,
                    group: existingRoom.id.toString(),
                    server,
                })
            }
        }
        return existingRoom.id
    }

    setReady(userId: string, server: Server) {
        const existingRoom = this.rooms.find(room => room.userOne.id === userId || room.userTwo?.id === userId)
        if (!existingRoom) throw new NotFoundException('Room not found')
        if (existingRoom.userTwo?.id === userId) {
            existingRoom.userTwo.ready = true
            if (existingRoom.userOne.ready) {
                this.startGame(existingRoom, server)
            }
        } else {
            existingRoom.userOne.ready = true
            if (existingRoom.userTwo?.ready) {
                this.startGame(existingRoom, server)
            }
        }
        this.callback({
            event: 'gameUpdate',
            data: existingRoom,
            server,
        })
    }

    moveCobra(userId: string, direction: Direction, server: Server) {
        const existingRoom = this.rooms.find(room => room.userOne.id === userId || room.userTwo?.id === userId)
        if (!existingRoom) throw new NotFoundException('Room not found')
        switch (direction) {
            case 'right':
                if (existingRoom.cobra.facing === 'left') return
                break
            case 'left':
                if (existingRoom.cobra.facing === 'right') return
                break
            case 'up':
                if (existingRoom.cobra.facing === 'down') return
                break
            case 'down':
                if (existingRoom.cobra.facing === 'up') return
                break
        }
        if (existingRoom.userOne.id === userId) {
            if ((existingRoom.type === 'separate' && existingRoom.turn === 'two')
                || (existingRoom.type === 'split' && ['left', 'right'].includes(direction))) return
            existingRoom.cobra.facing = direction
            existingRoom.turn = 'two'
            clearInterval(existingRoom.interval)
            this.move(direction, existingRoom, server)
        } else {
            if ((existingRoom.type === 'separate' && existingRoom.turn === 'one')
                || (existingRoom.type === 'split' && ['up', 'down'].includes(direction))) return
            existingRoom.cobra.facing = direction
            existingRoom.turn = 'one'
            clearInterval(existingRoom.interval)
            this.move(direction, existingRoom, server)
        }
        existingRoom.interval = setTimeout(() => this.gameLoop(existingRoom, server), existingRoom.delay)
        this.callback({
            event: 'gameUpdate',
            server,
            data: existingRoom,
            group: existingRoom.id.toString(),
        })
    }

    pauseGame(userId: string, server: Server) {
        const existingRoom = this.rooms.find(room => room.userOne.id === userId || room.userTwo?.id === userId)
        if (!existingRoom) throw new NotFoundException('Room not found')
        existingRoom.paused = true
        if (!!existingRoom.interval)
            clearInterval(existingRoom.interval)
        this.callback({
            event: 'gameUpdate',
            server,
            data: existingRoom,
            group: existingRoom.id.toString(),
        })
    }

    unpauseGame(userId: string, server: Server) {
        const existingRoom = this.rooms.find(room => room.userOne.id === userId || room.userTwo?.id === userId)
        if (!existingRoom) throw new NotFoundException('Room not found')
        if (!existingRoom.userTwo) {
            console.log('Cannot unpause game with only one player')
            return
        }
        existingRoom.paused = false
        existingRoom.interval = setTimeout(() => this.gameLoop(existingRoom, server), existingRoom.delay)
        this.callback({
            event: 'gameUpdate',
            server,
            data: existingRoom,
            group: existingRoom.id.toString(),
        })
    }
}
