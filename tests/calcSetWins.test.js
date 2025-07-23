import { calcSetWins } from '../content.js';

describe('calcSetWins', () => {
  test('подсчет для матчей разной длины', () => {
    const games = [
      { pts: [[11,5], [11,9], [11,7]] },              // чистая победа в 3 сета
      { pts: [[9,11], [11,8], [7,11], [11,6]] },       // 4 сета
      { pts: [[11,4], [11,6], [11,3], [11,2], [11,9]]} // 5 сетов
    ];
    const result = calcSetWins(games);
    expect(result).toEqual({
      set1: ['2/3','1/3'],
      set2: ['3/3','0/3'],
      set3: ['2/3','1/3'],
      set4: ['1/2','1/2'],
      set5: ['1/1','0/1']
    });
  });
});
