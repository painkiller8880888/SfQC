import type { LessonDefinition } from '../lesson-contract.mjs'
import { VarianceDeviationBars } from './variance-deviation-bars'
import { InteractiveVarianceComparison, VarianceSimulation } from './interactive-variance-comparison'

type IncludedLesson = Extract<LessonDefinition, { availability: 'included' }>
type Props = { lesson: IncludedLesson; figureId: string }

export function FigureRef({ lesson, figureId }: Props) {
  const figure = lesson.figures.find((item) => item.figureId === figureId)

  if (!figure) return <p>参照先の図が見つかりません。</p>
  if (figure.rendererRef === 'code:interactive-variance-comparison') {
    const mode = figure.figureId === 'FIG-DS-MEAN' ? 'mean'
      : figure.figureId === 'FIG-DS-DEVIATION' ? 'deviation'
        : figure.figureId === 'FIG-DS-STANDARD-DEVIATION' ? 'sd' : 'variance'
    return <InteractiveVarianceComparison mode={mode} />
  }
  if (figure.rendererRef === 'code:variance-simulation') return <VarianceSimulation />
  if (figure.rendererRef === 'code:variance-deviation-bars') {
    return <VarianceDeviationBars description={figure.altText} />
  }
  return <p>この図はまだ表示できません。</p>
}
