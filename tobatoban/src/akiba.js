/* akiba.js — 秋葉原編（あとで本実装に置き換える仮の枠） */
(() => {
  const P = Sim.prototype;
  P.initAkiba = function () { this.stage = 'boss'; this.lanterns = []; };
  P.clampAkiba = function (ox, oz, nx, nz) { return [nx, nz]; };
  P.updateAkibaStage = function () { };
  P.akibaCandySpot = function () { return [0, 5]; };
})();
