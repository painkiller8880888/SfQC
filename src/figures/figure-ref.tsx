import type { LessonDefinition } from '../lesson-contract.mjs'
import { VarianceDeviationBars } from './variance-deviation-bars'

type IncludedLesson = Extract<LessonDefinition, { availability: 'included' }>
type Props = { lesson: IncludedLesson; figureId: string }

export function FigureRef({ lesson, figureId }: Props) {
  const figure = lesson.figures.find((item) => item.figureId === figureId)

  if (!figure) return <p>参照先の図が見つかりません。</p>
  if (figure.rendererRef === 'code:variance-deviation-bars') {
    return <VarianceDeviationBars description={figure.altText} />
  }
  return <p>この図はまだ表示できません。</p>
}
