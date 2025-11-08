#!/bin/bash

# Script per gestire migrazioni database Drizzle

set -e

echo "🗄️  Fortify Database Migration Script"
echo ""

# Verifica che .env esista
if [ ! -f .env ]; then
    echo "❌ Errore: File .env non trovato"
    echo "Crea un file .env con DATABASE_URL prima di procedere"
    exit 1
fi

# Carica variabili d'ambiente
source .env

# Verifica DATABASE_URL
if [ -z "$DATABASE_URL" ]; then
    echo "❌ Errore: DATABASE_URL non configurata"
    exit 1
fi

echo "📋 DATABASE_URL configurata"
echo ""

# Menu scelta
echo "Seleziona un'azione:"
echo "1) Genera nuova migrazione"
echo "2) Applica migrazioni"
echo "3) Drop database (ATTENZIONE!)"
echo "4) Push schema (sviluppo - senza migrazioni)"
echo "5) Esci"
echo ""

read -p "Scelta [1-5]: " choice

case $choice in
    1)
        echo ""
        echo "📝 Generazione migrazione..."
        pnpm drizzle-kit generate
        echo "✅ Migrazione generata in ./drizzle/"
        ;;
    2)
        echo ""
        echo "🚀 Applicazione migrazioni..."
        pnpm drizzle-kit migrate
        echo "✅ Migrazioni applicate con successo"
        ;;
    3)
        echo ""
        echo "⚠️  ATTENZIONE: Stai per eliminare TUTTO il database!"
        read -p "Sei sicuro? Digita 'DELETE' per confermare: " confirm
        if [ "$confirm" = "DELETE" ]; then
            echo "🗑️  Drop database..."
            pnpm drizzle-kit drop
            echo "✅ Database eliminato"
        else
            echo "❌ Operazione annullata"
        fi
        ;;
    4)
        echo ""
        echo "⚡ Push schema (modalità sviluppo)..."
        pnpm drizzle-kit push
        echo "✅ Schema pushato direttamente al database"
        ;;
    5)
        echo "👋 Uscita"
        exit 0
        ;;
    *)
        echo "❌ Scelta non valida"
        exit 1
        ;;
esac

echo ""
echo "✨ Operazione completata!"

