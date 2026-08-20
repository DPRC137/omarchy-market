#!/bin/bash

echo "============================================================"
echo "OMARCHY MARKET RESOURCE BENCHMARK"
echo "============================================================"

SHELL_PID=$(pgrep -f "quickshell.*omarchy/shell" | head -n 1)
echo "Omarchy Shell PID: $SHELL_PID"
if [ -n "$SHELL_PID" ]; then
  SHELL_MEM=$(ps -o rss= -p "$SHELL_PID" | awk '{print $1/1024 " MB"}')
  SHELL_CPU=$(ps -o %cpu= -p "$SHELL_PID")
  echo "  - Shell RSS: $SHELL_MEM"
  echo "  - Shell CPU: $SHELL_CPU %"
fi

echo -e "\nWebSocket Bridge Subprocesses:"
ps -eo pid,ppid,%cpu,rss,args | grep "[w]s_bridge.js" | while read -r line; do
  PID=$(echo "$line" | awk '{print $1}')
  CPU=$(echo "$line" | awk '{print $3}')
  RSS=$(echo "$line" | awk '{print $4}')
  PROV=$(echo "$line" | awk '{print $NF}')
  RSS_MB=$(awk "BEGIN {print $RSS/1024}")
  printf "  - Provider [%-11s] PID: %-6s CPU: %-4s%% RSS: %6.2f MB\n" "$PROV" "$PID" "$CPU" "$RSS_MB"
done

echo -e "\nNetwork Socket Statistics:"
OPEN_SOCKETS=$(ss -tp 2>/dev/null | grep -E "node|quickshell" | wc -l || true)
echo "  - Open Established Sockets: $OPEN_SOCKETS"

echo "============================================================"
