// Compress image to 1200px WebP at 85% quality; fallback to JPEG if WebP fails
export async function compressImage(blob: Blob): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      const MAX = 1200
      let { width, height } = img
      if (width > MAX || height > MAX) {
        if (width > height) { height = Math.round(height * MAX / width); width = MAX }
        else { width = Math.round(width * MAX / height); height = MAX }
      }
      const canvas = document.createElement('canvas')
      canvas.width = width; canvas.height = height
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0, width, height)
      // try WebP first, fall back to JPEG
      canvas.toBlob(b => {
        if (b) { resolve(b); return }
        canvas.toBlob(b2 => b2 ? resolve(b2) : reject(new Error('压缩失败')), 'image/jpeg', 0.88)
      }, 'image/webp', 0.85)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('图片加载失败'))
    }
    img.src = url
  })
}

// Extract files from a ZIP, return Map<lowercased-filename, Blob>
export async function extractZip(file: File): Promise<Map<string, Blob>> {
  const JSZip = (await import('jszip')).default
  const zip = await JSZip.loadAsync(file)
  const map = new Map<string, Blob>()
  const IMAGE_EXT = /\.(jpe?g|png|webp|gif|bmp)$/i
  await Promise.all(
    Object.values(zip.files)
      .filter(f => !f.dir && IMAGE_EXT.test(f.name) && !f.name.split('/').pop()!.startsWith('._'))
      .map(async f => {
        const blob = await f.async('blob')
        const basename = f.name.split('/').pop()!.toLowerCase()
        map.set(basename, blob)
      })
  )
  return map
}

// Strip extension → barcode key (e.g. "8001234567.jpg" → "8001234567")
export function barcodeKey(filename: string): string {
  return filename.replace(/\.[^.]+$/, '').toLowerCase().trim()
}
