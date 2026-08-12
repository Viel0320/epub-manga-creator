import { makeAutoObservable, runInAction } from "mobx"

export declare namespace StoreBlobs {
  export interface ImageBlob {
    blob: Blob
    name: string
    blobURL: string
    thumbnailURL: string
    width: number
    height: number
  }
}

export const getImageWithBlobURL = (blobURL: string): Promise<HTMLImageElement> => new Promise<HTMLImageElement>((resolve, reject) => {
  const image = new Image()
  image.onerror = (e) => reject(e)
  image.onload = (e) => {
    resolve(image)
  }
  image.src = blobURL
})

export const formatBlobItem = async (blob: Blob): Promise<StoreBlobs.ImageBlob> => {
  const blobURL = URL.createObjectURL(blob)

  try {
    let width: number
    let height: number
    let imgSource: CanvasImageSource

    if (typeof createImageBitmap === 'function') {
      const bitmap = await createImageBitmap(blob)
      width = bitmap.width
      height = bitmap.height
      imgSource = bitmap
    } else {
      const originImage = await getImageWithBlobURL(blobURL)
      width = originImage.width
      height = originImage.height
      imgSource = originImage
    }

    const canvas = document.createElement("canvas")
    if (width < height) {
      canvas.width = (width / height) * 200
      canvas.height = 200
    } else if (width > height) {
      canvas.width = 200
      canvas.height = (height / width) * 200
    } else {
      canvas.width = 200
      canvas.height = 200
    }

    const context = canvas.getContext('2d') as CanvasRenderingContext2D
    context.imageSmoothingQuality = 'high'
    context.drawImage(imgSource, 0, 0, canvas.width, canvas.height)

    if (typeof ImageBitmap !== 'undefined' && imgSource instanceof ImageBitmap) {
      imgSource.close()
    }

    const thumbnailBlob = await new Promise<Blob>(
      (resolve, reject) => canvas.toBlob(
        resultBlob => resultBlob ? resolve(resultBlob) : reject(new Error('canvas.toBlob returned null'))
      )
    )

    const name = (blob as File).name || ''

    return {
      blob,
      name,
      blobURL,
      thumbnailURL: URL.createObjectURL(thumbnailBlob),
      width,
      height
    }
  } catch (err) {
    // avoid leaking the object URL when decoding fails
    URL.revokeObjectURL(blobURL)
    throw err
  }
}

export interface PushResult {
  succeededIDs: string[]
  failedCount: number
}

class Store {
  blobs: ({[id: string]: StoreBlobs.ImageBlob}) = {}

  constructor() {
    makeAutoObservable(this)
  }

  async push(blobs: Blob[], uuids: string[]): Promise<PushResult> {
    const settled = await Promise.allSettled(blobs.map(formatBlobItem))

    const formatted: ({[id: string]: StoreBlobs.ImageBlob}) = {}
    const succeededIDs: string[] = []
    let failedCount = 0

    settled.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        formatted[uuids[index]] = result.value
        succeededIDs.push(uuids[index])
      } else {
        failedCount++
        console.error('Failed to format blob item:', result.reason)
      }
    })

    if (succeededIDs.length > 0) {
      runInAction(() => {
        this.blobs = {
          ...this.blobs,
          ...formatted
        }
      })
    }

    return { succeededIDs, failedCount }
  }

  remove(uuid: string) {
    const item = this.blobs[uuid]
    if (!item) {
      return
    }

    try {
      URL.revokeObjectURL(item.blobURL)
      URL.revokeObjectURL(item.thumbnailURL)
    } catch {
      // ignore
    }

    const next = { ...this.blobs }
    delete next[uuid]
    this.blobs = next
  }

  clear() {
    Object.values(this.blobs).forEach(item => {
      try {
        URL.revokeObjectURL(item.blobURL)
        URL.revokeObjectURL(item.thumbnailURL)
      } catch {
        // ignore
      }
    })
    this.blobs = {}
  }
}

export { Store }
const store = new Store();
export default store;