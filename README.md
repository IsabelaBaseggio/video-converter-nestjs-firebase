# Video Converter API

Backend de conversão de vídeos desenvolvido em **NestJS + Firebase + BullMQ**, com um **frontend mínimo em React** apenas para testar o fluxo completo (login, upload, conversão e download).

> ⚠️ O foco do projeto é **backend**. O frontend existe somente como client de apoio.

---

## 📌 Visão Geral

A aplicação permite que usuários autenticados:

- façam upload de um vídeo
- solicitem a conversão para um preset fixo (MP4 720p)
- acompanhem o status do processamento via polling
- façam download do arquivo convertido

Todo o isolamento por usuário é garantido via **Firebase Authentication + validação de token no backend**.

---

## 🧱 Stack

### Backend

- NestJS + TypeScript
- Firebase Authentication (validação de ID Token)
- Firestore (jobs e status)
- Firebase Storage (input/output)
- BullMQ (fila de jobs assíncrona)
- Redis (broker da fila)
- fluent-ffmpeg (wrapper Node.js para conversão de vídeo)
- Docker + Docker Compose

### Frontend (mínimo)

- React + Vite
- Firebase Auth (Anonymous Auth)

### Observabilidade

- Bull Board (UI para monitoramento das filas) — disponível em `http://localhost:3000/queues`

---

## 🔐 Autenticação e Segurança

- O frontend realiza login via **Firebase Anonymous Authentication**
- O ID Token é enviado em todas as requisições protegidas:

```
Authorization: Bearer <firebase_id_token>
```

- O backend valida o token via Firebase Admin SDK e associa os dados ao `uid` do usuário
- Cada usuário só pode acessar seus próprios vídeos/jobs
- Guard centralizado (`FirebaseAuthGuard`) protege todas as rotas autenticadas
- Decorator `@User()` injeta os dados do usuário autenticado nos controllers

---

## ⚙️ Configuração do Firebase

> ⚠️ Firebase Storage requer plano **Blaze (pay-as-you-go)** para uploads via backend (Admin SDK). O plano gratuito Spark não suporta essa operação.

### 1. Criar projeto no Firebase

1. Acesse [Firebase Console](https://console.firebase.google.com/).
2. Clique em **Adicionar projeto** e siga as instruções.
3. Habilite **Authentication**, **Firestore** e **Storage** no painel do projeto.
4. Faça upgrade para o plano **Blaze** em Configurações → Uso e faturamento.

### 2. Configurar Firebase Authentication

1. Vá em **Authentication > Métodos de Login**.
2. Habilite **Login Anônimo** (Anonymous Authentication).

### 3. Configurar Firestore

1. Vá em **Firestore Database** e crie um banco em modo produção.
2. Aplique as regras para isolamento por usuário:

```
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {
    match /videos/{videoId} {
      allow read, write: if request.auth != null
        && request.auth.uid == resource.data.userId;
    }
  }
}
```

### 4. Configurar Firebase Storage

1. Vá em **Storage** e configure um bucket padrão.
2. Aplique as regras para isolamento por usuário:

```
rules_version = '2';

service firebase.storage {
  match /b/{bucket}/o {
    match /videos/{userId}/{videoId}/{fileName} {
      allow read, write: if request.auth != null
        && request.auth.uid == userId;
    }
  }
}
```

### 5. Configurar variáveis de ambiente

Crie um arquivo `.env` na raiz da pasta `/backend`:

```bash
FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n
FIREBASE_STORAGE_BUCKET=
```

As variáveis `REDIS_HOST` e `REDIS_PORT` são injetadas automaticamente pelo Docker Compose e não precisam ser configuradas manualmente.

---

## 🎥 Fluxo de Vídeo / Job

```
1. Upload do vídeo         → status: UPLOADED
2. Requisição de conversão → job enfileirado no Redis via BullMQ → status: PROCESSING
3. Worker consome o job    → download do input, conversão via FFmpeg, upload do output
4. Finalização             → status: DONE ou FAILED (com retry automático)
```

O progresso da conversão é atualizado em tempo real na fila (visível no Bull Board).
O frontend faz polling a cada 3 segundos para verificar o status no Firestore.

---

## 🌐 Endpoints Principais

| Método | Endpoint                  | Descrição                        |
| ------ | ------------------------- | -------------------------------- |
| POST   | /api/videos               | Upload do vídeo                  |
| POST   | /api/videos/:id/convert   | Enfileira job de conversão       |
| GET    | /api/videos/:id           | Consulta status do vídeo         |
| GET    | /api/videos               | Lista vídeos do usuário          |
| GET    | /api/videos/:id/download  | Download do vídeo convertido     |
| GET    | /queues                   | Bull Board (UI das filas)        |

---

## 🖥️ Frontend (Client de Teste)

O frontend é **propositalmente simples** e serve apenas para testar o backend.

Funcionalidades:

- Login anônimo com Firebase Auth
- Upload de vídeo
- Solicitar conversão
- Polling de status
- Download do vídeo final

O frontend requer um arquivo `.env` em `/frontend`:

```bash
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
```

---

## 🐳 Como Rodar

Certifique-se de estar dentro da pasta `/backend` e de ter o arquivo `.env` configurado.

O Docker Compose sobe três serviços:
- **redis** — broker da fila BullMQ
- **backend** — API NestJS + worker de conversão
- **Bull Board** — acessível em `http://localhost:3000/queues`

```bash
cd backend
docker-compose up --build
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend disponível em `http://localhost:5173`.

---

## 🔥 Decisões Técnicas

### Fila assíncrona com BullMQ

A conversão de vídeo é processada de forma assíncrona via fila BullMQ com Redis como broker. Quando o usuário solicita a conversão, um job é enfileirado e o endpoint retorna imediatamente. Um `VideoProcessor` (worker NestJS) consome o job e executa o pipeline completo: download do input, conversão, upload do output e atualização do status no Firestore.

Vantagens em relação à conversão síncrona:
- O endpoint não bloqueia aguardando o FFmpeg
- Retry automático com backoff exponencial (3 tentativas, intervalo crescente)
- Progresso real da conversão visível no Bull Board
- Escalável: múltiplos workers podem consumir a mesma fila

### fluent-ffmpeg

A conversão utiliza `fluent-ffmpeg` como wrapper Node.js em vez de `child_process.exec`. Isso elimina o risco de command injection, oferece uma API tipada e permite capturar o progresso real da conversão via evento `progress`. O binário do FFmpeg continua instalado no container Docker.

### Progresso granular

O progresso do job é atualizado em três fases:
- 0–20%: download do input do Firebase Storage
- 20–90%: progresso real do FFmpeg (via `fluent-ffmpeg`)
- 90–100%: upload do output para o Firebase Storage

### Organização do NestJS

- `FirebaseModule`: abstrai acesso ao Firestore, Storage e Auth
- `FFmpegModule`: encapsula a lógica de conversão via fluent-ffmpeg
- `VideosModule`: upload, conversão, listagem e download
- `QueueModule`: configuração global do BullMQ
- `VideoProcessor`: worker que consome os jobs da fila
- `FirebaseAuthGuard`: guard centralizado para validação de token
- Decorator `@User()`: injeta dados do usuário autenticado nos controllers

### Segurança por usuário

- Backend valida token do Firebase em todas as requisições autenticadas
- Cada usuário só acessa seus próprios vídeos (validado no service e nas regras do Firebase)
- Regras do Firestore e Storage reforçam o isolamento por UID

### Docker e ambiente

- Backend e Redis sobem via Docker Compose com healthcheck no Redis
- FFmpeg instalado na imagem Docker (Node 18 slim)
- Variáveis de ambiente sensíveis injetadas via `.env` (nunca na imagem)
- DNS estático (Google 8.8.8.8) para evitar timeouts nas APIs do Firebase

---

## ⚠️ Limitações Conhecidas

- Preset único de conversão (MP4 720p)
- Frontend extremamente simples, sem preocupação com UX
- Download via query param `?token=` (limitação de browser para downloads diretos)
- Conversão não escalável horizontalmente sem ajuste no worker (uma instância por container)

---

## ✅ Conclusão

Projeto focado em arquitetura assíncrona com filas, isolamento por usuário, observabilidade e boas práticas de segurança no desenvolvimento backend com NestJS.