import { logger } from '../logger'
import { red } from 'picocolors'
import { SEPARATOR } from '../const'

export type StateValue = string[]

export interface ICurrentState {
  index: number
  parent: IRegexHandler
}

export interface IRegExTarget {
  regex: RegExp
  variableNames?: string[]
  // default is AND
  relation?: 'AND' | 'OR'
  // default is HEAD
  selection?: 'HEAD' | 'TAIL'
  postProcess?: (matchedGroup: Record<string, string>) => Record<string, string>
}

export interface IRegexHandler {
  name: string
  targetRegex: IRegExTarget[]
  // default is defaultSingleValueStateMachine
  stateMachine?: (curr: ICurrentState, input: string) => IValueState | null
}

export interface IFilter {
  target: string | RegExp
  substitute: string
}

export type IPreFilterFn = (input: string) => string
export type IPostFilterFn = (input: string, searchResult: IValueState) => string

export interface IPreFilterHandler {
  filters: (IFilter | IPreFilterFn)[]
}

export interface IPostFilterHandler {
  postFilters: (IFilter | IPostFilterFn)[]
}

export type IValueState = Record<string, StateValue>

export type IMediaParser =
  | IPreFilterHandler
  | IRegexHandler
  | (IPreFilterHandler & IRegexHandler)
  | (IPostFilterHandler & IRegexHandler)
  | (IPreFilterHandler & IPostFilterHandler & IRegexHandler)

export function defaultSingleValueStateMachine(curr: ICurrentState, input: string): IValueState | null {
  const regexTarget = curr.parent.targetRegex?.[curr.index]
  if (regexTarget) {
    const selectedGroups: Record<string, string>[] = [...input.matchAll(regexTarget.regex)]
      .map((i) => i.groups)
      .filter((i) => i != null)
      .filter((group) => shouldSelectRegexTargetGroup(group, regexTarget, curr.parent))
    if (selectedGroups.length > 0) {
      const selectedGroup = selectedGroups[regexTarget.selection == 'TAIL' ? selectedGroups.length - 1 : 0] as Record<string, string>
      const cleanedSelectedGroup = (typeof regexTarget.postProcess === 'function')
        ? regexTarget.postProcess(selectedGroup)
        : selectedGroup
      return Object.entries(cleanedSelectedGroup).reduce(
        (agg, [key, value]: [string, string]) => {
          agg[key] = value ? [value] : []
          return agg
        },
        {} as Record<string, string[]>,
      )
    } else {
      return defaultSingleValueStateMachine({ ...curr, index: curr.index + 1 }, input)
    }
  }
  return null
}

export function shouldSelectRegexTargetGroup(
  group: { [p: string]: string } | undefined,
  regexTarget: IRegExTarget,
  parent: IRegexHandler,
): boolean {
  const variableNames = regexTarget.variableNames || [parent.name]
  const varVal = variableNames.map((variable) => group?.[variable])
  switch (regexTarget.relation) {
    case undefined:
    case 'AND':
      return varVal.filter((i) => i != null).length === variableNames.length
    case 'OR':
      return varVal.filter((i) => i != null).length > 0
    default:
      logger.warn(red(`Invalid regex relation ${regexTarget.relation} : ${regexTarget}`))
      return false
  }
}

export function defaultPostFilterFunction(input: string, searchResult: IValueState):string {
  let newIp = input
  Object.values(searchResult)
    .flatMap((i) => i)
    .forEach((target) => {
      newIp = newIp.replaceAll(target, SEPARATOR)
    })
  return newIp
}
