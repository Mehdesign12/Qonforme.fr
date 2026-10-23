/**
 * Traitement d'une photo de document dans le navigateur : remise d'aplomb
 * (l'orientation EXIF de l'appareil est appliquée une fois pour toutes, le canvas
 * n'en produit plus), rotation, recadrage et filtre, puis JPEG de poids
 * raisonnable (une page tient bien sous la limite de 4,5 Mo des fonctions
 * serveur). Le serveur recontrôle et recompresse tout en WebP.
 *
 * Navigateur seulement (canvas) ; la géométrie et les filtres, purs et testés,
 * vivent dans geometry.ts et filters.ts.
 */
import { applyFilter, type ScanFilter } from "@/lib/scan/filters"
import { cropRect, fitWithin, type Crop } from "@/lib/scan/geometry"

/** Grand côté d'une page gardée en mémoire pendant la retouche. */
export const WORKING_MAX_SIDE = 2400
/** Grand côté d'une page envoyée : 2 000 px lisent un texte de 8 pt sur une page A4. */
export const UPLOAD_MAX_SIDE = 2000

export interface LoadedImage { img: HTMLImageElement; width: number; height: number }

export function loadImage(blob: Blob): Promise<LoadedImage> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      // naturalWidth tient compte de l'orientation EXIF dans les navigateurs récents
      resolve({ img, width: img.naturalWidth, height: img.naturalHeight })
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error("Cette image n'a pas pu être lue. Utilisez une photo JPEG, PNG ou WebP."))
    }
    img.src = url
  })
}

function toBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("L'image n'a pas pu être préparée."))), "image/jpeg", quality)
  })
}

function makeCanvas(width: number, height: number): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext("2d", { willReadFrequently: true })
  if (!ctx) throw new Error("Le traitement d'image n'est pas disponible sur cet appareil.")
  return { canvas, ctx }
}

/** Photo ou fichier importé → JPEG d'aplomb de 2 400 px au plus. */
export async function normalizeBlob(blob: Blob): Promise<{ blob: Blob; width: number; height: number }> {
  const { img, width, height } = await loadImage(blob)
  const size = fitWithin(width, height, WORKING_MAX_SIDE)
  const { canvas, ctx } = makeCanvas(size.width, size.height)
  ctx.drawImage(img, 0, 0, size.width, size.height)
  return { blob: await toBlob(canvas, 0.92), ...size }
}

/** Tourne l'image d'un quart de tour dans le sens des aiguilles d'une montre. */
export async function rotateBlob(blob: Blob): Promise<{ blob: Blob; width: number; height: number }> {
  const { img, width, height } = await loadImage(blob)
  const { canvas, ctx } = makeCanvas(height, width)
  ctx.translate(height, 0)
  ctx.rotate(Math.PI / 2)
  ctx.drawImage(img, 0, 0)
  return { blob: await toBlob(canvas, 0.92), width: height, height: width }
}

/** Image finale d'une page : recadrage puis filtre, JPEG de 2 000 px au plus. */
export async function renderPage(blob: Blob, opts: { crop: Crop; filter: ScanFilter; maxSide?: number; quality?: number }): Promise<Blob> {
  const { img, width, height } = await loadImage(blob)
  const { sx, sy, sw, sh } = cropRect(opts.crop, width, height)
  const size = fitWithin(sw, sh, opts.maxSide ?? UPLOAD_MAX_SIDE)
  const { canvas, ctx } = makeCanvas(size.width, size.height)
  ctx.fillStyle = "#fff"
  ctx.fillRect(0, 0, size.width, size.height)
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, size.width, size.height)
  if (opts.filter !== "original") {
    const data = ctx.getImageData(0, 0, size.width, size.height)
    applyFilter(data.data, opts.filter)
    ctx.putImageData(data, 0, 0)
  }
  return toBlob(canvas, opts.quality ?? 0.82)
}
