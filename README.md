# Skillora — Halic Project

- `data ui/`: React, TypeScript and SCSS frontend using Axios and Redux Toolkit.
- `data backend/`: Python FastAPI backend and Microsoft SQL Server database scripts.

## Run locally

1. In `data backend`, run `start.cmd`.
2. In `data ui`, run `npm install`, then `npm run dev`.
3. Open http://127.0.0.1:5173. API documentation: http://127.0.0.1:8000/docs.

The frontend reads and writes the SQL database. There is no browser mock API.
For setup on another computer and optional fictional presentation data, see
[data backend/README.md](data%20backend/README.md) and
[data ui/README.md](data%20ui/README.md).

Do not upload local environment settings, virtual environments, node_modules or
SQL database files. Commit source code, dependency files, SQL scripts and the
example environment files instead.
