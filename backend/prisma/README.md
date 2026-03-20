# Migrations

To apply migrations on a live database:

```bash
npx prisma migrate dev --name init_schema
```

To apply in production (Railway):

```bash
npx prisma migrate deploy
```

Jules cannot run these commands — they require a live PostgreSQL connection.
Run them locally after starting `docker-compose up -d`.
