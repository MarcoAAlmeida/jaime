# Serve the design/ folder's click-through mocks locally and open the
# app kit in your browser. Ctrl+C to stop.
design:
	#!/usr/bin/env bash
	set -euo pipefail
	port=8899
	url="http://127.0.0.1:$port/ui_kits/app/index.html"
	if netstat -ano | grep -q ":$port .*LISTENING"; then
		echo "Port $port is already in use — run 'just design-stop' first, or edit the port in justfile."
		exit 1
	fi
	( sleep 1 && explorer.exe "$url" ) &
	echo "Design system: http://127.0.0.1:$port/  (opening $url)"
	echo "Also try: http://127.0.0.1:$port/ui_kits/site/index.html (marketing/docs mock)"
	echo "Press Ctrl+C to stop."
	python3 -m http.server "$port" --directory design

# Stop whatever's listening on the design server's port (8899)
design-stop:
	#!/usr/bin/env bash
	set -euo pipefail
	port=8899
	pid=$(netstat -ano | grep ":$port " | grep LISTENING | awk '{print $NF}' | head -1)
	if [ -z "${pid:-}" ]; then
		echo "Nothing listening on $port."
	else
		taskkill //F //PID "$pid"
	fi
