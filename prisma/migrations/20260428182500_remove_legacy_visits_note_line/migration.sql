-- Remove legacy import meta line from client notes:
-- "Количество записей (старая база): N"
UPDATE "clients"
SET "notes" = NULLIF(
  BTRIM(
    REGEXP_REPLACE(
      REGEXP_REPLACE(
        "notes",
        '(^|\n)Количество записей \(старая база\):\s*\d+(\n|$)',
        E'\n',
        'g'
      ),
      '\n{3,}',
      E'\n\n',
      'g'
    )
  ),
  ''
)
WHERE "notes" ~ '(^|\n)Количество записей \(старая база\):\s*\d+(\n|$)';
