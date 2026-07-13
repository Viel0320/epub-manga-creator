import { makeAutoObservable, toJS } from "mobx"

interface ContentItem {
  pageIndex: number | null
  title: string
}

interface IndexMap { [pageIndex: string]: number }

const cloneState = function(this: Store) {
  return {
    list: toJS(this.list),
    indexMap: toJS(this.indexMap)
  }
}

class Store {
  list: ContentItem[] = [{
    pageIndex: 0,
    title: '表紙'
  }]
  indexMap: IndexMap = {
     0: 0
  }
  savedSets: { title: string; list: ContentItem[] }[] = []

  constructor() {
    makeAutoObservable(this)
  }

  removeTitle(listIndex: number) {
    const { list, indexMap } = cloneState.call(this)

    if (list.length === 1) {
      return
    }

    const item = list[listIndex]

    list.splice(listIndex, 1)
    if (item.pageIndex !== null && (item.pageIndex in indexMap)) {
      delete indexMap[item.pageIndex]
    }

    this.list = list
    this.indexMap = indexMap
  }

  updateList(contentItems: ContentItem[]) {
    const indexMap: IndexMap = {}

    contentItems.forEach((item, index) => {
      if (item.pageIndex !== null) {
        indexMap[item.pageIndex] = index
      }
    })

    this.list = contentItems
    this.indexMap = indexMap
  }

  setPageIndexToTitle(listIndex: number, pageIndex: number) {
    const { list, indexMap } = cloneState.call(this)

    if (indexMap[pageIndex] === listIndex) {
      return
    }

    const newIndexMap: IndexMap = {}
    const originListIndex = pageIndex in indexMap ? indexMap[pageIndex] : null

    if (originListIndex !== null) {
      list[originListIndex].pageIndex = null
    }

    list[listIndex].pageIndex = pageIndex

    list.forEach((contentItem: ContentItem, index: number) => {
      if (contentItem.pageIndex !== null) {
        newIndexMap[contentItem.pageIndex] = index
      }
    })

    this.list = list
    this.indexMap = newIndexMap
  }

  removePageIndex(listIndex: number) {
    const { list, indexMap } = cloneState.call(this)

    const item = list[listIndex]
    if (item.pageIndex !== null) {
      delete indexMap[item.pageIndex]
    }
    item.pageIndex = null

    this.list = list
    this.indexMap = indexMap
  }

  reset() {
    this.list = [{ pageIndex: 0, title: '表紙' }]
    this.indexMap = { 0: 0 }
  }

  saveSet(title: string) {
    this.savedSets.push({
      title,
      list: toJS(this.list)
    })
  }

  removeSet(index: number) {
    const savedSets = toJS(this.savedSets)
    savedSets.splice(index, 1)
    this.savedSets = savedSets
  }
}

export default Store