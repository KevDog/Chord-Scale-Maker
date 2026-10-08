let context: CanvasRenderingContext2D | null | undefined

/** the width text takes in a CSS font ("14px Inter"), measured on a canvas; a rough estimate where there's none */
export function textWidth(text: string, font: string): number {
  if (context === undefined) context = typeof document === 'undefined' ? null : document.createElement('canvas').getContext('2d')
  if (!context) return text.length * (Number.parseFloat(font) || 14) * 0.55
  context.font = font
  return context.measureText(text).width
}
