#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

terraform -chdir="$ROOT" fmt -check -recursive
terraform -chdir="$ROOT" init -backend=false -input=false
terraform -chdir="$ROOT" validate

echo "Terraform formatting and configuration validation passed."
