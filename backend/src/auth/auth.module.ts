// src/auth/auth.module.ts
import { Module } from '@nestjs/common';
import { FirebaseModule } from '../firebase/firebase.module';
import { FirebaseAuthGuard } from './firebase-auth.guard';

@Module({
    imports: [FirebaseModule],
    providers: [FirebaseAuthGuard],
    exports: [FirebaseAuthGuard],
})
export class AuthModule { }