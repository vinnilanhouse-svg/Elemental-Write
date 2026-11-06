#!/bin/sh
cd "$(dirname "$0")" || exit 1
if ! command -v node >/dev/null 2>&1; then
  echo 'Instale o Node.js LTS em https://nodejs.org e tente novamente.'
  read -r resposta
  exit 1
fi
node iniciar.cjs
