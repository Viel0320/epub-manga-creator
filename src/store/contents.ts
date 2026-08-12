import { makeAutoObservable, toJS } from "mobx"

export interface ContentItem {
  pageIndex: number | null
  title: string
  level: number
}

interface IndexMap { [pageIndex: string]: number }

const cloneState = function(this: Store) {
  return {
    list: toJS(this.list),
    indexMap: toJS(this.indexMap)
  }
}

class Store {
  defaultCoverTitle = '表紙'
  list: ContentItem[] = [{
    pageIndex: 0,
    title: '表紙',
    level: 0
  }]
  indexMap: IndexMap = {
    0: 0
  }
  savedSets: { title: string; list: ContentItem[] }[] = []

  constructor() {
    makeAutoObservable(this)
  }

  setDefaultCoverTitle(title: string) {
    // keep the pristine initial entry in sync with the UI language,
    // but never touch a list the user has already edited
    if (
      this.list.length === 1 &&
      this.list[0].pageIndex === 0 &&
      this.list[0].level === 0 &&
      this.list[0].title === this.defaultCoverTitle
    ) {
      this.list[0].title = title
    }
    this.defaultCoverTitle = title
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

  shiftPageIndices(afterIndex: number, delta: number = 1) {
    const list = toJS(this.list)
    let updated = false
    list.forEach(contentItem => {
      if (contentItem.pageIndex !== null && contentItem.pageIndex > afterIndex) {
        contentItem.pageIndex += delta
        updated = true
      }
    })
    if (updated) {
      this.updateList(list)
    }
  }

  onPageRemoved(removedIndex: number) {
    const list = toJS(this.list)
    list.forEach(contentItem => {
      if (contentItem.pageIndex === null) return
      if (contentItem.pageIndex === removedIndex) {
        contentItem.pageIndex = null
      } else if (contentItem.pageIndex > removedIndex) {
        contentItem.pageIndex--
      }
    })
    this.updateList(list)
  }

  onPageMoved(fromIndex: number, toIndex: number) {
    if (fromIndex === toIndex) return
    const list = toJS(this.list)
    let updated = false
    list.forEach(contentItem => {
      if (contentItem.pageIndex === null) return
      let idx = contentItem.pageIndex
      if (idx === fromIndex) {
        idx = toIndex
        updated = true
      } else if (fromIndex < idx && toIndex >= idx) {
        idx -= 1
        updated = true
      } else if (fromIndex > idx && toIndex <= idx) {
        idx += 1
        updated = true
      }
      contentItem.pageIndex = idx
    })
    if (updated) {
      this.updateList(list)
    }
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
    this.list = [{ pageIndex: 0, title: this.defaultCoverTitle, level: 0 }]
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