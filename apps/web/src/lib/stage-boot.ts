/** Pages that are not part of the city show no stage. */
export const STAGE_EXCLUDED = /^(?:\/(?:ar|en))?\/(?:for-business|search)(?:\/|$)/;

export function stageAllowed(pathname: string): boolean {
  return !STAGE_EXCLUDED.test(pathname);
}

/**
 * Runs in <head> before the first paint, so the desktop split layout never shifts the page. It
 * marks a device that can draw the stage (WebGL2 and workers, no data saver) and whether this path
 * shows it. It asks the GPU for a real WebGL2 context (then releases it), so a device that has the
 * API but refuses a context stays the plain list from the first paint, with no layout to undo
 * (controller ruling 9). Only a later failure (tiles, style) hands the city back after the split.
 */
export function stageBootScript(): string {
  return `(function(){try{var d=document.documentElement,n=navigator;if(!window.WebGL2RenderingContext||typeof Worker!=="function"||(n.connection&&n.connection.saveData))return;var g=document.createElement("canvas").getContext("webgl2");if(!g)return;var l=g.getExtension("WEBGL_lose_context");if(l)l.loseContext();d.setAttribute("data-stage-capable","");d.setAttribute("data-stage",new RegExp(${JSON.stringify(STAGE_EXCLUDED.source)}).test(location.pathname)?"off":"on")}catch(e){}})();`;
}
