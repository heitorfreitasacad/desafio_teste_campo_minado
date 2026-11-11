const { CampoMinado, ESTADO, LINHAS, COLUNAS, BOMBAS } = require('../src/campoMinado');

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
    expect(jogo.celulas.length).toBe(14);
    jogo.celulas.forEach((linha) => expect(linha.length).toBe(18));
    expect(LINHAS * COLUNAS).toBe(252);
  });

  it('possui exatamente 40 bombas', () => {
    expect(BOMBAS).toBe(40);
    expect(new CampoMinado({ bombas: BOMBAS_CANTO }).contarBombas()).toBe(40);
  });

  it('começa com todas as células fechadas e sem bandeiras', () => {
    const jogo = new CampoMinado({ bombas: BOMBAS_CANTO });
    expect(jogo.estado).toBe(ESTADO.JOGANDO);
    expect(jogo.celulas.flat().every((c) => !c.aberta && !c.bandeira)).toBe(true);
    expect(jogo.bandeirasRestantes()).toBe(40);
  });

  it('rejeita quantidade de bombas diferente de 40', () => {
    expect(() => new CampoMinado({ bombas: BOMBAS_CANTO.slice(1) })).toThrow(/40 bombas/);
  });

  it('rejeita bombas repetidas', () => {
    const repetidas = [...BOMBAS_CANTO.slice(1), BOMBAS_CANTO[1]];
    expect(() => new CampoMinado({ bombas: repetidas })).toThrow(/distintas/);
  });

  it('rejeita bombas fora do tabuleiro', () => {
    const fora = [...BOMBAS_CANTO.slice(1), [14, 0]];
    expect(() => new CampoMinado({ bombas: fora })).toThrow(RangeError);
  });
});

describe('Sorteio das bombas', () => {
  it('sorteia 40 bombas somente após a primeira jogada', () => {
    const jogo = new CampoMinado({ aleatorio: semente(1) });
    expect(jogo.contarBombas()).toBe(0);
    jogo.abrir(7, 9);
    expect(jogo.contarBombas()).toBe(40);
  });

  it('a primeira jogada nunca é bomba e sempre abre uma área (100 partidas)', () => {
    for (let s = 1; s <= 100; s++) {
      const jogo = new CampoMinado({ aleatorio: semente(s) });
      const l = s % LINHAS;
      const c = (s * 7) % COLUNAS;
      expect(jogo.abrir(l, c)).not.toBe(ESTADO.DERROTA);
      expect(jogo.celulas[l][c].vizinhas).toBe(0);
      for (const [vl, vc] of jogo.vizinhos(l, c)) {
        expect(jogo.celulas[vl][vc].bomba).toBe(false);
      }
    }
  });

  it('a mesma semente gera o mesmo tabuleiro', () => {
    const a = new CampoMinado({ aleatorio: semente(42) });
    const b = new CampoMinado({ aleatorio: semente(42) });
    a.abrir(0, 0);
    b.abrir(0, 0);
    const bombasDe = (jogo) => jogo.celulas.map((l) => l.map((c) => c.bomba));
    expect(bombasDe(a)).toEqual(bombasDe(b));
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
      expect(jogo.celulas[l][c].vizinhas).toBe(esperado);
    });
  }

  it('canto tem 3 vizinhos, borda 5 e meio 8', () => {
    expect(jogo.vizinhos(0, 0).length).toBe(3);
    expect(jogo.vizinhos(0, 5).length).toBe(5);
    expect(jogo.vizinhos(6, 6).length).toBe(8);
  });
});

describe('Abrir células', () => {
  it('abrir célula numerada abre somente ela', () => {
    const jogo = new CampoMinado({ bombas: BOMBAS_LISTRAS });
    jogo.abrir(1, 5);
    expect(jogo.celulas.flat().filter((c) => c.aberta).length).toBe(1);
    expect(jogo.estado).toBe(ESTADO.JOGANDO);
  });

  it('abrir célula vazia abre a região em cascata (flood fill)', () => {
    const jogo = new CampoMinado({ bombas: BOMBAS_LISTRAS });
    jogo.abrir(13, 17);
    // Linhas 5..13 inteiras e linha 3/4 a partir da coluna 4 ficam abertas.
    for (let l = 5; l <= 13; l++) {
      for (let c = 0; c < COLUNAS; c++) expect(jogo.celulas[l][c].aberta).toBe(true);
    }
    // A linha 1 está isolada pelas bombas e continua fechada.
    expect(jogo.celulas[1].every((c) => !c.aberta)).toBe(true);
    expect(jogo.estado).toBe(ESTADO.JOGANDO);
  });

  it('a cascata nunca abre bombas', () => {
    const jogo = new CampoMinado({ bombas: BOMBAS_LISTRAS });
    jogo.abrir(13, 0);
    expect(jogo.celulas.flat().every((c) => !(c.bomba && c.aberta))).toBe(true);
  });

  it('abrir uma célula já aberta não muda nada', () => {
    const jogo = new CampoMinado({ bombas: BOMBAS_LISTRAS });
    jogo.abrir(1, 5);
    const antes = jogo.paraTexto();
    jogo.abrir(1, 5);
    expect(jogo.paraTexto()).toBe(antes);
  });

  it('posição fora do tabuleiro gera erro', () => {
    const jogo = new CampoMinado({ bombas: BOMBAS_CANTO });
    expect(() => jogo.abrir(-1, 0)).toThrow(RangeError);
    expect(() => jogo.abrir(0, 18)).toThrow(RangeError);
    expect(() => jogo.abrir(14, 0)).toThrow(RangeError);
    expect(() => jogo.abrir(1.5, 0)).toThrow(RangeError);
  });
});

describe('Bandeiras', () => {
  it('coloca e retira bandeira', () => {
    const jogo = new CampoMinado({ bombas: BOMBAS_CANTO });
    expect(jogo.alternarBandeira(0, 0)).toBe(true);
    expect(jogo.bandeirasRestantes()).toBe(39);
    expect(jogo.alternarBandeira(0, 0)).toBe(false);
    expect(jogo.bandeirasRestantes()).toBe(40);
  });

  it('célula com bandeira não pode ser aberta', () => {
    const jogo = new CampoMinado({ bombas: BOMBAS_CANTO });
    jogo.alternarBandeira(10, 8); // bomba
    expect(jogo.abrir(10, 8)).toBe(ESTADO.JOGANDO);
    expect(jogo.celulas[10][8].aberta).toBe(false);
  });

  it('não é possível colocar bandeira em célula aberta', () => {
    const jogo = new CampoMinado({ bombas: BOMBAS_LISTRAS });
    jogo.abrir(1, 5);
    expect(jogo.alternarBandeira(1, 5)).toBe(false);
    expect(jogo.celulas[1][5].bandeira).toBe(false);
  });

  it('a cascata não abre células com bandeira', () => {
    const jogo = new CampoMinado({ bombas: BOMBAS_LISTRAS });
    jogo.alternarBandeira(8, 8);
    jogo.abrir(13, 17);
    expect(jogo.celulas[8][8].aberta).toBe(false);
    expect(jogo.celulas[8][8].bandeira).toBe(true);
  });
});

describe('Fim de jogo', () => {
  it('abrir uma bomba resulta em derrota', () => {
    const jogo = new CampoMinado({ bombas: BOMBAS_CANTO });
    expect(jogo.abrir(12, 12)).toBe(ESTADO.DERROTA);
    expect(jogo.estado).toBe(ESTADO.DERROTA);
  });

  it('após a derrota nenhuma jogada é aceita', () => {
    const jogo = new CampoMinado({ bombas: BOMBAS_CANTO });
    jogo.abrir(12, 12);
    jogo.abrir(0, 0);
    expect(jogo.celulas[0][0].aberta).toBe(false);
    expect(jogo.alternarBandeira(0, 0)).toBe(false);
  });

  it('abrir todas as células sem bomba resulta em vitória', () => {
    const jogo = new CampoMinado({ bombas: BOMBAS_CANTO });
    // Com as bombas agrupadas, um clique no canto oposto abre todas as 212 células livres.
    expect(jogo.abrir(0, 0)).toBe(ESTADO.VITORIA);
    expect(jogo.celulasFechadasSemBomba()).toBe(0);
  });

  it('vitória também pode vir de várias jogadas', () => {
    const jogo = new CampoMinado({ bombas: BOMBAS_LISTRAS });
    for (let l = 0; l < LINHAS; l++) {
      for (let c = 0; c < COLUNAS; c++) {
        if (!jogo.celulas[l][c].bomba) jogo.abrir(l, c);
      }
    }
    expect(jogo.estado).toBe(ESTADO.VITORIA);
  });

  it('após a vitória nenhuma jogada é aceita', () => {
    const jogo = new CampoMinado({ bombas: BOMBAS_CANTO });
    jogo.abrir(0, 0);
    expect(jogo.abrir(10, 8)).toBe(ESTADO.VITORIA);
    expect(jogo.celulas[10][8].aberta).toBe(false);
  });
});

describe('Representação em texto', () => {
  it('mostra fechadas (#), bandeira (F), números e bomba (*)', () => {
    const jogo = new CampoMinado({ bombas: BOMBAS_LISTRAS });
    jogo.alternarBandeira(0, 0);
    jogo.abrir(1, 5);
    jogo.abrir(0, 1);
    const linhas = jogo.paraTexto().split('\n');
    expect(linhas.length).toBe(14);
    expect(linhas[0].slice(0, 3)).toBe('F*#');
    expect(linhas[1][5]).toBe('6');
  });
});
