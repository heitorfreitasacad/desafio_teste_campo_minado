import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { CampoMinado, ESTADO, LINHAS, COLUNAS, BOMBAS } from '../src/campoMinado.js';

// ---------- Tabuleiros fixos usados nos testes ----------

// Bloco de 4 x 10 bombas no canto inferior direito (linhas 10..13, colunas 8..17).
const BOMBAS_CANTO = [];
for (let l = 10; l <= 13; l++) for (let c = 8; c <= 17; c++) BOMBAS_CANTO.push([l, c]);

// Linhas 0 e 2 cheias de bombas (36) + 4 bombas na linha 4 (colunas 0..3).
const BOMBAS_LISTRAS = [];
for (let c = 0; c < COLUNAS; c++) BOMBAS_LISTRAS.push([0, c], [2, c]);
for (let c = 0; c <= 3; c++) BOMBAS_LISTRAS.push([4, c]);

// Gerador pseudoaleatório determinístico (mulberry32) para testes reprodutíveis.
function semente(s) {
  return () => {
    s |= 0; s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------- Casos de teste ----------

describe('Configuração do tabuleiro', () => {
  it('tem 14 linhas e 18 colunas (252 células)', () => {
    const jogo = new CampoMinado({ bombas: BOMBAS_CANTO });
    assert.equal(jogo.celulas.length, 14);
    jogo.celulas.forEach((linha) => assert.equal(linha.length, 18));
    assert.equal(LINHAS * COLUNAS, 252);
  });

  it('possui exatamente 40 bombas', () => {
    assert.equal(BOMBAS, 40);
    assert.equal(new CampoMinado({ bombas: BOMBAS_CANTO }).contarBombas(), 40);
  });

  it('começa com todas as células fechadas e sem bandeiras', () => {
    const jogo = new CampoMinado({ bombas: BOMBAS_CANTO });
    assert.equal(jogo.estado, ESTADO.JOGANDO);
    assert.ok(jogo.celulas.flat().every((c) => !c.aberta && !c.bandeira));
    assert.equal(jogo.bandeirasRestantes(), 40);
  });

  it('rejeita quantidade de bombas diferente de 40', () => {
    assert.throws(() => new CampoMinado({ bombas: BOMBAS_CANTO.slice(1) }), /40 bombas/);
  });

  it('rejeita bombas repetidas', () => {
    const repetidas = [...BOMBAS_CANTO.slice(1), BOMBAS_CANTO[1]];
    assert.throws(() => new CampoMinado({ bombas: repetidas }), /distintas/);
  });

  it('rejeita bombas fora do tabuleiro', () => {
    const fora = [...BOMBAS_CANTO.slice(1), [14, 0]];
    assert.throws(() => new CampoMinado({ bombas: fora }), RangeError);
  });
});

describe('Sorteio das bombas', () => {
  it('sorteia 40 bombas somente após a primeira jogada', () => {
    const jogo = new CampoMinado({ aleatorio: semente(1) });
    assert.equal(jogo.contarBombas(), 0);
    jogo.abrir(7, 9);
    assert.equal(jogo.contarBombas(), 40);
  });

  it('a primeira jogada nunca é bomba e sempre abre uma área (100 partidas)', () => {
    for (let s = 1; s <= 100; s++) {
      const jogo = new CampoMinado({ aleatorio: semente(s) });
      const l = s % LINHAS;
      const c = (s * 7) % COLUNAS;
      assert.notEqual(jogo.abrir(l, c), ESTADO.DERROTA);
      assert.equal(jogo.celulas[l][c].vizinhas, 0);
      for (const [vl, vc] of jogo.vizinhos(l, c)) {
        assert.equal(jogo.celulas[vl][vc].bomba, false);
      }
    }
  });

  it('a mesma semente gera o mesmo tabuleiro', () => {
    const a = new CampoMinado({ aleatorio: semente(42) });
    const b = new CampoMinado({ aleatorio: semente(42) });
    a.abrir(0, 0);
    b.abrir(0, 0);
    assert.deepEqual(
      a.celulas.map((l) => l.map((c) => c.bomba)),
      b.celulas.map((l) => l.map((c) => c.bomba)),
    );
  });
});

describe('Contagem de bombas vizinhas', () => {
  const jogo = new CampoMinado({ bombas: BOMBAS_LISTRAS });
  const casos = [
    [[1, 0], 4, 'borda esquerda entre duas linhas de bombas'],
    [[1, 5], 6, 'meio entre duas linhas de bombas'],
    [[1, 17], 4, 'borda direita entre duas linhas de bombas'],
    [[3, 0], 4, 'entre linha 2 e bombas da linha 4'],
    [[3, 5], 3, 'só parte de cima e uma diagonal'],
    [[5, 0], 2, 'abaixo das bombas da linha 4'],
    [[5, 4], 1, 'diagonal da última bomba da linha 4'],
    [[13, 17], 0, 'canto sem bombas próximas'],
  ];
  for (const [[l, c], esperado, desc] of casos) {
    it(`(${l}, ${c}) = ${esperado} — ${desc}`, () => {
      assert.equal(jogo.celulas[l][c].vizinhas, esperado);
    });
  }

  it('canto tem 3 vizinhos, borda 5 e meio 8', () => {
    assert.equal(jogo.vizinhos(0, 0).length, 3);
    assert.equal(jogo.vizinhos(0, 5).length, 5);
    assert.equal(jogo.vizinhos(6, 6).length, 8);
  });
});

describe('Abrir células', () => {
  it('abrir célula numerada abre somente ela', () => {
    const jogo = new CampoMinado({ bombas: BOMBAS_LISTRAS });
    jogo.abrir(1, 5);
    assert.equal(jogo.celulas.flat().filter((c) => c.aberta).length, 1);
    assert.equal(jogo.estado, ESTADO.JOGANDO);
  });

  it('abrir célula vazia abre a região em cascata (flood fill)', () => {
    const jogo = new CampoMinado({ bombas: BOMBAS_LISTRAS });
    jogo.abrir(13, 17);
    // Linhas 5..13 inteiras e linha 3/4 a partir da coluna 4 ficam abertas.
    for (let l = 5; l <= 13; l++) {
      for (let c = 0; c < COLUNAS; c++) assert.ok(jogo.celulas[l][c].aberta, `(${l},${c})`);
    }
    // A linha 1 está isolada pelas bombas e continua fechada.
    assert.ok(jogo.celulas[1].every((c) => !c.aberta));
    assert.equal(jogo.estado, ESTADO.JOGANDO);
  });

  it('a cascata nunca abre bombas', () => {
    const jogo = new CampoMinado({ bombas: BOMBAS_LISTRAS });
    jogo.abrir(13, 0);
    assert.ok(jogo.celulas.flat().every((c) => !(c.bomba && c.aberta)));
  });

  it('abrir uma célula já aberta não muda nada', () => {
    const jogo = new CampoMinado({ bombas: BOMBAS_LISTRAS });
    jogo.abrir(1, 5);
    const antes = jogo.paraTexto();
    jogo.abrir(1, 5);
    assert.equal(jogo.paraTexto(), antes);
  });

  it('posição fora do tabuleiro gera erro', () => {
    const jogo = new CampoMinado({ bombas: BOMBAS_CANTO });
    assert.throws(() => jogo.abrir(-1, 0), RangeError);
    assert.throws(() => jogo.abrir(0, 18), RangeError);
    assert.throws(() => jogo.abrir(14, 0), RangeError);
    assert.throws(() => jogo.abrir(1.5, 0), RangeError);
  });
});

describe('Bandeiras', () => {
  it('coloca e retira bandeira', () => {
    const jogo = new CampoMinado({ bombas: BOMBAS_CANTO });
    assert.equal(jogo.alternarBandeira(0, 0), true);
    assert.equal(jogo.bandeirasRestantes(), 39);
    assert.equal(jogo.alternarBandeira(0, 0), false);
    assert.equal(jogo.bandeirasRestantes(), 40);
  });

  it('célula com bandeira não pode ser aberta', () => {
    const jogo = new CampoMinado({ bombas: BOMBAS_CANTO });
    jogo.alternarBandeira(10, 8); // bomba
    assert.equal(jogo.abrir(10, 8), ESTADO.JOGANDO);
    assert.equal(jogo.celulas[10][8].aberta, false);
  });

  it('não é possível colocar bandeira em célula aberta', () => {
    const jogo = new CampoMinado({ bombas: BOMBAS_LISTRAS });
    jogo.abrir(1, 5);
    assert.equal(jogo.alternarBandeira(1, 5), false);
    assert.equal(jogo.celulas[1][5].bandeira, false);
  });

  it('a cascata não abre células com bandeira', () => {
    const jogo = new CampoMinado({ bombas: BOMBAS_LISTRAS });
    jogo.alternarBandeira(8, 8);
    jogo.abrir(13, 17);
    assert.equal(jogo.celulas[8][8].aberta, false);
    assert.equal(jogo.celulas[8][8].bandeira, true);
  });
});

describe('Fim de jogo', () => {
  it('abrir uma bomba resulta em derrota', () => {
    const jogo = new CampoMinado({ bombas: BOMBAS_CANTO });
    assert.equal(jogo.abrir(12, 12), ESTADO.DERROTA);
    assert.equal(jogo.estado, ESTADO.DERROTA);
  });

  it('após a derrota nenhuma jogada é aceita', () => {
    const jogo = new CampoMinado({ bombas: BOMBAS_CANTO });
    jogo.abrir(12, 12);
    jogo.abrir(0, 0);
    assert.equal(jogo.celulas[0][0].aberta, false);
    assert.equal(jogo.alternarBandeira(0, 0), false);
  });

  it('abrir todas as células sem bomba resulta em vitória', () => {
    const jogo = new CampoMinado({ bombas: BOMBAS_CANTO });
    // Com as bombas agrupadas, um clique no canto oposto abre todas as 212 células livres.
    assert.equal(jogo.abrir(0, 0), ESTADO.VITORIA);
    assert.equal(jogo.celulasFechadasSemBomba(), 0);
  });

  it('vitória também pode vir de várias jogadas', () => {
    const jogo = new CampoMinado({ bombas: BOMBAS_LISTRAS });
    for (let l = 0; l < LINHAS; l++) {
      for (let c = 0; c < COLUNAS; c++) {
        if (!jogo.celulas[l][c].bomba) jogo.abrir(l, c);
      }
    }
    assert.equal(jogo.estado, ESTADO.VITORIA);
  });

  it('após a vitória nenhuma jogada é aceita', () => {
    const jogo = new CampoMinado({ bombas: BOMBAS_CANTO });
    jogo.abrir(0, 0);
    assert.equal(jogo.abrir(10, 8), ESTADO.VITORIA);
    assert.equal(jogo.celulas[10][8].aberta, false);
  });
});

describe('Representação em texto', () => {
  it('mostra fechadas (#), bandeira (F), números e bomba (*)', () => {
    const jogo = new CampoMinado({ bombas: BOMBAS_LISTRAS });
    jogo.alternarBandeira(0, 0);
    jogo.abrir(1, 5);
    jogo.abrir(0, 1);
    const linhas = jogo.paraTexto().split('\n');
    assert.equal(linhas.length, 14);
    assert.equal(linhas[0].slice(0, 3), 'F*#');
    assert.equal(linhas[1][5], '6');
  });
});
