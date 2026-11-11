# desafio_teste_campo_minado

Casos de teste em JavaScript (Jest) para testar um **Campo Minado** em JavaScript.

Este repositório tem **só os testes**. O jogo deve ser implementado a partir da especificação abaixo e precisa passar em todos os casos de teste.

## Colaboradores

- Heitor Henrique Scramim de Freitas | RA: 24190382-2

## Especificação do desafio

Campo minado com tabuleiro de **18 colunas x 14 linhas** (252 células) e **40 bombas**.

### Regras do jogo

1. O tabuleiro começa com todas as células fechadas e sem bandeiras.
2. Cada célula sem bomba guarda quantas bombas existem entre suas vizinhas, incluindo as diagonais. Uma célula de canto tem 3 vizinhas, uma de borda tem 5 e uma do meio tem 8.
3. **Bombas aleatórias só são sorteadas na primeira jogada.** A célula clicada e todas as suas vizinhas nunca recebem bomba, então a primeira jogada sempre abre uma área sem bombas por perto.
4. Ao abrir uma célula com 0 bombas vizinhas, as vizinhas são abertas em cascata (flood fill). A cascata nunca abre bombas nem células com bandeira.
5. Abrir uma célula com número abre só ela.
6. Uma célula com bandeira não pode ser aberta. Não é possível colocar bandeira numa célula já aberta.
7. Abrir uma bomba resulta em **derrota**. A bomba fica marcada como aberta.
8. Abrir todas as 212 células sem bomba resulta em **vitória**.
9. Depois de vitória ou derrota, nenhuma jogada é aceita: abrir não muda nada e colocar bandeira retorna `false`.
10. Abrir uma célula já aberta não muda nada.

### Contrato da implementação

Os testes importam o jogo de **`src/campoMinado.js`** com `require('../src/campoMinado')`. O arquivo deve usar CommonJS e exportar:

```js
const COLUNAS = 18;
const LINHAS = 14;
const BOMBAS = 40;
const ESTADO = { JOGANDO: 'jogando', VITORIA: 'vitoria', DERROTA: 'derrota' };
class CampoMinado { ... }

module.exports = { CampoMinado, ESTADO, LINHAS, COLUNAS, BOMBAS };
```

#### `new CampoMinado(opcoes?)`

| Opção | Tipo | Descrição |
|-------|------|-----------|
| `bombas` | `Array<[linha, coluna]>` | Posições fixas das bombas. Quando informado, as bombas já ficam posicionadas e não há sorteio. |
| `aleatorio` | `() => number` | Gerador de números em [0, 1), usado no sorteio. Padrão: `Math.random`. Com o mesmo gerador, o tabuleiro sorteado deve ser o mesmo. |

Validação de `bombas`:
- Quantidade diferente de 40: lança `Error` com mensagem contendo `"40 bombas"`.
- Posições repetidas: lança `Error` com mensagem contendo `"distintas"`.
- Posição fora do tabuleiro: lança `RangeError`.

#### Propriedades

| Propriedade | Descrição |
|-------------|-----------|
| `estado` | Um dos valores de `ESTADO`. Começa em `'jogando'`. |
| `celulas` | Matriz `[linha][coluna]` com 14 linhas de 18 células. Cada célula é `{ bomba, aberta, bandeira, vizinhas }`: três booleanos e um número de 0 a 8. |

#### Métodos

| Método | Retorno | Descrição |
|--------|---------|-----------|
| `abrir(linha, coluna)` | `string` | Abre a célula seguindo as regras e retorna o `estado` depois da jogada. |
| `alternarBandeira(linha, coluna)` | `boolean` | Coloca ou retira a bandeira. Retorna `true` se a célula ficou com bandeira e `false` caso contrário (bandeira retirada, célula aberta ou jogo encerrado). |
| `bandeirasRestantes()` | `number` | 40 menos a quantidade de bandeiras colocadas. |
| `celulasFechadasSemBomba()` | `number` | Quantidade de células sem bomba ainda fechadas. |
| `contarBombas()` | `number` | Quantidade de bombas no tabuleiro. É 0 antes do sorteio e 40 depois. |
| `vizinhos(linha, coluna)` | `Array<[l, c]>` | Posições vizinhas que estão dentro do tabuleiro. |
| `paraTexto()` | `string` | 14 linhas separadas por `\n`, com 18 caracteres cada. |

`abrir` e `alternarBandeira` lançam `RangeError` para posição fora do tabuleiro ou não inteira, por exemplo `(-1, 0)`, `(14, 0)`, `(0, 18)` ou `(1.5, 0)`.

Símbolos de `paraTexto()`:

| Símbolo | Significado |
|---------|-------------|
| `#` | célula fechada |
| `F` | bandeira |
| `*` | bomba aberta |
| `.` | aberta, sem bombas vizinhas |
| `1`–`8` | aberta, quantidade de bombas vizinhas |

## Casos de teste

Os testes usam o [Jest](https://jestjs.io/) (`describe`, `it` e `expect`).

### Como rodar

Requer Node.js 18 ou mais recente. Com a implementação em `src/campoMinado.js`, instale as dependências e rode os testes:

```bash
npm install
```

```bash
npm test
```

### Como funcionam

Os testes ficam em `test/campoMinado.test.js` e usam dois tabuleiros fixos de 40 bombas:

- **CANTO**: bloco de bombas nas linhas 10–13, colunas 8–17. Um clique em (0, 0) abre todo o resto e vence o jogo.
- **LISTRAS**: linhas 0 e 2 cheias de bombas, mais 4 bombas na linha 4 (colunas 0–3). Isso gera contagens de vizinhas conhecidas (4, 6, 3, 2, 1, 0).

Para o sorteio, os testes usam um gerador com semente (mulberry32), então os resultados são sempre os mesmos.

| Grupo | O que verifica |
|-------|----------------|
| Configuração do tabuleiro | 14 x 18, 40 bombas, estado inicial, recusa de 39 bombas, bombas repetidas e bombas fora do tabuleiro |
| Sorteio das bombas | bombas só depois da 1ª jogada, 1ª jogada segura em 100 partidas, mesma semente gera o mesmo tabuleiro |
| Contagem de vizinhas | valores esperados no canto, na borda e no meio; quantidade de vizinhos (3, 5 e 8) |
| Abrir células | célula numerada abre só ela, cascata, cascata nunca abre bomba, reabrir não muda nada, posição inválida |
| Bandeiras | colocar e retirar, bandeira bloqueia abertura, não vai em célula aberta, cascata respeita bandeira |
| Fim de jogo | derrota, vitória com um clique, vitória com várias jogadas, nada muda depois do fim |
| Representação em texto | símbolos `#`, `F`, `*` e números |

São 33 casos de teste. Uma implementação correta deve terminar com `Tests: 33 passed, 33 total`.
