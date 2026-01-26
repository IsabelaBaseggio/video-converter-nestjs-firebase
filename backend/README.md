### Security


- Backend validates video ownership on every request
- Firestore rules restrict access by `userId`
- Storage rules prevent cross-user file access
- Firebase Admin SDK is used server-side


### Manual Tests

- Unauthorized access returns 401
- Cross-user access returns 403
- Download before conversion returns 400