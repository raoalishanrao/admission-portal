import { Check } from 'lucide-react'
import { APPLICATION_STEPS } from '@/lib/application-steps'
import type { ApplicationStepId } from '@/lib/api/types'
import { cn } from '@/lib/utils'

type Props = {
  currentStep: ApplicationStepId
  completed: Partial<Record<ApplicationStepId, boolean>>
  onStepClick?: (step: ApplicationStepId) => void
}

export function ApplicationStepper({ currentStep, completed, onStepClick }: Props) {
  const currentIndex = APPLICATION_STEPS.findIndex(step => step.id === currentStep)

  return (
    <div className="border-b border-[#e4e9f4] pb-5">
      <ol className="flex flex-nowrap items-start gap-0 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {APPLICATION_STEPS.map((step, index) => {
          const isCurrent = step.id === currentStep
          const isComplete = !!completed[step.id] && !isCurrent
          const isReachable = index <= currentIndex || !!completed[step.id]
          const connectorDone =
            index < currentIndex ||
            (!!completed[step.id] && index < APPLICATION_STEPS.length - 1)

          return (
            <li
              key={step.id}
              className={cn(
                'relative flex min-w-[5.75rem] flex-1 flex-col items-center gap-1.5 px-1 sm:min-w-0 sm:gap-2',
                index < APPLICATION_STEPS.length - 1 &&
                  "after:absolute after:left-[calc(50%+1rem)] after:top-3.5 after:h-0.5 after:w-[calc(100%-2rem)] after:content-[''] sm:after:left-[calc(50%+1.1rem)] sm:after:top-4 sm:after:w-[calc(100%-2.2rem)]",
                connectorDone ? 'after:bg-[#0c3cff]' : 'after:bg-[#dce5f6]',
              )}
            >
              <button
                type="button"
                disabled={!isReachable || !onStepClick}
                onClick={() => onStepClick?.(step.id)}
                className={cn(
                  'relative z-10 grid h-7 w-7 place-items-center rounded-full text-xs font-semibold transition sm:h-8 sm:w-8 sm:text-sm',
                  isComplete && 'bg-[#0c3cff] text-white',
                  isCurrent && 'bg-[#0c3cff] text-white ring-4 ring-[#dbe7ff]',
                  !isComplete && !isCurrent && 'bg-[#e8edf5] text-[#6374ab]',
                  isReachable && onStepClick && 'hover:opacity-90',
                )}
                aria-current={isCurrent ? 'step' : undefined}
                title={step.title}
              >
                {isComplete ? <Check className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> : step.number}
              </button>
              <div className="w-full px-0.5 text-center">
                <p
                  className={cn(
                    'whitespace-nowrap text-xs font-semibold leading-tight antialiased sm:text-[13px]',
                    isCurrent || isComplete ? 'text-[#071759]' : 'text-[#6374ab]',
                  )}
                >
                  {step.shortTitle}
                </p>
                <p className="mt-0.5 hidden whitespace-nowrap text-[11px] leading-tight text-[#94a3b8] lg:block">
                  {isComplete ? 'Completed' : isCurrent ? 'In Progress' : 'Not Started'}
                </p>
              </div>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
