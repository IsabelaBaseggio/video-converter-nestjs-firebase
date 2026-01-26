// src/auth/user.decorator.ts
import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { FirebaseUser } from './user.interface';


export const User = createParamDecorator(
    (_: unknown, ctx: ExecutionContext): FirebaseUser => {
        const request = ctx.switchToHttp().getRequest();
        return request.user;
    },
);