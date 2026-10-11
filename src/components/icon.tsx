import {
  ArrowLeftRight,
  Archive,
  Book,
  BookOpen,
  Calendar,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  FilePlus,
  FileText,
  ImagePlus,
  Languages,
  List,
  Minus,
  Monitor,
  Moon,
  Plus,
  Rocket,
  Ruler,
  Scissors,
  Sun,
  Trash2,
  Undo2,
  Upload,
  Wrench,
  X,
  type LucideIcon,
} from 'lucide-react';

/** Brand marks are absent from lucide, so the GitHub glyph stays a local path. */
function GithubIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M12 2A10 10 0 0 0 2 12c0 4.42 2.87 8.17 6.84 9.5.5.08.66-.23.66-.5v-1.69c-2.77.6-3.36-1.34-3.36-1.34-.46-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.87 1.52 2.34 1.07 2.91.83.1-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.92 0-1.11.38-2 1.03-2.71-.1-.25-.45-1.29.1-2.64 0 0 .84-.27 2.75 1.02.79-.22 1.65-.33 2.5-.33.85 0 1.71.11 2.5.33 1.91-1.29 2.75-1.02 2.75-1.02.55 1.35.2 2.39.1 2.64.65.71 1.03 1.6 1.03 2.71 0 3.82-2.34 4.66-4.57 4.91.36.31.69.92.69 1.85V21c0 .27.16.59.67.5C19.14 20.16 22 16.42 22 12A10 10 0 0 0 12 2z" />
    </svg>
  );
}

/** String names map onto lucide-react; size comes from the .icon CSS class.
    Unknown names are a compile error through the IconName union. */
const ICONS = {
  book: Book,
  bookmarks: BookOpen,
  calendar: Calendar,
  'chevron-down': ChevronDown,
  'chevron-left': ChevronLeft,
  'chevron-right': ChevronRight,
  cross: X,
  cycle: ArrowLeftRight,
  document: FileText,
  'image-plus': ImagePlus,
  install: Download,
  lang: Languages,
  list: List,
  minus: Minus,
  moon: Moon,
  notification: FilePlus,
  plus: Plus,
  rocket: Rocket,
  ruler: Ruler,
  save: Archive,
  scissors: Scissors,
  sun: Sun,
  swap: ArrowLeftRight,
  'theme-auto': Monitor,
  tools: Wrench,
  trash: Trash2,
  undo: Undo2,
  upload: Upload,
} satisfies Record<string, LucideIcon>;

export type IconName = keyof typeof ICONS;

type IconProps = ({ name: IconName | 'github'; className?: string })

const Icon = function({ name, className }: IconProps) {
  if (name === 'github') return <GithubIcon className={'icon ' + (className || '')} />;
  const Lucide = ICONS[name];
  return <Lucide className={'icon ' + (className || '')} />;
}

export default Icon
