/**
 * Pages that are not part of the city show no stage: the landing page, the showroom, pricing,
 * for-business and the legal pages. /search keeps it: results pin the map (M7).
 */
export const STAGE_EXCLUDED =
  /^(?:\/(?:ar|en))?(?:\/?$|\/(?:for-business|showroom|pricing|accessibility|terms|privacy)(?:\/|$))/;

export function stageAllowed(pathname: string): boolean {
  return !STAGE_EXCLUDED.test(pathname);
}

/**
 * Runs in <head> before the first paint, so the desktop split layout never shifts the page. It
 * marks a device that can draw the stage (WebGL2 and workers, no data saver) and whether this path
 * shows it. It asks the GPU for a real WebGL2 context (then releases it), so a device that has the
 * API but refuses a context stays the plain list from the first paint, with no layout to undo
 * (controller ruling 9). Only a later failure (tiles, style) hands the city back after the split.
 * A path without the stage (/for-business) is marked capable without the probe: the
 * stage may still try on a later city page, where a refused context ends in onFail.
 */
export function stageBootScript(): string {
  return `(function(){try{var d=document.documentElement,n=navigator;if(!window.WebGL2RenderingContext||typeof Worker!=="function"||(n.connection&&n.connection.saveData))return;if(new RegExp(${JSON.stringify(STAGE_EXCLUDED.source)}).test(location.pathname)){d.setAttribute("data-stage-capable","");d.setAttribute("data-stage","off");return}var g=document.createElement("canvas").getContext("webgl2");if(!g)return;var l=g.getExtension("WEBGL_lose_context");if(l)l.loseContext();d.setAttribute("data-stage-capable","");d.setAttribute("data-stage","on")}catch(e){}})();`;
}
