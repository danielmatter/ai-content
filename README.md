# AI Content Studio

A Next.js, Tailwind CSS, SQLite, Better Auth, and OpenRouter-based content creation studio.

## Run

```bash
npm install
npm run dev
```

The app creates `studio.sqlite` automatically on first server import. Copy `.env.example` to `.env.local` when you want to configure Better Auth secrets, database path, or OpenRouter.

## API Surface

Authentication is mounted at:

- `GET|POST /api/auth/[...all]`

Studio CRUD is available at:

- `GET|POST /api/workspaces`
- `GET|PATCH|DELETE /api/workspaces/:workspaceId`
- `GET|POST /api/workspaces/:workspaceId/assets`
- `GET|PATCH|DELETE /api/workspaces/:workspaceId/assets/:assetId`
- `GET|POST /api/workspaces/:workspaceId/images`
- `POST /api/workspaces/:workspaceId/images/upload`
- `GET|POST /api/workspaces/:workspaceId/projects`
- `GET|PATCH|DELETE /api/workspaces/:workspaceId/projects/:projectId`
- `GET|PUT /api/workspaces/:workspaceId/projects/:projectId/assets`
- `GET|POST /api/workspaces/:workspaceId/projects/:projectId/scenes`
- `GET|PATCH|DELETE /api/workspaces/:workspaceId/projects/:projectId/scenes/:sceneId`

Structured form generation is available beside the create/edit resources:

- `POST /api/workspaces/generate`
- `POST /api/workspaces/:workspaceId/generate`
- `POST /api/workspaces/:workspaceId/assets/generate`
- `POST /api/workspaces/:workspaceId/assets/:assetId/generate`
- `POST /api/workspaces/:workspaceId/projects/generate`
- `POST /api/workspaces/:workspaceId/projects/:projectId/generate`
- `POST /api/workspaces/:workspaceId/projects/:projectId/scenes/generate`
- `POST /api/workspaces/:workspaceId/projects/:projectId/scenes/:sceneId/generate`

If `OPENROUTER_API_KEY` is absent, generation returns deterministic stub form fields. When configured, it calls OpenRouter chat completions with structured JSON output and saves request logs under `logs/`.
