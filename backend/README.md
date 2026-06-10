# Backend Flask

## Requirements

- `DATABASE_URL` pointing to a PostgreSQL database.
- The PostgreSQL role in `DATABASE_URL` needs permission to create databases if the target database does not exist yet.
- `JWT_SECRET_KEY` for signing session tokens.
- Optional: `STORAGE_DIR` to override the local upload folder.

## Run

```bash
pip install -r backend/requirements.txt
python -m backend.app
```

Default local port: `5005`.

The app bootstraps the SQL schema from `backend/migrations/*.sql` on startup.
If the database named in `DATABASE_URL` does not exist, the backend will try to create it first by connecting to the default `postgres` database.
Uploads are stored locally under `backend_data/storage` by default.
