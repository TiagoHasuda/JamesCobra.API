import { WebSocketGateway, OnGatewayConnection, OnGatewayDisconnect, SubscribeMessage, MessageBody, ConnectedSocket, WebSocketServer } from '@nestjs/websockets'
import { Server, Socket } from 'socket.io'
import { GameService } from 'src/services/game.service'

@WebSocketGateway()
export class GameGateway implements OnGatewayConnection, OnGatewayDisconnect {
    constructor(
        private readonly gameService: GameService,
    ) { }

    @WebSocketServer()
    server: Server

    handleConnection(client: Socket) {
        console.log('Client connected: ', client.id)
    }

    handleDisconnect(client: Socket) {
        const roomId = this.gameService.removeUser(client.id, this.server)
        if (roomId !== 0) client.leave(roomId.toString())
        console.log('Client disconnected: ', client.id)
    }

    @SubscribeMessage('newLogin')
    handleNewLogin(
        @MessageBody() data: string,
        @ConnectedSocket() client: Socket,
    ) {
        const res = this.gameService.newUser({
            id: client.id,
            nickname: data,
        })
        client.emit('newLogin', res ? 'true' : 'false')
    }

    @SubscribeMessage('removeLogin')
    handleRemoveLogin(
        @MessageBody() data: string,
        @ConnectedSocket() client: Socket,
    ) {
        const roomId = this.gameService.removeUser(client.id, this.server)
        if (roomId !== 0) client.leave(roomId.toString())
    }

    @SubscribeMessage('getSeparateRooms')
    handleGetSeparateRooms(
        @MessageBody() data: string,
        @ConnectedSocket() client: Socket,
    ) {
        client.emit('getSeparateRooms', JSON.stringify(this.gameService.getSeparateRooms()))
    }

    @SubscribeMessage('getSplitRooms')
    handleGetSplitRooms(
        @MessageBody() data: string,
        @ConnectedSocket() client: Socket,
    ) {
        client.emit('getSplitRooms', JSON.stringify(this.gameService.getSplitRooms()))
    }

    @SubscribeMessage('newRoom')
    handleNewRoom(
        @MessageBody() data: string,
        @ConnectedSocket() client: Socket,
    ) {
        const roomData = JSON.parse(data)
        const newRoom = this.gameService.newRoom(roomData.name, roomData.type, client.id, this.server)
        if (!!newRoom) {
            client.join(newRoom.id.toString())
            client.emit('joinRoom', JSON.stringify(newRoom))
        }
    }

    @SubscribeMessage('joinRoom')
    handleJoinRoom(
        @MessageBody() data: string,
        @ConnectedSocket() client: Socket,
    ) {
        const room = this.gameService.joinRoom(client.id, parseInt(data), this.server)
        if (!!room) {
            client.join(room.id.toString())
            client.emit('joinRoom', JSON.stringify(room))
        }
    }

    @SubscribeMessage('leaveRoom')
    handleLeaveRoom(
        @MessageBody() data: string,
        @ConnectedSocket() client: Socket,
    ) {
        const roomId = this.gameService.leaveRoom(client.id, this.server)
        if (!!roomId) {
            client.leave(roomId.toString())
            client.emit('leaveRoom', 'true')
        }
    }

    @SubscribeMessage('setReady')
    handleSetReady(
        @MessageBody() data: string,
        @ConnectedSocket() client: Socket,
    ) {
        this.gameService.setReady(client.id, this.server)
    }

    @SubscribeMessage('moveCobra')
    handleMoveCobra(
        @MessageBody() data: any,
        @ConnectedSocket() client: Socket,
    ) {
        this.gameService.moveCobra(client.id, data, this.server)
    }

    @SubscribeMessage('pauseGame')
    handlePauseGame(
        @MessageBody() data: string,
        @ConnectedSocket() client: Socket,
    ) {
        this.gameService.pauseGame(client.id, this.server)
    }

    @SubscribeMessage('unpauseGame')
    handleUnpauseGame(
        @MessageBody() data: string,
        @ConnectedSocket() client: Socket,
    ) {
        this.gameService.unpauseGame(client.id, this.server)
    }
}
