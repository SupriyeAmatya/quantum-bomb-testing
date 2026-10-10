// Normal web page entry (python -m http.server, GitHub Pages): load the data files with fetch().
import { startGame } from './game.js';

const getJSON = url => fetch(url).then(r => { if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`); return r.json(); });

startGame(document.getElementById('trqbt-app'), {
  loadPools: () => getJSON('pools.json'),
  loadNoise: () => getJSON('noise_results.json'),
});
