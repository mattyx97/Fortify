#!/bin/sh
set -e

# Esegui le migrazioni
echo "🔄 Esecuzione delle migrazioni del database..."
node migrate-prod.js

# Avvia l'applicazione
echo "🚀 Avvio dell'applicazione..."
node .output/server/index.mjs 