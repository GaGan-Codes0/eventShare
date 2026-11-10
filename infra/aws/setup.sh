#!/bin/bash
# One-time AWS setup for eventShare (Mumbai). Safe to re-run: it skips what already exists.
# Creates: private photo + backup buckets, server role, firewall, SSH key, EC2 server, fixed IP.
# Usage: infra/aws/setup.sh            Re-run any time your home IP changes to update the SSH rule.
set -euo pipefail
export AWS_REGION=${AWS_REGION:-ap-south-1} AWS_PAGER=""
cd "$(dirname "$0")"
ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
# The photos bucket the server uses (S3_BUCKET in /opt/eventshare/.env). Pass PHOTOS_BUCKET if it was named differently.
PHOTOS=${PHOTOS_BUCKET:-eventshare-photos-$ACCOUNT}
BACKUPS=eventshare-backups-$ACCOUNT
NAME=eventshare-api
INSTANCE_TYPE=${INSTANCE_TYPE:-t4g.small}

bucket() {
  aws s3api head-bucket --bucket "$1" 2>/dev/null && return
  echo "Creating bucket $1"
  aws s3api create-bucket --bucket "$1" --create-bucket-configuration LocationConstraint="$AWS_REGION" >/dev/null
  aws s3api put-public-access-block --bucket "$1" --public-access-block-configuration \
    BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true
  aws s3api put-bucket-ownership-controls --bucket "$1" --ownership-controls 'Rules=[{ObjectOwnership=BucketOwnerEnforced}]'
  aws s3api put-bucket-encryption --bucket "$1" --server-side-encryption-configuration \
    '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"},"BucketKeyEnabled":true}]}'
  # Refuse anything that isn't HTTPS.
  aws s3api put-bucket-policy --bucket "$1" --policy "{\"Version\":\"2012-10-17\",\"Statement\":[{\"Sid\":\"HttpsOnly\",\"Effect\":\"Deny\",\"Principal\":\"*\",\"Action\":\"s3:*\",\"Resource\":[\"arn:aws:s3:::$1\",\"arn:aws:s3:::$1/*\"],\"Condition\":{\"Bool\":{\"aws:SecureTransport\":\"false\"}}}]}"
}
bucket "$PHOTOS"
bucket "$BACKUPS"
aws s3api put-bucket-versioning --bucket "$PHOTOS" --versioning-configuration Status=Enabled
# tidy: drop half-finished uploads and deleted files' old copies.
# tiering: event files over 1 MB (originals, videos, voice) go to Intelligent-Tiering. S3 then moves each
# one to cheaper storage by itself after 30 and 90 days unopened, and back the moment it's opened again,
# with no fee to read it. Thumbnails and previews stay on Standard: they're small and opened all the time.
aws s3api put-bucket-lifecycle-configuration --bucket "$PHOTOS" --lifecycle-configuration \
  '{"Rules":[{"ID":"tidy","Status":"Enabled","Filter":{},"AbortIncompleteMultipartUpload":{"DaysAfterInitiation":2},"NoncurrentVersionExpiration":{"NoncurrentDays":30}},{"ID":"tiering","Status":"Enabled","Filter":{"And":{"Prefix":"events/","ObjectSizeGreaterThan":1048576}},"Transitions":[{"Days":0,"StorageClass":"INTELLIGENT_TIERING"}]}]}'
aws s3api put-bucket-lifecycle-configuration --bucket "$BACKUPS" --lifecycle-configuration \
  '{"Rules":[{"ID":"expire","Status":"Enabled","Filter":{},"Expiration":{"Days":30}}]}'

# Server role: only these two buckets + Session Manager. No access keys anywhere.
if ! aws iam get-role --role-name "$NAME" >/dev/null 2>&1; then
  echo "Creating server role $NAME"
  aws iam create-role --role-name "$NAME" --assume-role-policy-document \
    '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":"ec2.amazonaws.com"},"Action":"sts:AssumeRole"}]}' >/dev/null
  aws iam attach-role-policy --role-name "$NAME" --policy-arn arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore
  aws iam create-instance-profile --instance-profile-name "$NAME" >/dev/null
  aws iam add-role-to-instance-profile --instance-profile-name "$NAME" --role-name "$NAME"
  sleep 10 # new instance profiles take a moment to become usable
fi
aws iam put-role-policy --role-name "$NAME" --policy-name eventshare-access --policy-document "{
  \"Version\":\"2012-10-17\",\"Statement\":[
    {\"Effect\":\"Allow\",\"Action\":[\"s3:GetObject\",\"s3:PutObject\",\"s3:DeleteObject\",\"s3:ListMultipartUploadParts\"],\"Resource\":\"arn:aws:s3:::$PHOTOS/*\"},
    {\"Effect\":\"Allow\",\"Action\":\"s3:ListBucket\",\"Resource\":\"arn:aws:s3:::$PHOTOS\"},
    {\"Effect\":\"Allow\",\"Action\":\"s3:PutObject\",\"Resource\":\"arn:aws:s3:::$BACKUPS/*\"}]}"

# Firewall: web traffic for everyone; SSH (22) only from your current IP.
VPC=$(aws ec2 describe-vpcs --filters Name=is-default,Values=true --query 'Vpcs[0].VpcId' --output text)
SG=$(aws ec2 describe-security-groups --filters Name=group-name,Values="$NAME" Name=vpc-id,Values="$VPC" \
  --query 'SecurityGroups[0].GroupId' --output text)
if [ "$SG" = None ]; then
  echo "Creating firewall $NAME"
  SG=$(aws ec2 create-security-group --group-name "$NAME" --description "eventShare API: web + SSH from admin IP" \
    --vpc-id "$VPC" --query GroupId --output text)
  aws ec2 authorize-security-group-ingress --group-id "$SG" --ip-permissions \
    'IpProtocol=tcp,FromPort=80,ToPort=80,IpRanges=[{CidrIp=0.0.0.0/0}]' \
    'IpProtocol=tcp,FromPort=443,ToPort=443,IpRanges=[{CidrIp=0.0.0.0/0}]' \
    'IpProtocol=udp,FromPort=443,ToPort=443,IpRanges=[{CidrIp=0.0.0.0/0}]' >/dev/null
fi

MY_IP=$(curl -fsS https://checkip.amazonaws.com)
OLD_SSH=$(aws ec2 describe-security-groups --group-ids "$SG" \
  --query 'SecurityGroups[0].IpPermissions[?FromPort==`22`].IpRanges[].CidrIp' --output text)
for cidr in $OLD_SSH; do
  [ "$cidr" = "$MY_IP/32" ] || aws ec2 revoke-security-group-ingress --group-id "$SG" --protocol tcp --port 22 --cidr "$cidr" >/dev/null
done
[[ " $OLD_SSH " == *" $MY_IP/32 "* ]] ||
  aws ec2 authorize-security-group-ingress --group-id "$SG" --protocol tcp --port 22 --cidr "$MY_IP/32" >/dev/null

# SSH key: the private half is saved only on this Mac.
KEY=~/.ssh/eventshare-admin.pem
if ! aws ec2 describe-key-pairs --key-names eventshare-admin >/dev/null 2>&1; then
  echo "Creating SSH key $KEY"
  mkdir -p ~/.ssh && (umask 077 && aws ec2 create-key-pair --key-name eventshare-admin --key-type ed25519 \
    --query KeyMaterial --output text > "$KEY")
fi

INSTANCE=$(aws ec2 describe-instances --filters Name=tag:Name,Values="$NAME" \
  Name=instance-state-name,Values=pending,running,stopping,stopped --query 'Reservations[0].Instances[0].InstanceId' --output text)
if [ "$INSTANCE" = None ]; then
  echo "Launching $INSTANCE_TYPE server"
  USER_DATA=$(mktemp)
  sed -e "s/__REGION__/$AWS_REGION/g" -e "s/__PHOTOS_BUCKET__/$PHOTOS/g" -e "s/__BACKUPS_BUCKET__/$BACKUPS/g" \
    ../ec2/user-data.sh > "$USER_DATA"
  AMI=$(aws ssm get-parameter --name /aws/service/ami-amazon-linux-latest/al2023-ami-kernel-default-arm64 \
    --query Parameter.Value --output text)
  INSTANCE=$(aws ec2 run-instances --image-id "$AMI" --instance-type "$INSTANCE_TYPE" \
    --iam-instance-profile Name="$NAME" --security-group-ids "$SG" \
    --metadata-options HttpTokens=required,HttpPutResponseHopLimit=2,HttpEndpoint=enabled \
    --block-device-mappings 'DeviceName=/dev/xvda,Ebs={VolumeSize=30,VolumeType=gp3,Encrypted=true,DeleteOnTermination=false}' \
    --key-name eventshare-admin --user-data "file://$USER_DATA" \
    --tag-specifications "ResourceType=instance,Tags=[{Key=Name,Value=$NAME}]" "ResourceType=volume,Tags=[{Key=Name,Value=$NAME}]" \
    --query 'Instances[0].InstanceId' --output text)
  aws ec2 wait instance-running --instance-ids "$INSTANCE"
  aws ec2 modify-instance-attribute --instance-id "$INSTANCE" --disable-api-termination
fi

IP=$(aws ec2 describe-addresses --filters Name=tag:Name,Values="$NAME" --query 'Addresses[0].PublicIp' --output text)
if [ "$IP" = None ]; then
  ALLOC=$(aws ec2 allocate-address --domain vpc --tag-specifications "ResourceType=elastic-ip,Tags=[{Key=Name,Value=$NAME}]" \
    --query AllocationId --output text)
  aws ec2 associate-address --instance-id "$INSTANCE" --allocation-id "$ALLOC" >/dev/null
  IP=$(aws ec2 describe-addresses --allocation-ids "$ALLOC" --query 'Addresses[0].PublicIp' --output text)
fi

echo
echo "Photos bucket:  $PHOTOS"
echo "Backups bucket: $BACKUPS"
echo "Server:         $INSTANCE ($INSTANCE_TYPE)"
echo "API address:    https://${IP//./-}.sslip.io"
echo "SSH:            ssh -i $KEY ec2-user@$IP"
