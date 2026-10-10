// Qollab entry. Qollab shows index.html as the page and runs this file.
// JS on Qollab can't read project files, so shipped_data.py reads them in Python and hands them over.
import * as shipped from 'shipped_data';
import { startGame } from './game.js';

const fromPython = async fn => {
  const value = fn.callPromising ? await fn.callPromising() : await fn();
  return JSON.parse(String(value));
};

// Wait until Qollab has put index.html on the page.
const appRoot = () => new Promise(resolve => {
  const look = () => { const el = document.getElementById('trqbt-app'); el ? resolve(el) : requestAnimationFrame(look); };
  look();
});

appRoot().then(root => startGame(root, {
  loadPools: () => fromPython(shipped.load_pools),
  loadNoise: () => fromPython(shipped.load_noise),
}));
