import { Module } from '@nestjs/common'
import { GameGateway } from './gateways/game.gateway'
import { GameService } from './services/game.service'

@Module({
  imports: [],
  controllers: [],
  providers: [GameService, GameGateway],
})
export class AppModule { }
