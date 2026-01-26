// src/app.controller.ts
import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { FirebaseAuthGuard } from './auth/firebase-auth.guard';
import { FirebaseUser } from './auth/user.interface';

@Controller()
export class AppController {
  @UseGuards(FirebaseAuthGuard)
  @Get('me')
  me(@Req() req: Request & { user: FirebaseUser }) {
    return { user: req.user };
  }
}