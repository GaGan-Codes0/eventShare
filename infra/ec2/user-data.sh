#!/bin/bash
# First boot only (Amazon Linux 2023, arm64). infra/aws/setup.sh fills in the __PLACEHOLDERS__.
set -euo pipefail
dnf install -y docker git cronie
systemctl enable --now docker crond
usermod -aG docker ec2-user
mkdir -p /usr/local/lib/docker/cli-plugins
curl -fsSL https://github.com/docker/compose/releases/download/v2.40.3/docker-compose-linux-aarch64 \
  -o /usr/local/lib/docker/cli-plugins/docker-compose
chmod +x /usr/local/lib/docker/cli-plugins/docker-compose
# Swap so building the API image fits in 2 GB of RAM.
fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
echo '/swapfile swap swap defaults 0 0' >> /etc/fstab

# Secrets are generated here and never leave the server.
mkdir -p /opt/eventshare && cd /opt/eventshare
umask 077
DB_PASSWORD=$(openssl rand -hex 24)
printf 'POSTGRES_USER=eventshare\nPOSTGRES_DB=eventshare\nPOSTGRES_PASSWORD=%s\n' "$DB_PASSWORD" > .env.db
cat > .env <<ENV
NODE_ENV=production
PORT=4000
TRUST_PROXY=true
DATABASE_URL=postgres://eventshare:${DB_PASSWORD}@postgres:5432/eventshare
JWT_SECRET=$(openssl rand -base64 48 | tr -d '\n')
JWT_TTL=30d
AUTH_DEV_BYPASS=false
S3_REGION=__REGION__
S3_BUCKET=__PHOTOS_BUCKET__
SIGNED_URL_TTL_SECONDS=3600
ENV
umask 022
chown -R ec2-user:ec2-user /opt/eventshare

# Read-only key the server uses to pull code from GitHub (added to the repo as a deploy key).
sudo -u ec2-user ssh-keygen -t ed25519 -N '' -C eventshare-server -f /home/ec2-user/.ssh/github_deploy
printf 'Host github.com\n  IdentityFile ~/.ssh/github_deploy\n  IdentitiesOnly yes\n' > /home/ec2-user/.ssh/config
chown ec2-user:ec2-user /home/ec2-user/.ssh/config && chmod 600 /home/ec2-user/.ssh/config

# Nightly database backup to S3 (the backups bucket expires them after 30 days).
cat > /etc/cron.daily/eventshare-backup <<'CRON'
#!/bin/bash
set -euo pipefail
docker exec eventshare-postgres-1 pg_dump -U eventshare -Fc eventshare \
  | aws s3 cp - "s3://__BACKUPS_BUCKET__/postgres/$(date -u +%F).dump" --region __REGION__ --only-show-errors
CRON
chmod 755 /etc/cron.daily/eventshare-backup
