// Cast of "The Dancing Plague" (Strasbourg 1518): outfits for the toon renderer (toon.ts).
import { Outfit, SKINS, SKIN } from "./toon";

export const TROFFEA: Outfit = { jacket: "#6b4a3a", dress: "#b8483a", pants: "#5a3b2a", boots: "#4a3426", hat: "coif", skin: SKIN };
export const HUSBAND: Outfit = { jacket: "#5d7a3a", pants: "#6b4f3a", boots: "#4a3426", hat: "beret", cap: "#7a4b2a", moustache: "#5a3b2a", skin: "#f5c9a0" };
export const COUNCIL = (v = 0): Outfit => ({
  jacket: ["#7a2a32", "#2f4f6a", "#5a3a6a", "#7a2a32"][v % 4], dress: "#2a2430", pants: "#2a2430", boots: "#241726", hat: "beret",
  cap: "#1d1b22", chain: true, build: "stout", moustache: v % 2 ? "#cfc8c0" : "#4a3020", skin: SKINS[v % 3],
});
export const DOCTOR = (v = 0): Outfit => ({
  jacket: "#2e3a5c", dress: "#2e3a5c", pants: "#2e3a5c", boots: "#241726", hat: "beret", cap: v % 2 ? "#8c2f3a" : "#b8333a",
  moustache: v % 2 ? undefined : "#7a6a5a", skin: v % 2 ? "#ecd0b6" : SKIN,
});
export const MUSICIAN = (v = 0): Outfit => ({
  jacket: ["#e2b33c", "#c9373a", "#3f6fb5", "#2f8a4f"][v % 4], pants: ["#c9373a", "#2e2a36", "#e2b33c", "#5a3b2a"][v % 4], boots: "#4a3426",
  hat: "beret", cap: ["#2e2a36", "#e2b33c", "#c9373a", "#2e2a36"][v % 4], feather: ["#f4efe2", "#3f6fb5", "#f4efe2", "#e2b33c"][v % 4],
  skin: SKINS[(v + 1) % 4], moustache: v === 1 ? "#4a3020" : undefined,
});
export const PRO = (v = 0): Outfit => v % 2
  ? { jacket: "#c9373a", dress: ["#e05a8a", "#2f8a9a", "#e2a13c"][v % 3], pants: "#5a3b2a", boots: "#c9373a", hat: "coif", skin: SKINS[v % 4] }
  : { jacket: ["#e05a8a", "#2f8a9a", "#e2a13c"][v % 3], pants: "#f4efe2", boots: "#c9373a", hat: "beret", cap: ["#2f8a9a", "#e05a8a", "#c9373a"][v % 3], feather: "#f4efe2", skin: SKINS[(v + 2) % 4] };
export const WORKER = (v = 0): Outfit => ({
  jacket: ["#8a6a4a", "#5d6a7a", "#7a5a3a"][v % 3], pants: "#4a4a52", boots: "#4a3426", apron: "#e6d7b4", hat: v % 2 ? "hair" : "beret",
  hair: "#5a3b2a", cap: "#6b5a4a", skin: SKINS[(v + 1) % 4],
});
/** ordinary 1518 townsfolk: men in tunics and berets, women in dresses and linen coifs */
const COATS = ["#8c3b4a", "#3f6fb5", "#5d7a3a", "#b5653f", "#2f5f6a", "#a8843a", "#6a4a7a"];
const DRESS = ["#5a8fc2", "#8c5a3a", "#6b8f3a", "#a8484a", "#c9a24a", "#4a6a8a"];
const CAPS = ["#2e2a36", "#7a4b2a", "#8c2f3a", "#3a4a5a", "#5a4a3a"];
export const FOLK = (v = 0): Outfit => v % 2
  ? { jacket: ["#6b4a3a", "#4a5a6a", "#7a5a3a"][v % 3], dress: DRESS[v % 6], pants: "#5a3b2a", boots: "#4a3426", hat: "coif", skin: SKINS[v % 4] }
  : { jacket: COATS[v % 7], pants: ["#4a3a2a", "#3b3f52", "#6b4f3a"][v % 3], boots: "#4a3426", hat: v % 6 === 4 ? "hair" : "beret", hair: "#5a3b2a",
      cap: CAPS[v % 5], moustache: v % 4 === 2 ? "#5a3b2a" : undefined, skin: SKINS[v % 4] };
export const FOLKS = Array.from({ length: 12 }, (_, v) => FOLK(v));
/** a weathered stone saint (shot "terrifying legend"): everything stone grey */
export const STATUE: Outfit = { jacket: "#a9a49a", dress: "#9d988e", pants: "#9d988e", boots: "#8e897f", hat: null, skin: "#b4afa5", moustache: undefined };
export const KIDF: Outfit = { jacket: "#e2a13c", pants: "#5a3b2a", boots: "#4a3426", hat: "hair", hair: "#7a4b2a", build: "kid" };
