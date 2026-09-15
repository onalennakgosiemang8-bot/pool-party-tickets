# Database

`schema.prisma` defines the PostgreSQL data model.

`migrations/` contains the production migration history. Do not delete or edit an already-applied migration in production; create a new migration for changes.

For a fresh hosted database:

```bash
npm run db:deploy
npm run seed
npm run db:check
```

The latest migration adds database-level enforcement of the 55-guest hard cap.
