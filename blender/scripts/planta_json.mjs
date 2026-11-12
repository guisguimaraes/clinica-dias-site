// Converte site/passeio/planta.js (os dois andares) em JSON para o Blender.
import { writeFileSync } from 'node:fs';
const m = await import('../../site/passeio/planta.js');
writeFileSync(new URL('../dados/planta.json', import.meta.url), JSON.stringify({ pecas: m.pecas, materiais: m.materiais, areas: m.areas, gruposLuz: m.gruposLuz, nivel: m.nivel }));
const tipos = {};
for (const p of m.pecas) tipos[p.tipo] = (tipos[p.tipo] || 0) + 1;
console.log('planta.json ok', m.pecas.length, 'peças', JSON.stringify(tipos));
