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

  const originImage = await getImageWithBlobURL(blobURL)
  const width = originImage.width
  const height = originImage.height

  const canvas = document.createElement("canvas")
  if (width < height) {
    canvas.width = width / height * 200
    canvas.height = 200
  } else if (width > height) {
    canvas.width = 200
    canvas.height = height / width * 200
  } else {
    canvas.width = 200
    canvas.height = 200
  }

  const context = canvas.getContext('2d') as CanvasRenderingContext2D
  context.imageSmoothingQuality = 'high'
  context.drawImage(originImage, 0, 0, canvas.width, canvas.height)

  const thumbnailBlob = await new Promise<Blob>(
    (resolve, reject) => canvas.toBlob(
      blob => blob ? resolve(blob) : reject()
    )
  )

  const name = (blob as File).name || ''

  const item: StoreBlobs.ImageBlob = {
    blob,
    name,
    blobURL,
    thumbnailURL: URL.createObjectURL(thumbnailBlob),
    width,
    height
  }

  return item
}

class Store {
  blobs: ({[id: string]: StoreBlobs.ImageBlob}) = {}

  constructor() {
    makeAutoObservable(this)
  }

  async push(blobs: Blob[], uuids: string[]) {
    let formatBlobs: StoreBlobs.ImageBlob[] = []

    try {
      formatBlobs = await Promise.all(blobs.map(formatBlobItem))
    } catch (err) {
      console.error('Failed to format blob items:', err)
      throw err
    }

    runInAction(() => {
      const blobs: ({[id: string]: StoreBlobs.ImageBlob}) = {}

      uuids.forEach((uuid, index) => {
        blobs[uuid] = formatBlobs[index]
      })

      // Object.assign(this.blobs, blobs)
      this.blobs = {
        ...this.blobs,
        ...blobs
      }
    })
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