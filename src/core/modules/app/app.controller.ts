import { Controller, Get, Res } from '@nestjs/common';

@Controller()
export class AppController {
  @Get('app/health')
  public getAppHealth() {
    return { message: 'ok' };
  }
}
