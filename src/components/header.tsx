import React from 'react'
import { observer } from 'mobx-react'
import { useStore } from 'store/main'
import DesktopNav from 'components/nav/DesktopNav'
import MobileNav from 'components/nav/MobileNav'
import { useImportControl } from 'components/nav/actions'

// Thin shell: owns the shared hidden file input and picks the nav shell
// matching the viewport. All action logic lives in components/nav/actions.tsx.
const Header = function() {
  const { ui } = useStore()
  const { fileInput, requestImport } = useImportControl()

  return (
    <>
      {ui.isMobile
        ? <MobileNav requestImport={requestImport}/>
        : <DesktopNav requestImport={requestImport}/>}
      {fileInput}
    </>
  )
}

export default observer(Header)
