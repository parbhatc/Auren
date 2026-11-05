set -e
for repo in /root/Auren /root/BetterweightChartPro; do
  if [ -d "$repo/.git" ]; then
    printf '\nREPOSITORY %s\n' "$repo"
    git -C "$repo" status --short
    git -C "$repo" log -1 --format='%H %s'
  fi
done
