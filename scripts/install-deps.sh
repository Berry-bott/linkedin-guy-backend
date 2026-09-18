set -u

LOG="$(pwd)/npm-install.log"
: > "$LOG"

nohup npm install "$@" >> "$LOG" 2>&1 &
PID=$!
echo "npm install started (pid $PID) -> $LOG"

for i in $(seq 1 240); do
  if ! kill -0 "$PID" 2>/dev/null; then
    echo "npm install finished after ~$((i * 2))s"
    exit 0
  fi
  sleep 2
done

echo "npm install still running after 480s"
exit 2