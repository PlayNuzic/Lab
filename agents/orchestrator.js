#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class PlayNuzicLabOrchestrator {
  constructor() {
    console.log('🎭 PlayNuzic Lab Agent Orchestrator v1.0.0\n');
  }

  async analyze() {
    console.log('📊 Analizando repositorio...\n');
    
    const appsDir = path.join(__dirname, '..', 'Apps');
    const apps = fs.readdirSync(appsDir)
      .filter(name => name.startsWith('app') || name.startsWith('App'));
    
    console.log(`✅ ${apps.length} apps encontradas:`);
    apps.forEach(app => console.log(`   - ${app}`));
    
    const libsDir = path.join(__dirname, '..', 'libs', 'app-common');
    if (fs.existsSync(libsDir)) {
      const modules = fs.readdirSync(libsDir)
        .filter(name => name.endsWith('.js') && !name.includes('.test.'));
      console.log(`\n✅ ${modules.length} módulos compartidos en libs/app-common/`);
    }
    
    return { apps, status: 'ok' };
  }

  async verify() {
    console.log('🔍 Verificando integridad del sistema...\n');
    
    const checks = {
      structure: this.checkStructure(),
      apps: this.checkApps(),
      config: this.checkConfig()
    };
    
    const allPassed = Object.values(checks).every(c => c.passed);
    
    console.log('\n📋 Resultados:');
    Object.entries(checks).forEach(([name, result]) => {
      const icon = result.passed ? '✅' : '❌';
      console.log(`${icon} ${name}: ${result.message}`);
    });
    
    if (allPassed) {
      console.log('\n✅ Sistema verificado correctamente\n');
    } else {
      console.log('\n⚠️  Hay problemas que revisar\n');
    }
    
    return checks;
  }

  checkStructure() {
    const required = ['Apps', 'libs', 'agents', '.claude-code'];
    const missing = required.filter(dir => 
      !fs.existsSync(path.join(__dirname, '..', dir))
    );
    
    return {
      passed: missing.length === 0,
      message: missing.length === 0 
        ? 'Estructura correcta' 
        : `Faltan: ${missing.join(', ')}`
    };
  }

  checkApps() {
    const appsDir = path.join(__dirname, '..', 'Apps');
    if (!fs.existsSync(appsDir)) {
      return { passed: false, message: 'Directorio Apps no encontrado' };
    }
    
    const apps = fs.readdirSync(appsDir)
      .filter(name => name.startsWith('app') || name.startsWith('App'));
    
    return {
      passed: apps.length >= 4,
      message: `${apps.length} apps encontradas`
    };
  }

  checkConfig() {
    const configPath = path.join(__dirname, '..', '.claude-code', 'agents-context.md');
    return {
      passed: fs.existsSync(configPath),
      message: fs.existsSync(configPath) 
        ? 'Configuración presente' 
        : 'Configuración no encontrada'
    };
  }

  showHelp() {
    console.log(`
Uso: node orchestrator.js [comando]

Comandos:
  analyze   - Analizar el repositorio
  verify    - Verificar integridad del sistema
  help      - Mostrar esta ayuda

Ejemplos:
  node orchestrator.js analyze
  node orchestrator.js verify
    `);
  }
}

const orchestrator = new PlayNuzicLabOrchestrator();
const command = process.argv[2] || 'help';

switch (command) {
  case 'analyze':
    await orchestrator.analyze();
    break;
  case 'verify':
    await orchestrator.verify();
    break;
  default:
    orchestrator.showHelp();
}
