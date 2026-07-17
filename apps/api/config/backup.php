<?php

$sourceDisks = array_values(array_filter(array_map(
    'trim',
    explode(',', (string) env('BACKUP_SOURCE_DISKS', 'public,r2_books,r2_covers'))
)));

$environments = array_values(array_filter(array_map(
    'trim',
    explode(',', (string) env('BACKUP_ALLOWED_ENVIRONMENTS', 'production,staging'))
)));

return [
    'enabled' => (bool) env('BACKUP_ENABLED', false),
    'schedule_enabled' => (bool) env('BACKUP_SCHEDULE_ENABLED', false),
    'allowed_environments' => $environments,
    'disk' => env('BACKUP_DISK', 'backup'),
    'path' => trim((string) env('BACKUP_PATH', 'charbook'), '/'),
    'source_disks' => $sourceDisks,
    'retention_days' => (int) env('BACKUP_RETENTION_DAYS', 30),
    'daily_at' => env('BACKUP_DAILY_AT', '03:30'),
    'prune_at' => env('BACKUP_PRUNE_AT', '04:30'),
    'verify_upload' => (bool) env('BACKUP_VERIFY_UPLOAD', true),
    'encryption_key' => env('BACKUP_ENCRYPTION_KEY'),
    'pg_dump_binary' => env('PG_DUMP_BINARY', 'pg_dump'),
    'pg_restore_binary' => env('PG_RESTORE_BINARY', 'pg_restore'),
    'process_timeout' => (int) env('BACKUP_PROCESS_TIMEOUT', 3600),
    'lock_seconds' => (int) env('BACKUP_LOCK_SECONDS', 21600),
    'restore_database' => env('BACKUP_RESTORE_DATABASE', 'charbook_restoretest'),
    'limits' => [
        'max_files' => (int) env('BACKUP_MAX_FILES', 100000),
        'max_file_bytes' => (int) env('BACKUP_MAX_FILE_BYTES', 2147483648),
        'max_total_bytes' => (int) env('BACKUP_MAX_TOTAL_BYTES', 107374182400),
        'max_archive_bytes' => (int) env('BACKUP_MAX_ARCHIVE_BYTES', 107374182400),
        'max_encrypted_bytes' => (int) env('BACKUP_MAX_ENCRYPTED_BYTES', 108447924224),
        'max_manifest_bytes' => (int) env('BACKUP_MAX_MANIFEST_BYTES', 5242880),
    ],
    'exclude_table_data' => [
        'cache',
        'cache_locks',
        'jobs',
        'job_batches',
        'failed_jobs',
        'sessions',
        'password_reset_tokens',
        'personal_access_tokens',
    ],
];
