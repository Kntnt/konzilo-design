# Shared by the design-* commands in bin: where the repository is, and the design file the command must be given.
root="$(cd "$(dirname "$(realpath "${BASH_SOURCE[0]}")")/../.." && pwd)"
konzilo="$root/bin/konzilo-design.js"

# Stops the command with its usage unless a design file was named.
need_file() {
  if [[ $# -eq 0 || "$1" == -* ]]; then
    sed -n 's/^# Usage: //p' "$0" | sed 's/^/Usage: /' >&2
    exit 2
  fi
}
