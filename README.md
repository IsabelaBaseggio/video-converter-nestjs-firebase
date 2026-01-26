# Video Converter API

Backend de conversão de vídeos desenvolvido em **NestJS + Firebase**, com um **frontend mínimo em React** apenas para testar o fluxo completo (login, upload, conversão e download).

> ⚠️ O foco do projeto é **backend**. O frontend **não é avaliado** e existe somente como client de apoio.

---

## 📌 Visão Geral

A aplicação permite que usuários autenticados:

- façam upload de um vídeo
- solicitem a conversão para um preset fixo (MP4 720p)
- acompanhem o status do processamento
- façam download do arquivo convertido

Todo o isolamento por usuário é garantido via **Firebase Authentication + validação de token no backend**.

---

## 🧱 Stack

### Backend

- NestJS + TypeScript
- Firebase Authentication (validação de ID Token)
- Firestore (jobs e status)
- Firebase Storage (input/output)
- FFmpeg (conversão de vídeo)
- Docker

### Frontend (mínimo)

- React + Vite
- Firebase Auth (Anonymous Auth)

---

## 🔐 Autenticação e Segurança

- O frontend realiza login via **Firebase Anonymous Authentication**
- O ID Token é enviado em todas as requisições protegidas:

```
Authorization: Bearer <firebase_id_token>
```

- O backend valida o token e associa os dados ao `uid` do usuário
- Cada usuário só pode acessar seus próprios vídeos/jobs

## ⚙️ Configuração do Firebase

Para rodar o projeto, é necessário configurar o Firebase para autenticação, Firestore e Storage. Siga os passos abaixo:

### 1. Criar projeto no Firebase

1. Acesse [Firebase Console](https://console.firebase.google.com/).
2. Clique em **Adicionar projeto** e siga as instruções.
3. Habilite **Authentication**, **Firestore** e **Storage** no painel do projeto.

### 2. Configurar Firebase Authentication

1. Vá em **Authentication > Métodos de Login**.
2. Habilite **Login Anônimo** (Anonymous Authentication).
3. O frontend fará login anônimo e receberá um **ID Token**, que será enviado ao backend em todas as requisições.

### 3. Configurar Firestore

1. Vá em **Firestore Database** e crie um banco em **modo produção** (ou teste, se preferir).
2. Crie a coleção `videos`.
3. Aplique as regras para isolamento por usuário:

```bash
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

1. Vá em **Storage** e configure um bucket padrão. produção** (ou teste, se preferir).
2. Crie a estrutura de pastas no Storage:
```bash
/videos/{userId}/{videoId}
```
3. Aplique as regras para isolamento por usuário:
```bash
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

1. No backend,, crie um arquivo `.env` para o **Firebase Admin SDK** com a chave do service account:
```bash
FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n
FIREBASE_STORAGE_BUCKET=
```

---

## 🎥 Fluxo de Vídeo / Job

1. Upload do vídeo (`UPLOADED`)
2. Início da conversão (`PROCESSING`)
3. Finalização (`DONE`) ou erro (`FAILED`)

Status armazenado no Firestore e atualizado pelo backend.

```text
💡 O frontend faz polling a cada 3 segundos para verificar o status do vídeo (PROCESSING, DONE, FAILED).
```

---

## 🌐 Endpoints Principais

| Método | Endpoint                 | Descrição                      |
| ------ | ------------------------ | ------------------------------ |
| POST   | /api/videos              | Upload do vídeo                |
| POST   | /api/videos/:id/convert  | Inicia conversão               |
| GET    | /api/videos/:id          | Consulta status e busca vídeos |
| GET    | /api/videos/:id/download | Download do vídeo convertido   |

---

## 🖥️ Frontend (Client de Teste)

O frontend é **propositalmente simples** e serve apenas para testar o backend.

Funcionalidades:

- Login anônimo com Firebase Auth
- Upload de vídeo
- Solicitar conversão
- Acompanhar status (polling manual)
- Download do vídeo final

```text
💡 Frontend (React) requer um arquivo `.env` com as seguintes variáveis:
```

```bash
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
```

Não há preocupação com layout ou UX.

---

## 🐳 Como Rodar (Docker)

### Backend

```bash
cd backend
docker build -t video-converter-backend .
docker run -p 3000:3000 --env-file .env video-converter-backend
```

```text
Deve ser criado um .env com as credenciais do Firebase Admin SDK antes de rodar o container.
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend disponível em:

```
http://localhost:5173
```

---

## 🔥 Decisões Técnicas

- **Conversão síncrona simples:** sem filas externas, cada job é processado imediatamente pelo backend.
- **Preset único de vídeo:** MP4 720p, para reduzir complexidade e padronizar saída.
- **FFmpeg isolado por job:** cada conversão roda em seu próprio contexto, com input/output separados no Firebase Storage (`/videos/{userId}/{videoId}/input` e `/videos/{userId}/{videoId}/output`).
- **API_URL global:** todas as chamadas do frontend usam uma URL base (`API_URL`) para simplificar endpoints e permitir fácil troca de ambiente (dev/prod).
- **Polling de status:** frontend consulta o status a cada 3 segundos durante a conversão (`PROCESSING, DONE, FAILED`).
- **Firebase Admin SDK no backend:** validação de tokens, controle de acesso e leitura/escrita segura no Firestore/Storage.
- **Segurança por UID:** cada usuário só consegue acessar seus próprios vídeos/jobs, tanto no backend quanto nas regras do Firebase.
- **Frontend mínimo:** React + Vite serve apenas como client de teste, sem preocupação com UX ou layout.
- **Docker com FFmpeg instalado:** garante consistência de ambiente entre dev e produção.
- **Estrutura de diretórios no Storage:** input/output separados por usuário e job, evitando conflitos.
- **Centralização de tokens:** ID Token obtido no login anônimo, enviado em todas as requisições protegidas para autenticação backend.

## 🔥 Decisões Técnicas Detalhadas

### Modelagem do Firestore

- Cada vídeo é um documento na coleção `videos`, identificado por um `videoId` UUID.
- Estrutura do documento (`VideoDoc`):
  - `userId`: identifica o dono do vídeo
  * `title` e `originalFileName`: metadados do vídeo
  * `inputPath` e `outputPath`: caminhos no Storage para input/output
  * `status`: `'PENDING' | 'PROCESSING' | 'DONE' | 'ERROR'`
  * `preset`: atualmente apenas `'MP4_720P'`
  * `createdAt`, `startedAt`, `finishedAt`: timestamps

- Regras do Firestore garantem que cada usuário só pode ler/escrever seus próprios vídeos:

```bash
match /videos/{videoId} {
    allow read, write: if request.auth != null
    && request.auth.uid == resource.data.userId;
}
```

### Organização do NestJS

- Módulos separados para funcionalidades:
  - `VideosModule`: upload, conversão, listagem e download de vídeos
  - `FFmpegModule`: encapsula a lógica de conversão
  - `FirebaseModule`: abstrai acesso ao Firestore e Storage
- Guards centralizados (`FirebaseAuthGuard`) para validar token do Firebase em todas as rotas protegidas
- Decorator `@User()` para injetar facilmente os dados do usuário autenticado em controllers
- Serviço `VideosService`:
  - Upload salva arquivo no Storage e cria documento no Firestore
  - Conversão é disparada async via `processConversion` e atualiza status
  - Download verifica token, status e envia arquivo via stream

### Execução do FFmpeg

- FFmpeg executado localmente dentro do container Docker
- Cada conversão baixa o input do Storage para `/temp`, roda FFmpeg e faz upload do output
- Preset fixo: `-vf scale=-2:720`, mantendo proporção
- Cleanup dos arquivos temporários após upload
- Serviço `FFmpegService` centraliza lógica de execução e tratamento de erros

### Segurança por usuário

- Backend valida token do Firebase em todas as requisições
- Usuário só consegue acessar seus próprios vídeos (upload, status, download)
- Regras do Storage reforçam isolamento:

```bash
match /videos/{userId}/{videoId}/{fileName} {
    allow read, write: if request.auth != null
    && request.auth.uid == userId;
}
```

- Tokens anônimos usados no frontend são verificados no backend antes de qualquer operação crítica

### Endpoints e API global

- Frontend usa `API_URL` global para facilitar troca entre ambientes (dev/prod)
- Endpoints principais:
  - É setado globalmente `api` para todos os endpoints permitindo versionamento mais claro das rotas
  - `POST /videos`: upload
  - `POST /videos/:id/convert`: iniciar conversão
  - `GET /videos/:id`: status
  - `GET /videos/:id/download`: download
- Polling do status implementado no frontend a cada 3 segundos durante `PROCESSING`

### Docker e Ambiente

- Backend em container Docker com FFmpeg instalado
- Garante consistência entre desenvolvimento e produção
- Frontend mínimo roda localmente via Vite, consumindo a mesma API

### Observações adicionais

- Conversão síncrona (não escalável) mas suficiente para teste
- Input/output organizados por userId e videoId para evitar conflitos
- Preset único e diretório temporário isolado simplificam gerenciamento de jobs

---

## ⚠️ Limitações Conhecidas

- Conversão síncrona (não escalável)
- Frontend extremamente simples
- Sem retry automático em falhas
- Download simplificado (sem expiração de URL avançada)

---

## ✅ Conclusão

Projeto focado em clareza, isolamento por usuário, simplicidade e aderência ao enunciado do teste técnico.
