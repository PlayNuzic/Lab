#!/bin/bash

# Script de inicio rápido para Claude Code

echo "🚀 Iniciando Claude Code con contexto de agentes..."
echo ""

# Verificar que estamos en Lab
if [ ! -d ".claude-code" ]; then
    echo "❌ Error: Ejecuta este script desde la raíz de Lab"
    exit 1
fi

# Verificar que Claude Code está instalado
if ! command -v claude &> /dev/null; then
    echo "⚠️  Claude Code no está instalado"
    echo ""
    echo "Instala con:"
    echo "  npm install -g @anthropic-ai/claude-code"
    echo ""
    exit 1
fi

# Mensaje de bienvenida
echo "📝 Prompt sugerido para copiar/pegar:"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Hola! Lee el contexto de agentes:"
echo "@.claude-code/agents-context.md"
echo ""
echo "Confirma que entiendes:"
echo "- Los 6 agentes (🎨🔊📱📦🏗️🎮)"
echo "- Archivos críticos (NO tocar)"
echo "- Proceso: Mostrar código → ✅ → Crear"
echo ""
echo "¿Con qué agente empezamos?"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Presiona ENTER para iniciar Claude Code..."
read

# Iniciar Claude Code
claude
