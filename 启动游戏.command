#!/bin/bash
# 青元剑诀 · 本地复刻（完整解锁版）启动器
# 双击运行：会在本机起一个静态服务并打开浏览器。
set -u
cd "$(dirname "$0")" || exit 1

PY=""
for c in /usr/bin/python3 /opt/homebrew/bin/python3 python3; do
  if command -v "$c" >/dev/null 2>&1; then PY="$c"; break; fi
done
if [ -z "$PY" ]; then
  echo "未找到 python3，请安装（例如 xcode-select --install）。"
  read -r -p "按回车退出..." _
  exit 1
fi

PORT=8123
while [ "$PORT" -le 8145 ]; do
  if ! lsof -nP -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; then break; fi
  if curl -s -m 2 -o /dev/null "http://127.0.0.1:$PORT/index.html"; then break; fi
  PORT=$((PORT+1))
done

URL="http://127.0.0.1:$PORT/index.html"
echo "=============================================="
echo " 青元剑诀 · 本地复刻（完整解锁版）"
echo " 地址: $URL"
echo " 全部 10 项功能默认解锁：无需关注 / 邀请 / 三连 / 看广告"
echo " 手势控制需要允许浏览器的摄像头权限"
echo " 关闭本终端窗口即停止服务"
echo "=============================================="
open "$URL" 2>/dev/null || true
exec "$PY" -m http.server "$PORT" --bind 127.0.0.1
