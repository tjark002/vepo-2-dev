#!/bin/bash

# MySQL Database Backup Script for VEPO Product Configurator
# Run via cron: 0 3 * * * /path/to/backup-database.sh

set -e

# Configuration - Set these environment variables or modify directly
DB_HOST="${DB_HOST:-87.106.224.224}"
DB_PORT="${DB_PORT:-3306}"
DB_NAME="${DB_NAME:-vepo2db}"
DB_USER="${DB_USER:-vepo2}"
DB_PASSWORD="${DB_PASSWORD}"

BACKUP_DIR="${BACKUP_DIR:-/var/backups/vepo2}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

# Generate filename with timestamp
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="$BACKUP_DIR/${DB_NAME}_${TIMESTAMP}.sql.gz"

echo "Starting backup of $DB_NAME..."

# Create backup
mysqldump -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" -p"$DB_PASSWORD" \
  --single-transaction \
  --routines \
  --triggers \
  "$DB_NAME" | gzip > "$BACKUP_FILE"

# Check if backup was successful
if [ $? -eq 0 ]; then
  echo "Backup completed successfully: $BACKUP_FILE"
  echo "Size: $(du -h "$BACKUP_FILE" | cut -f1)"
else
  echo "Backup failed!"
  exit 1
fi

# Remove old backups (older than RETENTION_DAYS)
echo "Removing backups older than $RETENTION_DAYS days..."
find "$BACKUP_DIR" -name "*.sql.gz" -type f -mtime +$RETENTION_DAYS -delete

echo "Backup process completed."
