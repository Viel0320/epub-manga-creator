import { observer } from 'mobx-react';
import { useStore } from 'store/main';
import { useI18n } from 'i18n';
import Icon from 'components/icon';

const GITHUB_URL = 'https://github.com/Viel0320/epub-manga-creator';

export { GITHUB_URL };

/** Theme and language toggles, rendered beside the header actions at every
    viewport width. Observer is required: cycleTheme mutates the store without
    re-rendering the parent, so this component must track ui.theme itself. */
export const WorkspaceThemeLang = observer(function WorkspaceThemeLang() {
  const { ui } = useStore();
  const t = useI18n();

  const themeIcon = ui.theme === 'dark' ? 'moon' : ui.theme === 'light' ? 'sun' : 'theme-auto';
  const themeLabel = ui.theme === 'dark' ? t.workspace.dark : ui.theme === 'light' ? t.workspace.light : t.workspace.system;
  const langLabel = ui.lang === 'zh' ? t.lang.zh : t.lang.en;

  return <>
    <button type="button" className="workspace-icon-btn" title={`${t.nav.theme}: ${themeLabel}`} aria-label={`${t.nav.theme}: ${themeLabel}`} onClick={() => ui.cycleTheme()}><Icon name={themeIcon} /></button>
    <button type="button" className="workspace-icon-btn" title={`${t.nav.lang}: ${langLabel}`} aria-label={`${t.nav.lang}: ${langLabel}`} onClick={() => ui.toggleLang()}><Icon name="lang" /></button>
  </>;
});
