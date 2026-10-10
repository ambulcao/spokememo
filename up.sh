#!/bin/sh
# Sobe o SpokeMemo com as imagens neste HD, fora do disco de /var/home.
# O `podman compose` padrão reutiliza o socket já aberto e ignora --root.
cd "$(dirname "$0")" || exit 1
root="$PWD/.containers/storage"
xdg="${XDG_RUNTIME_DIR:-/run/user/$(id -u)}"
runtime="$xdg/spokememo-run"
sock="$xdg/spokememo.sock"
mkdir -p "$root" "$runtime"

# Depois de renomear a pasta, o serviço antigo continua no socket com o
# --root anterior. Esse banco fica só leitura e a criação de volumes falha.
stop_stale_service() {
  sock_path="$1"
  for pid in $(pgrep -f "system service --time=0 unix://${sock_path}" || true); do
    cmd=$(tr '\0' ' ' < "/proc/$pid/cmdline" 2>/dev/null || true)
    case "$cmd" in
      *"--root ${root} --runroot ${runtime} "*) ;;
      *)
        kill "$pid" 2>/dev/null || true
        i=0
        while kill -0 "$pid" 2>/dev/null && [ "$i" -lt 50 ]; do
          sleep 0.1
          i=$((i + 1))
        done
        kill -9 "$pid" 2>/dev/null || true
        rm -f "$sock_path"
        ;;
    esac
  done
}

stop_stale_service "$xdg/meetmemo.sock"
stop_stale_service "$sock"

if ! [ -S "$sock" ]; then
  nohup podman --root "$root" --runroot "$runtime" system service --time=0 "unix://$sock" >>/tmp/spokememo-podman.log 2>&1 &
  disown || true
  i=0
  while [ ! -S "$sock" ] && [ "$i" -lt 50 ]; do
    sleep 0.1
    i=$((i + 1))
  done
fi

if ! [ -S "$sock" ]; then
  echo "Não foi possível abrir $sock" >&2
  exit 1
fi

export DOCKER_HOST="unix://$sock"
export DOCKER_BUILDKIT=0
exec /usr/libexec/docker/cli-plugins/docker-compose "$@"
