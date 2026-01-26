// src/auth/firebase-auth.guard.ts
import {
    CanActivate,
    ExecutionContext,
    Injectable,
    UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { FirebaseService } from '../firebase/firebase.service';
import { FirebaseUser } from './user.interface';

// Estende o Request para incluir user
interface RequestWithUser extends Request {
    user?: FirebaseUser;
}

@Injectable()
export class FirebaseAuthGuard implements CanActivate {
    constructor(private readonly firebaseService: FirebaseService) { }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest<RequestWithUser>();
        const authHeader = request.headers.authorization;

        if (!authHeader) {
            throw new UnauthorizedException('Missing Authorization header');
        }

        const [type, token] = authHeader.split(' ');

        if (type !== 'Bearer' || !token) {
            throw new UnauthorizedException('Invalid Authorization format');
        }

        try {
            const decodedToken = await this.firebaseService.verifyIdToken(token);

            request.user = {
                uid: decodedToken.uid,
                email: decodedToken.email,
            };

            return true;
        } catch {
            throw new UnauthorizedException('Invalid or expired token');
        }
    }
}