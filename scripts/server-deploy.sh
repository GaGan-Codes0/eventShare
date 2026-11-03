#!/bin/bash
# Run ON THE SERVER (over SSH) to make a branch live:
#   cd /opt/eventshare/app && ./scripts/server-deploy.sh pre-prod     (or: prod)
# Pulls that branch exactly as it is on GitHub, rebuilds the API and restarts it. Database migrations run on start.
set -euo pipefail
BRANCH=${1:?usage: server-deploy.sh <branch>   e.g. pre-prod or prod}
cd /opt/eventshare/app

git fetch origin --prune
git checkout -B "$BRANCH" "origin/$BRANCH"
COMMIT=$(git log -1 --format='%h %s')

# The server's public address (its fixed IP) gives the HTTPS name, e.g. 13-233-1-2.sslip.io.
TOKEN=$(curl -fsS -X PUT http://169.254.169.254/latest/api/token -H 'X-aws-ec2-metadata-token-ttl-seconds: 60')
IP=$(curl -fsS -H "X-aws-ec2-metadata-token: $TOKEN" http://169.254.169.254/latest/meta-data/public-ipv4)
export API_HOST=${IP//./-}.sslip.io

echo "Deploying $BRANCH: $COMMIT"
docker compose -f infra/ec2/compose.yml up -d --build --remove-orphans
docker image prune -f >/dev/null

for _ in $(seq 1 40); do
  if curl -fsS "https://$API_HOST/health" >/dev/null 2>&1; then
    echo "$(date -u +%FT%TZ) $BRANCH $COMMIT" >> /opt/eventshare/deploys.log
    echo "Live on https://$API_HOST  ($BRANCH: $COMMIT)"
    exit 0
  fi
  sleep 3
done
echo "Not answering yet. Logs: docker compose -f infra/ec2/compose.yml logs --tail 50 api"
exit 1
