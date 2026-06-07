import { action, makeAutoObservable, observable, runInAction } from "mobx"
import { getLocale, LangKey } from 'i18n'
import { db } from 'utils/db'


export declare namespace StoreBlobs {
  export interface ImageBlob {
    blob: Blob
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

const formatBlobItem = async (blob: Blob) => {
  const blobURL = URL.createObjectURL(blob)

  const originImage = await getImageWithBlobURL(blobURL)

  const canvas = document.createElement("canvas")
  if (originImage.width < originImage.height) {
    canvas.width = originImage.width / originImage.height * 200
    canvas.height = 200
  } else if (originImage.width > originImage.height) {
    canvas.width = 200
    canvas.height = originImage.height / originImage.width * 200
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

  const item: StoreBlobs.ImageBlob = {
    blob,
    blobURL,
    thumbnailURL: URL.createObjectURL(thumbnailBlob),
    width: originImage.width,
    height: originImage.height
  }

  originImage.src = ''

  return item
}

class Store {
  @observable blobs: ({[id: string]: StoreBlobs.ImageBlob}) = {}

  constructor() {
    makeAutoObservable(this)
  }

  @action
  delete(uuid: string) {
    const item = this.blobs[uuid]
    if (item) {
      URL.revokeObjectURL(item.blobURL)
      URL.revokeObjectURL(item.thumbnailURL)
      delete this.blobs[uuid]
      db.deleteBlob(uuid).catch(err => console.error('Failed to delete blob from DB:', err))
    }
  }

  @action
  async restoreBlobItem(uuid: string, blob: Blob) {
    try {
      const formatted = await formatBlobItem(blob)
      runInAction(() => {
        this.blobs[uuid] = formatted
      })
    } catch (err) {
      console.error('Failed to restore blob item:', err)
    }
  }

  @action
  async push(blobs: Blob[], uuids: string[], lang?: LangKey) {
    let formatBlobs: StoreBlobs.ImageBlob[] = []

    try {
      formatBlobs = await Promise.all(blobs.map(formatBlobItem))
    } catch (err) {
      console.error(err)
      const errorMsg = lang ? getLocale(lang).alert.error : '错误\nError'
      alert(errorMsg)
      return
    }

    try {
      await Promise.all(
        blobs.map((blob, index) => db.saveBlob(uuids[index], blob))
      )
    } catch (err) {
      console.error('Failed to save blobs to IndexedDB:', err)
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
}

export { Store }
const store = new Store()
export default store